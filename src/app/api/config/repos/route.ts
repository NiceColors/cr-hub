import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { monitoredRepos } from "@/lib/db/schema";

const repoInputSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

const bodySchema = z.object({
  repos: z.array(repoInputSchema),
});

export async function GET() {
  const rows = db.select().from(monitoredRepos).all();
  return NextResponse.json({ repos: rows });
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

  const repos = parsed.data.repos;

  db.transaction((tx) => {
    tx.delete(monitoredRepos).run();
    if (repos.length > 0) tx.insert(monitoredRepos).values(repos).run();
  });

  return NextResponse.json({ ok: true });
}

