import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { monitoredUsers } from "@/lib/db/schema";

const userInputSchema = z.object({
  uuid: z.string().min(1),
  nickname: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

const bodySchema = z.object({
  users: z.array(userInputSchema),
});

export async function GET() {
  const rows = db.select().from(monitoredUsers).all();
  return NextResponse.json({ users: rows });
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

  const users = parsed.data.users;

  db.transaction((tx) => {
    tx.delete(monitoredUsers).run();
    if (users.length > 0) tx.insert(monitoredUsers).values(users).run();
  });

  return NextResponse.json({ ok: true });
}

