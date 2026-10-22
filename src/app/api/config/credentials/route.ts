import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError, jsonError } from "@/lib/api/route-errors";
import { isLocalRequest } from "@/lib/local-request";
import {
  CredentialsRejectedError,
  clearStoredCredentials,
  getCredentialsSummary,
  saveCredentials,
} from "@/services/credentialsService";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  workspace: z
    .string()
    .trim()
    .min(1, "Informe o workspace")
    .max(100)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use o slug do workspace, ex.: minha-empresa"),
  email: z
    .string()
    .trim()
    .max(200)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido"),
  apiToken: z
    .string()
    .trim()
    .max(500)
    .regex(/^\S*$/, "O token não pode ter espaços")
    .nullable()
    .optional(),
});

function notLocal() {
  return jsonError(
    "NOT_LOCAL",
    "As credenciais só podem ser alteradas acessando o app pelo próprio computador (localhost).",
    403,
  );
}

export async function GET(req: Request) {
  const summary = getCredentialsSummary();
  if (!isLocalRequest(req)) {
    return NextResponse.json({
      editable: false,
      source: summary.source,
      workspace: null,
      email: null,
      tokenHint: null,
    });
  }
  return NextResponse.json({ editable: true, ...summary });
}

export async function PUT(req: Request) {
  if (!isLocalRequest(req)) return notLocal();

  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Inválido");

  try {
    await saveCredentials({
      workspace: parsed.data.workspace,
      email: parsed.data.email,
      apiToken: parsed.data.apiToken || null,
    });
  } catch (err) {
    if (err instanceof CredentialsRejectedError) return badRequest(err.message);
    return internalError(err);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isLocalRequest(req)) return notLocal();
  try {
    clearStoredCredentials();
  } catch (err) {
    return internalError(err);
  }
  return NextResponse.json({ ok: true });
}
