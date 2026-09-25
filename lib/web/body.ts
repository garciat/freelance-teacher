import { z } from "zod";

import { SizeLimitStream } from "@/lib/streams.ts";

export namespace Body {
  export function formData<T>(
    type: z.ZodType<T, Record<string, string | File>>,
    options: { maxBytes?: number } = {},
  ) {
    const { maxBytes = 1 * 1024 * 1024 } = options;

    return z.codec(
      z.instanceof(Request),
      type,
      {
        decode: async (req) => {
          const contentLength = req.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > maxBytes) {
            throw new Error("payload too large");
          }

          if (!req.body) {
            throw new Error("expected body");
          }

          const decoder = new Response(
            req.body.pipeThrough(new SizeLimitStream(maxBytes)),
            {
              headers: {
                "Content-Type": req.headers.get("content-type") ?? "",
              },
            },
          );

          const formData = await decoder.formData();

          return Object.fromEntries(formData.entries());
        },
        encode: (record) => {
          const body = new FormData();
          for (const [key, value] of Object.entries(record)) {
            body.set(key, value);
          }
          return new Request("", { body });
        },
      },
    );
  }
}
