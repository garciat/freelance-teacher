import { redirect303 } from "@/lib/web/respond.ts";
import { ExtraParser } from "@/lib/web/types.ts";

import { AuthSession, AuthSessionData } from "@/app/session.ts";
import { User } from "@/app/data/user.ts";
import { UserSession } from "@/app/pages/_types.ts";

export class UserExtra {
  static optional(): ExtraParser<UserSession | null> {
    return async (ctx) => {
      const auth = AuthSession.get(ctx);
      if (auth === null) {
        return null;
      }
      return await this.userFromAuth(auth);
    };
  }

  static required(): ExtraParser<UserSession> {
    return async (ctx) => {
      const auth = AuthSession.get(ctx);
      if (auth === null) {
        throw redirect303("/auth/login");
      }
      return await this.userFromAuth(auth);
    };
  }

  private static async userFromAuth(
    auth: AuthSessionData,
  ): Promise<UserSession> {
    const result = await User.findById(auth.userId);

    switch (result.type) {
      case "NOT_FOUND":
        throw redirect303("/", AuthSession.dropCookie());
      case "OK":
        return {
          id: result.record.id,
          email: result.record.email.address,
        };
      default:
        throw new TypeError(`unexpected: ${result satisfies never}`);
    }
  }
}
