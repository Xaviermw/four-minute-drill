/**
 * Coach Bot -- the automated daily drumbeat (docs/marketing-plan.md, house
 * ghost ritual). Every morning it plays TODAY'S daily exactly as a human would
 * (same board, same prices, same drive seed), builds the share text with a
 * raceable ghost link, and posts a standing "beat the Coach" challenge.
 *
 * Deterministic per day: anyone who runs it for the same challenge id gets the
 * same drive. Posting is gated on secrets -- with none set it's a dry run that
 * prints the post (and writes the GitHub Actions job summary), so the owner
 * can copy-paste manually until the accounts exist.
 *
 * Env:
 *   BLUESKY_IDENTIFIER + BLUESKY_APP_PASSWORD  -> posts to Bluesky
 *   X_APP_KEY + X_APP_SECRET + X_ACCESS_TOKEN + X_ACCESS_SECRET -> posts to X
 *   SKIP_POST=1 -> dry run regardless
 *
 * Run: npx tsx scripts/daily-bot.ts
 */
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDriveSession, kickDistanceFor, makeRng, MAX_REALISTIC_FIELD_GOAL_DISTANCE } from "../src/engine";
import { dailyDraftRng, dailyDriveSeed, seedFromString, todaysChallengeId } from "../src/daily/dailyChallenge";
import { drawSlotOptions } from "../src/draft/draftPool";
import { getPricing } from "../src/draft/pricing";
import { capForChallenge } from "../src/draft/capConfig";
import { DEFAULT_SCENARIO } from "../src/data/startDrive";
import { buildDriveGrid, buildShareUrl } from "../src/share/shareText";
import { parseGhostParam, replayDriveCore } from "../src/share/ghost";
import type { KickerDataset, Manifest, ManifestPlayerEntry, PlayerDataset } from "../src/types/player";
import type { DraftedRoster, DraftedRosterData, RosterSlotKey } from "../src/types/roster";

const ORIGIN = "https://www.fourminutedrill.com";
const BOT_NAME = "Coach Bot";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "public", "data");
const manifest = JSON.parse(readFileSync(join(DATA, "manifest.json"), "utf8")) as Manifest;
const loadData = (id: string) => JSON.parse(readFileSync(join(DATA, "players", `${id}.json`), "utf8"));

// ---- Draft today's board like a sensible human: balanced spend under the cap ----
const challengeId = todaysChallengeId();
const pricing = getPricing(manifest.players);
const { cap } = capForChallenge(challengeId);
const board = drawSlotOptions(pricing.dealablePlayers, dailyDraftRng(challengeId));
const botRng = makeRng(seedFromString(`${challengeId}:coachbot`));

const SLOTS: RosterSlotKey[] = ["qb", "rb", "wr1", "wr2", "te", "k"];
const roster = {} as Record<RosterSlotKey, ManifestPlayerEntry>;
let budget = cap;
SLOTS.forEach((slot, i) => {
  const options = board[slot];
  const affordable = options.filter((p) => pricing.priceFor(p) <= budget).sort((a, b) => pricing.priceFor(a) - pricing.priceFor(b));
  let choice: ManifestPlayerEntry;
  if (affordable.length === 0) {
    // All three locked: the scrub gamble, seeded so the bot is deterministic.
    const taken = new Set(Object.values(roster).map((p) => p.gsisId));
    const pool = pricing.scrubPool(options[0].position).filter((p) => !taken.has(p.gsisId));
    choice = pool[Math.floor(botRng.next() * pool.length)];
  } else {
    const target = budget / (SLOTS.length - i);
    choice = affordable.reduce((best, p) =>
      Math.abs(pricing.priceFor(p) - target) < Math.abs(pricing.priceFor(best) - target) ? p : best
    );
  }
  roster[slot] = choice;
  budget -= pricing.priceFor(choice);
});
const spend = cap - budget;

