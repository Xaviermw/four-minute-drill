/**
 * Dynamic OG card for shared drives (marketing-automation-plan A3): when a
 * ghost link is unfurled, the crawler sees /api/og?s=<score>&r=<code>&by=<name>
 * &sp=<spend> instead of the generic banner -- the sharer's own scoreline.
 * Params come from the share URL (see buildShareUrl/buildDriveCode); no engine
 * replay happens here. Renders with @vercel/og (satori) on the edge runtime.
 * Element trees are plain objects (React-compatible shape) -- no JSX, so the
 * api/ build needs no framework config.
 */
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

/** buildDriveCode letters -> square colors (keep in lockstep with shareText). */
const SQUARE: Record<string, string> = {
  t: "#ffc233", // touchdown
  x: "#991b1b", // turnover
  g: "#22c55e", // 15+
  y: "#eab308", // 4-14
  w: "#e5e7eb", // 1-3
  r: "#dc2626", // stuffed
  F: "#ffe100", // FG good
  m: "#6b7280", // FG missed
  d: "#b91c1c", // downs
  c: "#94a3b8", // clock
};

export default function handler(req: Request): ImageResponse {
  const p = new URL(req.url).searchParams;
  const score = (p.get("s") ?? "").replace(/[^0-9]/g, "").slice(0, 4);
  const code = (p.get("r") ?? "").replace(/[^txgywrFmdc]/g, "").slice(0, 24);
  const by = (p.get("by") ?? "").slice(0, 20);
  const spend = (p.get("sp") ?? "").replace(/[^0-9]/g, "").slice(0, 3);

  const squares = [...code].map((ch) =>
    el("div", {
      width: 44,
      height: 44,
      borderRadius: 8,
      background: SQUARE[ch] ?? "#334155",
    })
  );

  const headline = score === "" ? "Race this drive" : `${score} PTS`;
  const subline =
    spend !== ""
      ? `${by || "A challenger"} built it for $${spend} — beat the drive`
      : `${by || "A challenger"} says: beat this drive`;

  return new ImageResponse(
    el(
      "div",
      {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #18233a 0%, #0b0f17 70%)",
        fontFamily: "sans-serif",
      },
      [
        el("div", { position: "absolute", top: 0, left: 0, width: "1200px", height: "10px", background: "#22c55e" }),
        el(
          "div",
          { display: "flex", color: "#ffc233", fontSize: 40, fontWeight: 700, letterSpacing: 8, marginBottom: 30 },
          "FOUR MINUTE DRILL"
        ),
        el("div", { display: "flex", color: "#eef2f8", fontSize: 150, fontWeight: 700 }, headline),
        el("div", { display: "flex", gap: 10, marginTop: 24, marginBottom: 30 }, squares),
        el("div", { display: "flex", color: "#8c99ad", fontSize: 40 }, subline),
        el(
          "div",
          { display: "flex", color: "#57637a", fontSize: 30, letterSpacing: 6, marginTop: 40 },
          "FOURMINUTEDRILL.COM — FREE — NEW DRILL DAILY"
        ),
      ]
    ) as unknown as ConstructorParameters<typeof ImageResponse>[0],
    { width: 1200, height: 630 }
  );
}
