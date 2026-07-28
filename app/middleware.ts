/**
 * Edge middleware: shared-drive links (?g=...) get per-link OG meta so the
 * unfurl shows the sharer's actual scoreline (via /api/og) instead of the
 * generic banner. Crawlers don't run JS, so this is the only place the SPA
 * can vary its meta per URL. Fails open: any error serves the static page
 * exactly as before -- share links must never break on OG polish.
 */

export const config = { matcher: "/" };

export default async function middleware(req: Request): Promise<Response | undefined> {
  try {
    const url = new URL(req.url);
    const ghost = url.searchParams.get("g");
    if (!ghost) return undefined; // plain visit: static page untouched

    // Score rides inside the ghost param (v1.<seed36>.<score36>....).
    const parts = ghost.split(".");
    const score = parts.length >= 3 ? String(parseInt(parts[2], 36)) : "";
    const og = new URL("/api/og", url.origin);
    if (score && score !== "NaN") og.searchParams.set("s", score);
    for (const [from, to] of [["r", "r"], ["by", "by"], ["sp", "sp"]] as const) {
      const v = url.searchParams.get(from);
      if (v) og.searchParams.set(to, v);
    }

    const html = await fetch(new URL("/index.html", url.origin)).then((r) => r.text());
    const by = url.searchParams.get("by");
    const title = by ? `Beat ${by}'s drive — Four Minute Drill` : "Beat this drive — Four Minute Drill";
    const out = html
      .replaceAll("https://www.fourminutedrill.com/og.png", og.toString())
      .replaceAll(`content="Four Minute Drill"`, `content="${title.replaceAll('"', "")}"`);
    return new Response(out, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return undefined; // fail open
  }
}