// ---- Play the daily drive with a plain-vanilla policy ----
const rosterData: DraftedRosterData = {
  qb: loadData(roster.qb.gsisId) as PlayerDataset,
  rb: loadData(roster.rb.gsisId) as PlayerDataset,
  wr1: loadData(roster.wr1.gsisId) as PlayerDataset,
  wr2: loadData(roster.wr2.gsisId) as PlayerDataset,
  te: loadData(roster.te.gsisId) as PlayerDataset,
  k: loadData(roster.k.gsisId) as KickerDataset,
};
const session = createDriveSession(rosterData, DEFAULT_SCENARIO, manifest.leagueAverageRates, manifest.leagueAverageKickerRates, dailyDriveSeed(challengeId));
for (let i = 0; i < 40; i++) {
  const options = session.getOptions();
  if (options.length === 0) break;
  const s = session.getSituation();
  const canKick = kickDistanceFor(s.fieldPosition) <= MAX_REALISTIC_FIELD_GOAL_DISTANCE;
  // Rotate through the coverage (passes, gap runs, keeper) so no single
    // spot dominates; kick on 4th when in range.
    const { status } = session.choosePlay(s.down === 4 && canKick ? { kind: "fieldGoal" } : options[i % options.length]);
  if (status !== "continue") break;
}
const log = session.getLog();

// ---- Build the ghost link, self-checked: replay must reproduce the score ----
let url = buildShareUrl(roster as DraftedRoster, ORIGIN, log, BOT_NAME);
const parsed = url?.includes("&g=") ? parseGhostParam(`?${url.split("?")[1]}`) : null;
const replayOk = parsed ? replayDriveCore(rosterData, manifest, parsed.seed, parsed.choices)?.log.score === log.score : false;
if (!replayOk) {
  console.error("ghost self-check FAILED -- posting plain team link");
  url = buildShareUrl(roster as DraftedRoster, ORIGIN);
}
if (!url) throw new Error("could not build a share URL");

// ---- Compose the post ----
const dateLabel = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
const grid = buildDriveGrid(log);
const scoreLine = log.won
  ? `🤖 ${BOT_NAME}: ${log.score} pts on a $${spend} squad. Beat his drive ▶`
  : log.score > 0
    ? `🤖 ${BOT_NAME} stalled out: ${log.score} pts. Punish him ▶`
    : `🤖 ${BOT_NAME} laid an egg: 0 pts. Do literally anything better ▶`;
let post = [`🏈 Today's drill is live (${dateLabel}) — same board for everyone, one shot.`, grid, `${scoreLine} ${url}`].join("\n");
if (post.length > 292) post = [`🏈 Today's drill is live (${dateLabel}).`, `${scoreLine} ${url}`].join("\n");

console.log("---- post ----\n" + post + "\n--------------");
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Coach Bot — ${challengeId}\n\n\`\`\`\n${post}\n\`\`\`\n`);
}

// ---- Post (each platform independently gated on its secrets) ----
const dryRun = process.env.SKIP_POST === "1";

async function postBluesky(): Promise<void> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password || dryRun) return console.log("bluesky: skipped");
  const sess = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`bsky auth ${r.status}`))));
  // Make the URL clickable: facet over its byte range.
  const bytes = new TextEncoder().encode(post);
  const urlBytes = new TextEncoder().encode(url!);
  const byteStart = bytes.length - urlBytes.length;
  const res = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.accessJwt}` },
    body: JSON.stringify({
      repo: sess.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: post,
        createdAt: new Date().toISOString(),
        facets: [
          { index: { byteStart, byteEnd: bytes.length }, features: [{ $type: "app.bsky.richtext.facet#link", uri: url }] },
        ],
      },
    }),
  });
  console.log(res.ok ? "bluesky: posted" : `bluesky: FAILED ${res.status} ${await res.text()}`);
}

async function postX(): Promise<void> {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET || dryRun) return console.log("x: skipped");
  const { TwitterApi } = await import("twitter-api-v2");
  const client = new TwitterApi({ appKey: X_APP_KEY, appSecret: X_APP_SECRET, accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_SECRET });
  await client.v2.tweet(post);
  console.log("x: posted");
}

const results = await Promise.allSettled([postBluesky(), postX()]);
for (const r of results) if (r.status === "rejected") console.error(r.reason);
