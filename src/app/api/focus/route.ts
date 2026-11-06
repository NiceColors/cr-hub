import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import { addFocus, FocusError, listActiveFocus } from "@/services/focusService";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  repoUuid: z.string().min(1),
  prId: z.number().int(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  repoSlug: z.string().min(1),
});

export async function GET() {
  return NextResponse.json({ items: listActiveFocus() });
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    addFocus(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FocusError) return jsonError(err.code, err.message, err.status);
    throw err;
  }
}
