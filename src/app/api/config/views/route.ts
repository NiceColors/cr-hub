import { NextResponse } from "next/server";
import { badRequest, jsonError } from "@/lib/api/route-errors";
import { savedViewInputSchema } from "@/lib/api/saved-view-schema";
import { createSavedView, listSavedViews } from "@/services/configService";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ views: listSavedViews() });
}

export async function POST(req: Request) {
  const parsed = savedViewInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    const id = createSavedView(parsed.data);
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return jsonError("DUPLICATE_NAME", "Já existe uma visão com esse nome.", 409);
    }
    throw err;
  }
}
