import z from "zod";

import { traced } from "@/app/trace.ts";
import { kv } from "@/app/data/_core.ts";
import { Entry, parseEntry, Version, versionOf } from "@/app/data/_types.ts";

const BusinessRecordSchema = z.object({
  name: z.string(),
  address: z.string(),
  location: z.string(),
  kvk: z.string(),
  vat: z.string(),
  iban: z.string(),
  bic: z.string(),
});

export type BusinessRecord = z.output<typeof BusinessRecordSchema>;

type SetRequest = z.output<typeof BusinessRecordSchema> & { _version: Version };

const fallback = {
  name: "Amsterdam Tech Solutions B.V.",
  address: "Keizersgracht 421",
  location: "1016 EK Amsterdam",
  kvk: "12345678",
  vat: "NL812345678B01",
  iban: "NL91ABNA0412345678",
  bic: "ABNANL2A",
};

export class Business {
  @traced("data")
  static async get(owner: string): Promise<BusinessRecord> {
    return (await this._get(owner)).record;
  }

  @traced("data")
  static async getForUpdate(owner: string): Promise<Entry<BusinessRecord>> {
    return await this._get(owner);
  }

  private static async _get(owner: string): Promise<Entry<BusinessRecord>> {
    const entry = await kv.get(businessKey(owner));

    if (entry.versionstamp === null) {
      const version = await this.create(owner, fallback);
      return { record: fallback, version };
    }

    return parseEntry(entry, (v) => BusinessRecordSchema.parse(v));
  }

  @traced("data")
  static async create(owner: string, req: BusinessRecord): Promise<Version> {
    const key = businessKey(owner);
    const record = BusinessRecordSchema.encode(req);

    const result = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, record)
      .commit();

    if (!result.ok) {
      throw new Error("already exists");
    }

    return versionOf(result);
  }

  @traced("data")
  static async set(owner: string, req: SetRequest) {
    const key = businessKey(owner);
    const record = BusinessRecordSchema.encode(req);

    const result = await kv.atomic()
      .check({ key, versionstamp: req._version })
      .set(key, record)
      .commit();

    if (!result.ok) {
      return { type: "conflict" } as const;
    }

    return { type: "ok", version: versionOf(result) } as const;
  }
}

function businessKey(owner: string): Deno.KvKey {
  return ["owner", owner, "business"];
}
