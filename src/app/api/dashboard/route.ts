import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError } from "@/lib/api/route-errors";
import { getDashboard } from "@/services/dashboardService";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  teamId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || Number.isInteger(v), "teamId inválido"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ teamId: url.searchParams.get("teamId") ?? undefined });
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    return NextResponse.json(getDashboard({ teamId: parsed.data.teamId }));
  } catch (err) {
    return internalError(err);
  }
}
