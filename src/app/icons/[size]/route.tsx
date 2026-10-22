import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

export function generateStaticParams() {
  return [...SIZES].map((size) => ({ size: String(size) }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
          color: "#ffffff",
          fontSize: size * 0.4,
          fontWeight: 700,
          fontFamily: "monospace",
          letterSpacing: -size * 0.01,
        }}
      >
        CR
      </div>
    ),
    { width: size, height: size },
  );
}
