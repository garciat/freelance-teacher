import z from "zod";

import { SessionItem } from "@/lib/web/session.ts";

const AuthSessionSchema = z.object({
  email: z.string(),
});

const secret = Deno.env.get("APP_SESSION_AUTH_SECRET");
if (!secret) {
  throw new TypeError("unset APP_SESSION_AUTH_SECRET env var");
}

export const AuthSession = new SessionItem({
  secret: new TextEncoder().encode(secret),
  cookieName: "auth",
  ttl: Temporal.Duration.from({ days: 7 }),
  schema: AuthSessionSchema,
});

export type AuthSessionData = z.output<typeof AuthSessionSchema>;
