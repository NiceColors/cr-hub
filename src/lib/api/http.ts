import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return new ApiError(
    body?.error?.message ?? `Falha na requisição (${res.status})`,
    res.status,
  );
}

export async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  opts: { acceptErrorBody?: boolean } = {},
): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok && !opts.acceptErrorBody) throw await readError(res);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiError(`Resposta inválida (${url})`, res.status);
  return parsed.data;
}

export async function sendJson<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  schema?: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  const json = await res.json().catch(() => null);
  if (!schema) return json as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(`Resposta inválida (${url})`, res.status);
  return parsed.data;
}
