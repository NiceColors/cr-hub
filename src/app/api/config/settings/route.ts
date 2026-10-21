import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, setPollIntervalSeconds } from "@/services/configService";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  pollIntervalSeconds: z.union([z.literal(30), z.literal(60), z.literal(120)]),
});

export async function GET() {
  const s = getSettings();
  return NextResponse.json({ pollIntervalSeconds: s.pollIntervalSeconds });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 },
    );
  }

  setPollIntervalSeconds(parsed.data.pollIntervalSeconds);
  return NextResponse.json({ ok: true });
}

