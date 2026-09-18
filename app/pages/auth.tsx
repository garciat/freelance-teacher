import z from "zod";
import { OAuth2Client } from "google-auth-library";

import { Body } from "@/lib/web/body.ts";
import { Responses } from "@/lib/web/respond.ts";
import { descriptor, formatRoute, route } from "@/lib/web/route.ts";
import { SessionItem } from "@/lib/web/session.ts";

import { PageLayout } from "@/app/pages/_layouts/page.tsx";
import { AuthSession } from "@/app/session.ts";
import { Form } from "@/lib/web/link.tsx";

const GoogleAuthClient = new OAuth2Client({
  clientId: Deno.env.get("GOOGLE_CLIENT_ID"),
  clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
  redirectUri: Deno.env.get("GOOGLE_CLIENT_REDIRECT_URI"),
});

const GoogleAuthInitSessionItem = new SessionItem({
  secret: crypto.getRandomValues(new Uint8Array(256)),
  cookieName: "google_auth_init",
  ttl: Temporal.Duration.from({ minutes: 10 }),
  sameSite: "None",
  schema: z.object({
    nonce: z.string(),
  }),
});

export const descriptors = {
  login: descriptor("GET", "/auth/login", { response: Responses.jsx }),
  logout: descriptor("GET", "/auth/logout", {}),

  google: {
    init: descriptor("POST", "/auth/google/init", {}),
    callback: descriptor("POST", "/auth/google/callback", {
      body: Body.formData(z.object({
        code: z.string(),
        state: z.string(),
      })),
    }),
  },
};

export const routes = [
  route(
    descriptors.login,
    () => (
      <PageLayout title="Login">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Form to={descriptors.google.init}>
            <button type="submit">Sign in with Google</button>
          </Form>
        </div>
      </PageLayout>
    ),
  ),

  route(
    descriptors.logout,
    () => (
      new Response("", {
        status: 303,
        headers: AuthSession.dropCookie(
          new Headers({
            "location": "/",
          }),
        ),
      })
    ),
  ),

  // Google
  route(
    descriptors.google.init,
    async ({ ctx }) => {
      const redirectUrl = new URL(
        formatRoute(descriptors.google.callback, {}),
        ctx.url,
      );

      const nonce = crypto.getRandomValues(new Uint8Array(32)).toHex();

      const authUrl = new URL(
        GoogleAuthClient.generateAuthUrl({
          response_type: "code",
          scope: ["openid", "email"],
          state: nonce,
          redirect_uri: redirectUrl.toString(),
        }),
      );
      authUrl.searchParams.set("response_mode", "form_post");

      return new Response(null, {
        status: 303,
        headers: await GoogleAuthInitSessionItem.setCookie({ nonce }, {
          "location": authUrl.toString(),
        }),
      });
    },
  ),

  route(
    descriptors.google.callback,
    async ({ body, init }) => {
      if (body.state !== init.nonce) {
        throw new Error("bad nonce");
      }

      const res = await GoogleAuthClient.getToken(body.code);

      if (!res.tokens.id_token) {
        throw new Error("no id_token?");
      }

      const ticket = await GoogleAuthClient.verifyIdToken({
        idToken: res.tokens.id_token,
      });

      const email = ticket.getPayload()?.email;

      if (!email) {
        console.log(ticket);
        throw new Error("no email?");
      }

      return new Response("", {
        status: 303,
        headers: await AuthSession.setCookie(
          { email },
          GoogleAuthInitSessionItem.dropCookie({
            "location": "/",
          }),
        ),
      });
    },
    { init: GoogleAuthInitSessionItem.extra() },
  ),
];
