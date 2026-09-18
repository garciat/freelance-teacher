import z from "zod";

export class Query {
  static searchParams<T>(
    schema: z.ZodType<T, Record<string, string>>,
  ): z.ZodType<T, URLSearchParams> {
    return z.codec(
      z.instanceof(URLSearchParams),
      schema,
      {
        decode: (params) => Object.fromEntries(params.entries()),
        encode: (record) =>
          new URLSearchParams(
            Object.entries(record).filter(([, value]) => value),
          ),
      },
    );
  }
}
