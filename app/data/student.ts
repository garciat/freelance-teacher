import z from "zod";

import { kv } from "@/app/data/_core.ts";
import { traced } from "@/app/trace.ts";
import { parseEntry, Version } from "@/app/data/_types.ts";

export const AGE_CATEGORIES = ["adult", "child"] as const;

const StudentRecordSchema = z.object({
  id: z.uuid(),
  status: z.literal(["active", "inactive"]),
  name: z.string().nonempty(),
  ageCategory: z.enum(AGE_CATEGORIES).default("adult"),
  billing: z.object({
    name: z.string().nonempty(),
    address: z.string().nonempty(),
    location: z.string().nonempty(),
  }),
  contact: z.object({
    email: z.optional(z.email()),
    whatsapp: z.optional(z.string()),
  }),
});

export type StudentRecord = z.output<typeof StudentRecordSchema>;

export type AgeCategory = typeof AGE_CATEGORIES[number];

export type CreateRequest = {
  name: string;
  ageCategory: AgeCategory;
  billing: {
    name: string;
    address: string;
    location: string;
  };
  contact: {
    email?: string;
    whatsapp?: string;
  };
};

export type UpdateRequest = {
  _version: Version;
  name: string;
  ageCategory: AgeCategory;
  billing: {
    name: string;
    address: string;
    location: string;
  };
  contact: {
    email?: string;
    whatsapp?: string;
  };
};

export class Student {
  static async *list(
    owner: string,
    options?: { includeInactive: boolean },
  ): AsyncGenerator<StudentRecord> {
    for await (const entry of kv.list({ prefix: studentKeyAll(owner) })) {
      const record = StudentRecordSchema.parse(entry.value);

      if (record.status === "inactive" && !options?.includeInactive) {
        continue;
      }

      yield record;
    }
  }

  @traced("data")
  static async listAll(owner: string) {
    return await Array.fromAsync(this.list(owner));
  }

  @traced("data")
  static async create(
    owner: string,
    req: CreateRequest,
  ) {
    const id = crypto.randomUUID();

    const record = StudentRecordSchema.encode({
      ...req,
      id,
      status: "active",
    });

    const key = studentKeyOne(owner, id);

    const result = await kv.atomic()
      .check({ key, versionstamp: null })
      .set(key, record)
      .commit();

    if (!result.ok) {
      throw new Error("duplicate id");
    }
  }

  @traced("data")
  static async get(
    owner: string,
    id: string,
  ) {
    return (await this._get(owner, id)).record;
  }

  @traced("data")
  static async getForUpdate(
    owner: string,
    id: string,
  ) {
    return await this._get(owner, id);
  }

  private static async _get(
    owner: string,
    id: string,
  ) {
    const entry = await kv.get(studentKeyOne(owner, id));

    if (entry.versionstamp === null) {
      throw new Error("not found");
    }

    return parseEntry(entry, (v) => StudentRecordSchema.parse(v));
  }

  @traced("data")
  static async update(
    owner: string,
    id: string,
    req: UpdateRequest,
  ) {
    const key = studentKeyOne(owner, id);
    const storable = StudentRecordSchema.encode({
      ...req,
      id,
      status: "active",
    });

    const result = await kv.atomic()
      .check({ key, versionstamp: req._version })
      .set(key, storable)
      .commit();

    if (!result.ok) {
      return { type: "bad_version" } as const;
    }

    return { type: "ok" } as const;
  }

  @traced("data")
  static async remove(
    owner: string,
    id: string,
    version: Version,
  ) {
    const { record, version: readVersion } = await this._get(owner, id);

    if (version !== readVersion) {
      return { type: "bad_version" } as const;
    }

    const updated = { ...record, status: "inactive" } satisfies StudentRecord;
    const storable = StudentRecordSchema.encode(updated);

    const key = studentKeyOne(owner, id);

    const result = await kv.atomic()
      .check({ key, versionstamp: version })
      .set(key, storable)
      .commit();

    if (!result.ok) {
      return { type: "bad_version" } as const;
    }

    return { type: "ok" } as const;
  }
}

function studentKeyOne(owner: string, id: string): Deno.KvKey {
  return [...studentKeyBase(owner), id];
}

function studentKeyAll(owner: string): Deno.KvKey {
  return studentKeyBase(owner);
}

function studentKeyBase(owner: string): Deno.KvKey {
  return ["owner", owner, "students"];
}
