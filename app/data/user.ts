import z from "zod";

import { traced } from "@/app/trace.ts";

import { kv } from "@/app/data/_core.ts";
import { BasicEvent, makeBasicEvent } from "@/app/data/_types.ts";

const GoogleSub = z.string().nonempty();

const UserRecordSchema = z.object({
  id: z.uuid(),
  email: z.object({
    address: z.email(),
    events: z.object({
      lastVerificationEmailSent: z.optional(BasicEvent),
      verified: z.optional(BasicEvent),
    }),
  }),
  identities: z.object({
    google: z.optional(z.object({
      sub: GoogleSub,
      events: z.object({
        linked: BasicEvent,
      }),
    })),
  }),
  events: z.object({
    created: BasicEvent,
  }),
});

const UserEmailRecordSchema = z.object({
  email: z.email(),
  userId: z.uuid(),
});

const GoogleSubRecordSchema = z.object({
  sub: GoogleSub,
  userId: z.uuid(),
});

type UserRecord = z.output<typeof UserRecordSchema>;

export class User {
  @traced("data")
  static async createWithGoogle(sub: string, email: string) {
    const id = crypto.randomUUID();

    const key = userKey(id);

    const record = {
      id,
      email: {
        address: email,
        events: {},
      },
      identities: {
        google: {
          sub,
          events: {
            linked: makeBasicEvent(),
          },
        },
      },
      events: {
        created: makeBasicEvent(),
      },
    } satisfies UserRecord;

    const result = await kv.atomic()
      .check({ key, versionstamp: null })
      .check({ key: emailKey(email), versionstamp: null })
      .check({ key: googleKey(sub), versionstamp: null })
      .set(key, UserRecordSchema.encode(record))
      .set(emailKey(email), UserEmailRecordSchema.encode({ email, userId: id }))
      .set(googleKey(sub), GoogleSubRecordSchema.encode({ sub, userId: id }))
      .commit();

    if (!result.ok) {
      const [
        existingUser,
        existingEmail,
        existingGoogleSub,
      ] = await kv.getMany([
        userKey(id),
        emailKey(email),
        googleKey(sub),
      ]);

      if (existingGoogleSub.versionstamp) {
        return { type: "GOOGLE_SUB_EXISTS" } as const;
      }

      if (existingEmail.versionstamp) {
        return { type: "EMAIL_EXISTS" } as const;
      }

      if (existingUser.versionstamp) {
        throw new Error("duplicate user id");
      }

      throw new Error("user creation conflict");
    }

    return { type: "OK", record } as const;
  }

  @traced("data")
  static async findById(id: string) {
    const entry = await kv.get(userKey(id));

    if (entry.versionstamp === null) {
      return { type: "NOT_FOUND" } as const;
    }

    const record = UserRecordSchema.parse(entry.value);

    return { type: "OK", record } as const;
  }

  @traced("data")
  static async findByEmail(email: string) {
    const entry = await kv.get(emailKey(email));

    if (entry.versionstamp === null) {
      return { type: "NOT_FOUND" } as const;
    }

    const emailRecord = UserEmailRecordSchema.parse(entry.value);

    return await this.findById(emailRecord.userId);
  }

  @traced("data")
  static async findByGoogleSub(sub: string) {
    const entry = await kv.get(googleKey(sub));

    if (entry.versionstamp === null) {
      return { type: "NOT_FOUND" } as const;
    }

    const googleRecord = GoogleSubRecordSchema.parse(entry.value);

    return await this.findById(googleRecord.userId);
  }
}

function userKey(id: string): Deno.KvKey {
  return ["users", id];
}

function emailKey(email: string): Deno.KvKey {
  return ["user-emails", email];
}

function googleKey(sub: string): Deno.KvKey {
  return ["google-subs", sub];
}
