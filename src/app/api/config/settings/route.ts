import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSettings,
  setJiraSettings,
  setPollIntervalSeconds,
} from "@/services/configService";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  pollIntervalSeconds: z.union([z.literal(30), z.literal(60), z.literal(120)]).optional(),
  jiraBaseUrl: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "URL do Jira inválida"),
  jiraProjectKeys: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .refine((v) => !v || /^[A-Za-z][A-Za-z0-9]*(\s*,\s*[A-Za-z][A-Za-z0-9]*)*$/.test(v), {
      message: "Use chaves separadas por vírgula, ex.: FUND, OPS",
    }),
});

export async function GET() {
  const s = getSettings();
  return NextResponse.json({
    pollIntervalSeconds: s.pollIntervalSeconds,
    jiraBaseUrl: s.jiraBaseUrl ?? null,
    jiraProjectKeys: s.jiraProjectKeys ?? null,
  });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Inválido" } },
      { status: 400 },
    );
  }

  const { pollIntervalSeconds, jiraBaseUrl, jiraProjectKeys } = parsed.data;
  if (pollIntervalSeconds) setPollIntervalSeconds(pollIntervalSeconds);
  if (jiraBaseUrl !== undefined || jiraProjectKeys !== undefined) {
    const current = getSettings();
    setJiraSettings({
      baseUrl:
        jiraBaseUrl !== undefined
          ? jiraBaseUrl?.replace(/\/+$/, "") || null
          : (current.jiraBaseUrl ?? null),
      projectKeys:
        jiraProjectKeys !== undefined
          ? jiraProjectKeys?.toUpperCase().replace(/\s+/g, "") || null
          : (current.jiraProjectKeys ?? null),
    });
  }
  return NextResponse.json({ ok: true });
}
