import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, internalError } from "@/lib/api/route-errors";
import { getInsights } from "@/services/pullRequestDetailsService";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        repoUuid: z.string().min(1),
        id: z.number().int(),
        updatedOn: z.string().min(1),
        approved: z.boolean(),
      }),
    )
    .max(50),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  try {
    return NextResponse.json({ insights: await getInsights(parsed.data.items) });
  } catch (err) {
    return internalError(err);
  }
}
