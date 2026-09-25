import z from "zod";

import { InstantISO8601 } from "@/lib/codecs.ts";

export const BasicEvent = z.object({
  timestamp: InstantISO8601,
});

export function makeBasicEvent(): z.output<typeof BasicEvent> {
  return { timestamp: Temporal.Now.instant() };
}
