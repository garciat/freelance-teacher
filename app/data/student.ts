import z from "zod";

import { kv } from "@/app/data/_core.ts";
import { traced } from "@/app/trace.ts";

const StudentRecordSchema = z.object({
  id: z.uuid(),
  status: z.literal(["active", "inactive"]),
  name: z.string().nonempty(),
  ageCategory: z.enum(["adult", "child"]).default("adult"),
  billing: z.object({
    name: z.string().nonempty(),
    address: z.string().nonempty(),
    location: z.string().nonempty(),
  }),
  contact: z.optional(z.object({
    email: z.email(),
    whatsapp: z.string(),
  })),
});

export type StudentRecord = z.output<typeof StudentRecordSchema>;

export type AgeCategory = StudentRecord["ageCategory"];

export type CreateRequest = {
  name: string;
  ageCategory: AgeCategory;
  billing: {
    name: string;
    address: string;
    location: string;
  };
  contact: {
    email: string;
    whatsapp: string;
  };
};

export type UpdateRequest = {
  name: string;
  ageCategory: AgeCategory;
  billing: {
    name: string;
    address: string;
    location: string;
  };
  contact: {
    email: string;
    whatsapp: string;
  };
};

export class Student {
  static async *list(
    owner: string,
    options?: { includeInactive: boolean },
  ): AsyncGenerator<StudentRecord> {
    for await (
      const entry of await kv.list({ prefix: studentKeyAll(owner) })
    ) {
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
    const entry = await kv.get(studentKeyOne(owner, id));
    if (entry.versionstamp === null) {
      throw new Error("not found");
    }
    return StudentRecordSchema.parse(entry.value);
  }

  // TODO expected version
  @traced("data")
  static async update(
    owner: string,
    id: string,
    req: UpdateRequest,
  ) {
    const entry = await kv.get(studentKeyOne(owner, id));
    if (entry.versionstamp === null) {
      throw new Error("not found");
    }

    const record = { ...req, id, status: "active" } satisfies StudentRecord;

    await kv.set(
      studentKeyOne(owner, id),
      StudentRecordSchema.encode(record),
    );
  }

  // TODO expected version
  @traced("data")
  static async remove(
    owner: string,
    id: string,
  ) {
    const record = await this.get(owner, id);

    const updated = { ...record, status: "inactive" } satisfies StudentRecord;

    await kv.set(
      studentKeyOne(owner, id),
      StudentRecordSchema.encode(updated),
    );
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
