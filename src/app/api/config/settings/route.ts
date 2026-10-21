import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  refreshIntervalSec: z.union([z.literal(30), z.literal(60), z.literal(120)]),
});

function getOrInitSettings() {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (row) return row;
  db.insert(settings).values({ id: 1, refreshIntervalSec: 30 }).run();
  return db.select().from(settings).where(eq(settings.id, 1)).get()!;
}

export async function GET() {
  const row = getOrInitSettings();
  return NextResponse.json({ refreshIntervalSec: row.refreshIntervalSec });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  getOrInitSettings();
  db.update(settings)
    .set({ refreshIntervalSec: parsed.data.refreshIntervalSec })
    .where(eq(settings.id, 1))
    .run();

  return NextResponse.json({ ok: true });
}

