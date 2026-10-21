import { NextResponse } from "next/server";
import { z } from "zod";
import { listPullRequests } from "@/services/pullRequestsService";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  teamId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || Number.isFinite(v), "teamId inválido"),
  force: z.string().optional().default("0"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    teamId: url.searchParams.get("teamId") ?? undefined,
    force: url.searchParams.get("force") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 },
    );
  }

  try {
    const out = await listPullRequests({
      teamId: parsed.data.teamId,
      force: parsed.data.force === "1",
    });
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Erro inesperado",
        },
      },
      { status: 500 },
    );
  }
}

