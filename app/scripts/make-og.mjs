// Generates app/public/og.png -- the 1200x630 social share card that unfurls
// when a link to the game is pasted into chats. Run: `node scripts/make-og.mjs`
// (from app/). Uses a system bold sans stack since librsvg won't fetch the
// brand webfont (Barlow Condensed) -- good enough for v1; brand-font upgrade
// is a follow-up. Palette mirrors src/share/resultCard.css.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const W = 1200;
const H = 630;
const FONT = "system-ui, 'Segoe UI', Roboto, Arial, sans-serif";

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="110%">
      <stop offset="0%" stop-color="#18233a"/>
      <stop offset="60%" stop-color="#0b0f17"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="8" fill="#22c55e"/>
  <text x="${W / 2}" y="200" text-anchor="middle" font-family="${FONT}" font-weight="800"
    font-size="52" letter-spacing="6" fill="#ffc233">🏈 FOUR MINUTE DRILL</text>
  <text x="${W / 2}" y="330" text-anchor="middle" font-family="${FONT}" font-weight="800"
    font-size="72" fill="#eef2f8">Draft. Call the plays. Win.</text>
  <text x="${W / 2}" y="410" text-anchor="middle" font-family="${FONT}" font-weight="500"
    font-size="36" fill="#8c99ad">Real NFL players. Real historical play data.</text>
  <text x="${W / 2}" y="470" text-anchor="middle" font-family="${FONT}" font-weight="500"
    font-size="36" fill="#8c99ad">Weaker roster, bigger score.</text>
  <text x="${W / 2}" y="575" text-anchor="middle" font-family="${FONT}" font-weight="700"
    font-size="30" letter-spacing="8" fill="#57637a">CAN YOU BEAT IT?</text>
</svg>`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");
await sharp(Buffer.from(svg)).png().toFile(out);
console.log("Wrote", out);
