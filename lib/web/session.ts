import z from "zod";
import {
  Cookie,
  deleteCookie,
  getCookies,
  setCookie,
} from "jsr:@std/http@1.1.3/cookie";
import { JWTPayload, jwtVerify, SignJWT } from "npm:jose@^6";

import { Decorator } from "@/lib/web/decorator/types.ts";
import { decoratorForReq } from "@/lib/web/decorator/base.ts";
import { createCtxKey, Ctx } from "@/lib/web/ctx.ts";
import { ExtraParser } from "@/lib/web/types.ts";

export class SessionItem<T> {
  private readonly key = createCtxKey<T | null>("session");

  constructor(
    private readonly options: {
      readonly secret: Uint8Array;
      readonly cookieName: string;
      readonly ttl: Temporal.Duration;
      readonly schema: z.ZodType<T>;
      readonly sameSite?: Cookie["sameSite"];
    },
  ) {}

  get(ctx: Ctx): T | null {
    return ctx.props.get(this.key);
  }

  async setCookie(
    value: T,
    headers: HeadersInit = {},
  ): Promise<Headers> {
    const expiration = Temporal.Now.zonedDateTimeISO().add(this.options.ttl);

    const payload = {
      exp: Math.floor(expiration.epochMilliseconds / 1000),
      contents: await this.options.schema.encodeAsync(value),
    } satisfies SessionItemContainer;

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(new Date(expiration.epochMilliseconds))
      .sign(this.options.secret);

    const copy = new Headers(headers);

    setCookie(copy, {
      name: this.options.cookieName,
      value: jwt,
      httpOnly: true,
      secure: true,
      sameSite: this.options.sameSite ?? "Lax",
      maxAge: Math.floor(this.options.ttl.total("seconds")),
      path: "/",
    });

    return copy;
  }

  dropCookie(headers: HeadersInit = {}): Headers {
    const copy = new Headers(headers);
    deleteCookie(copy, this.options.cookieName, {
      httpOnly: true,
      secure: true,
      path: "/",
    });
    return copy;
  }

  decorator(): Decorator {
    return decoratorForReq(this.key, (req) => this.read(req));
  }

  extra(): ExtraParser<T> {
    return async (ctx) => {
      const value = await this.read(ctx.req);
      if (value === null) {
        throw new Response(`could not read session item`, { status: 400 });
      }
      return value;
    };
  }

  private async read(req: Request): Promise<T | null> {
    const cookies = getCookies(req.headers);

    const token = cookies[this.options.cookieName];

    if (token === undefined) {
      return null;
    }

    const result = await jwtVerify<SessionItemContainer>(
      token,
      this.options.secret,
    ).catch(() => null);

    if (result === null) {
      return null;
    }

    const value = await this.options.schema.safeDecodeAsync(
      result.payload.contents,
    );

    if (!value.success) {
      return null;
    }

    return value.data;
  }
}

interface SessionItemContainer extends JWTPayload {
  contents: unknown;
}
