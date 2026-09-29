import z from "zod";

import { InstantISO8601 } from "@/lib/codecs.ts";

export type Version = string & { readonly __brand: "version" };

export const VersionSchema = z.string()
  .nonempty()
  .transform((v) => v as Version);

export function versionOf(obj: { versionstamp: string }): Version {
  return obj.versionstamp as Version;
}

export interface Entry<T> {
  readonly record: T;
  readonly version: Version;
}

export function parseEntry<T>(
  { value, versionstamp }: Deno.KvEntry<unknown>,
  parser: (value: unknown) => T,
): Entry<T> {
  return {
    record: parser(value),
    version: versionstamp as Version,
  };
}

export const BasicEvent = z.object({
  timestamp: InstantISO8601,
});

export function makeBasicEvent(): z.output<typeof BasicEvent> {
  return { timestamp: Temporal.Now.instant() };
}
