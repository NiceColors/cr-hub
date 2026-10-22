import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository, patchRepository } from "@/services/configService";
import { resolveSla } from "@/domain/pull-request";

const slaHours = z.number().int().min(1).max(24 * 30).nullable().optional();

const patchSchema = z.object({
  monitored: z.boolean().optional(),
  minApprovals: z.number().int().min(0).max(20).optional(),
  slaWarningHours: slaHours,
  slaCriticalHours: slaHours,
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const current = getRepository(uuid);
  if (current) {
    const next = resolveSla({
      slaWarningHours:
        parsed.data.slaWarningHours !== undefined
          ? parsed.data.slaWarningHours
          : current.slaWarningHours,
      slaCriticalHours:
        parsed.data.slaCriticalHours !== undefined
          ? parsed.data.slaCriticalHours
          : current.slaCriticalHours,
    });
    if (next.warningHours >= next.criticalHours) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SLA",
            message: "O limite de atenção precisa ser menor que o crítico.",
          },
        },
        { status: 400 },
      );
    }
  }

  patchRepository(uuid, parsed.data);
  return NextResponse.json({ ok: true });
}
