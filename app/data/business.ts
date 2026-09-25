import z from "zod";

import { kv } from "@/app/data/_core.ts";
import { traced } from "@/app/trace.ts";

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

type SetRequest = z.output<typeof BusinessRecordSchema>;

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
  static async get(owner: string) {
    const entry = await kv.get(businessKey(owner));

    if (entry.versionstamp === null) {
      await this.set(owner, fallback);
      return fallback;
    }

    return BusinessRecordSchema.parse(entry.value);
  }

  @traced("data")
  static async set(owner: string, req: SetRequest) {
    const record = BusinessRecordSchema.encode(req);

    await kv.set(businessKey(owner), record);
  }
}

function businessKey(owner: string): Deno.KvKey {
  return ["owner", owner, "business"];
}
