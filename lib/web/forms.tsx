import z from "zod";

const BasicFormDataSchema = z.record(z.string(), z.string());

type BasicFormData = z.output<typeof BasicFormDataSchema>;

type BasicFormDataSchemaShape = Record<string, z.ZodType<unknown, string>>;

export function makePostSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T> & z.ZodType<unknown, BasicFormData>,
) {
  return z.discriminatedUnion("action", [
    z.object({
      action: z.literal("cancel"),
      _referrer: z.url().optional(),
    }) satisfies z.ZodType<unknown, BasicFormData>,
    schema.extend({
      action: z.literal("save"),
      _referrer: z.url().optional(),
    }), // sadly, can't: satisfies z.ZodType<unknown, BasicFormData>
  ]);
}
