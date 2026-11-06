import { z } from "zod";
import { DEFAULT_DASHBOARD_RANGE, isDashboardRange } from "@/domain/dashboard";

export const dashboardQuerySchema = z.object({
  teamId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || Number.isInteger(v), "teamId inválido"),
  days: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : DEFAULT_DASHBOARD_RANGE))
    .refine(isDashboardRange, "days inválido"),
});

export function parseDashboardQuery(req: Request) {
  const url = new URL(req.url);
  return dashboardQuerySchema.safeParse({
    teamId: url.searchParams.get("teamId") ?? undefined,
    days: url.searchParams.get("days") ?? undefined,
  });
}
