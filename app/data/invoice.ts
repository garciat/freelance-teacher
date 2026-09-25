import z from "zod";
import { Dinero } from "dinero.js";

import { InstantISO8601, MoneyAmountCodec } from "@/lib/codecs.ts";

import { kv } from "@/app/data/_core.ts";
import { BasicEvent } from "@/app/data/_types.ts";
import { traced } from "@/app/trace.ts";

const InvoiceRecordSchema = z.object({
  sequenceNumber: z.bigint(),

  recipient: z.object({
    studentId: z.uuid(),
  }),

  amounts: z.object({
    vat: MoneyAmountCodec,
    preTaxTotal: MoneyAmountCodec,
  }),

  conditions: z.object({
    deadline: InstantISO8601,
  }),

  document: z.object({
    invoice: z.instanceof(ArrayBuffer),
  }),

  events: z.object({
    created: BasicEvent,
    finalized: z.optional(BasicEvent),
    paid: z.optional(BasicEvent),
  }),
});

export type InvoiceRecord = z.output<typeof InvoiceRecordSchema>;

export type CreateRequest = {
  sequenceNumber: bigint;
  recipient: {
    studentId: string;
  };
  amounts: {
    vat: Dinero<bigint>;
    preTaxTotal: Dinero<bigint>;
  };
  conditions: {
    deadline: Temporal.Instant;
  };
  document: {
    invoice: ArrayBuffer;
  };
};

export class Invoice {
  static async *list(owner: string) {
    for await (
      const entry of await kv.list(
        { prefix: collectionKey(owner) },
        { reverse: true },
      )
    ) {
      const record = InvoiceRecordSchema.parse(entry.value);
      yield record;
    }
  }

  @traced("data")
  static async listAll(owner: string) {
    return await Array.fromAsync(this.list(owner));
  }

  @traced("data")
  static async get(owner: string, id: bigint) {
    const record = await kv.get(recordKey(owner, id));
    if (record.versionstamp === null) {
      throw new Error("not found");
    }
    return InvoiceRecordSchema.parse(record.value);
  }

  @traced("data")
  static async maxSequenceNumber(owner: string) {
    for await (
      const entry of await kv.list(
        { prefix: collectionKey(owner) },
        { reverse: true, batchSize: 1 },
      )
    ) {
      const record = InvoiceRecordSchema.parse(entry.value);
      return record.sequenceNumber;
    }

    return null;
  }

  @traced("data")
  static async create(owner: string, req: CreateRequest) {
    const record = InvoiceRecordSchema.encode({
      ...req,
      events: {
        created: {
          timestamp: Temporal.Now.instant(),
        },
      },
    });

    const key = recordKey(owner, req.sequenceNumber);

    const result = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, record)
      .commit();

    if (!result.ok) {
      throw new Error("duplicate sequence number");
    }
  }

  // TODO expected version
  @traced("data")
  static async markFinalized(owner: string, id: bigint) {
    const invoice = await this.get(owner, id);

    if (invoice.events.finalized) {
      throw new Error("already finalized");
    }

    const updated = {
      ...invoice,
      events: {
        ...invoice.events,
        finalized: {
          timestamp: Temporal.Now.instant(),
        },
      },
    } satisfies InvoiceRecord;

    await kv.set(recordKey(owner, id), InvoiceRecordSchema.encode(updated));
  }

  // TODO expected version
  @traced("data")
  static async markPaid(owner: string, id: bigint) {
    const invoice = await this.get(owner, id);

    if (!invoice.events.finalized) {
      throw new Error("not finalized");
    }

    if (invoice.events.paid) {
      throw new Error("already paid");
    }

    const updated = {
      ...invoice,
      events: {
        ...invoice.events,
        paid: {
          timestamp: Temporal.Now.instant(),
        },
      },
    } satisfies InvoiceRecord;

    await kv.set(recordKey(owner, id), InvoiceRecordSchema.encode(updated));
  }
}

function collectionKey(owner: string): Deno.KvKey {
  return ["owner", owner, "invoices"];
}

function recordKey(owner: string, id: bigint): Deno.KvKey {
  return ["owner", owner, "invoices", id];
}
