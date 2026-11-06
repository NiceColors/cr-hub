import { z } from "zod";
import { isIsoDate } from "@/domain/rotation";

export const teamInputSchema = z.object({
  name: z.string().min(1),
  memberUuids: z.array(z.string().min(1)).default([]),
  repositoryUuids: z.array(z.string().min(1)).default([]),
  rotation: z
    .object({
      memberUuids: z.array(z.string().min(1)).max(100),
      startDate: z.string().refine(isIsoDate, "Data de início inválida (use AAAA-MM-DD)"),
    })
    .nullable()
    .optional(),
});
