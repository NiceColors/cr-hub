import { z } from "zod";

export const savedViewInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  tab: z.enum(["all", "mine", "authored"]),
  teamId: z.number().int().nullable(),
  filterQuery: z.unknown(),
  showSnoozed: z.boolean(),
});
