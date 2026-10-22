import { NextResponse } from "next/server";

export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function badRequest(message: string) {
  return jsonError("BAD_REQUEST", message, 400);
}

export function internalError(err: unknown) {
  return jsonError("INTERNAL_ERROR", err instanceof Error ? err.message : "Erro inesperado", 500);
}
