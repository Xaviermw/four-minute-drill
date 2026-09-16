/**
 * Coach Bot -- the automated daily drumbeat (docs/marketing-plan.md, house
 * ghost ritual; evening recap per docs/marketing-automation-plan.md A2).
 *
 * Three modes (BOT_MODE env, default "challenge"):
 *   challenge -- every morning: play TODAY'S daily exactly as a human would
 *     (same board, same prices, same drive seed), build the share text with a
 *     raceable ghost link, post a standing "beat the Coach" challenge.
 *   recap -- late evening: pull today's board from the public leaderboard API
 *     and post the results ("41 players, 12 beat the Coach, top drive 214").
 *     Quiet days (< MIN_RECAP_PLAYERS scores) post NOTHING -- "3 players
 *     showed up" reads as an ad against us.
 *   weekly -- Thursday morning: crown the NFL week that ended at midnight
 *     (weekly_totals, migration 017) and open the next race. Same quiet-week
 *     rule; nothing to post until week 1 is complete.
 *
 * Deterministic per day: anyone who runs challenge mode for the same
 * challenge id gets the same drive, so recap mode can recompute the Coach's
 * score by replaying it. Posting is gated on secrets -- with none set it's a
 * dry run that prints the post (and writes the GitHub Actions job summary).
 *
 * Env:
 *   BOT_MODE=challenge|recap|weekly (default challenge)
 *   BOT_NOW=<ISO instant> -> pretend it is that moment (dry runs of a future
 *     Thursday, or a recap of a past day); never set in the workflow
 *   SUPABASE_URL + SUPABASE_ANON_KEY -> board fetches (public values; the
 *     workflow scrapes them from the live bundle, same as the keep-alive step)
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
import { dailyDraftRng, dailyDriveSeed, formatChallengeDate, seedFromString, todaysChallengeId } from "../src/daily/dailyChallenge";
import { lastCompletedWeekStart, SEASON_END, SEASON_LABEL, weekEndFor, weekNumberFor } from "../src/daily/season";
import { drawSlotOptions } from "../src/draft/draftPool";
import { getPricing } from "../src/draft/pricing";
import { capForChallenge } from "../src/draft/capConfig";
import { DEFAULT_SCENARIO } from "../src/data/startDrive";
import { buildDriveGrid } from "../src/share/shareText";
import type { DriveLog } from "../src/types/simResult";
import type { KickerDataset, Manifest, ManifestPlayerEntry, PlayerDataset } from "../src/types/player";
import type { DraftedRoster, DraftedRosterData, RosterSlotKey } from "../src/types/roster";

const ORIGIN = "https://www.fourminutedrill.com";
const BOT_NAME = "Coach Bot";
const MIN_RECAP_PLAYERS = 3;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "public", "data");
const manifest = JSON.parse(readFileSync(join(DATA, "manifest.json"), "utf8")) as Manifest;
const loadData = (id: string) => JSON.parse(readFileSync(join(DATA, "players", `${id}.json`), "utf8"));

const now = process.env.BOT_NOW ? new Date(process.env.BOT_NOW) : new Date();
const challengeId = todaysChallengeId(now);
// Recap targets "the evening being recapped", robust to GitHub cron lag: a
// 12-hour shift maps any run between noon ET and noon-ET-next-day onto the
// day whose board it should read. (Audit finding 2026-08-05: the 11pm cron
// fired at 1:51am ET, read the NEW day's empty board, and skipped the
// 9-player Aug 4 recap.)
const recapChallengeId = todaysChallengeId(new Date(now.getTime() - 12 * 3600 * 1000));

// ---- The Coach's daily drive (deterministic; used by BOTH modes) ----------

function playCoachDrive(id: string = challengeId): { log: DriveLog; spend: number; roster: DraftedRoster; rosterData: DraftedRosterData } {
  // Draft that day's board like a sensible human: balanced spend under the cap.
  const pricing = getPricing(manifest.players);
  const { cap } = capForChallenge(id);
  const board = drawSlotOptions(pricing.dealablePlayers, dailyDraftRng(id));
  const botRng = makeRng(seedFromString(`${id}:coachbot`));

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

  // Play the drive with a plain-vanilla policy.
  const rosterData: DraftedRosterData = {
    qb: loadData(roster.qb.gsisId) as PlayerDataset,
    rb: loadData(roster.rb.gsisId) as PlayerDataset,
    wr1: loadData(roster.wr1.gsisId) as PlayerDataset,
    wr2: loadData(roster.wr2.gsisId) as PlayerDataset,
    te: loadData(roster.te.gsisId) as PlayerDataset,
    k: loadData(roster.k.gsisId) as KickerDataset,
  };
  const session = createDriveSession(rosterData, DEFAULT_SCENARIO, manifest.leagueAverageRates, manifest.leagueAverageKickerRates, dailyDriveSeed(id));
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
  return { log: session.getLog(), spend, roster: roster as DraftedRoster, rosterData };
}

// ---- Compose: morning challenge --------------------------------------------

function composeChallenge(): { post: string; url: string } {
  const { log, spend } = playCoachDrive();

  // Plain link, owner call 2026-07-27: a stranger's first tap should land on
  // the DRAFT (the acquisition hook), not inside the Coach's roster. The
  // one-tap ghost race stays for friend-to-friend shares from the app.
  const url = ORIGIN;

  const dateLabel = now.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
  const grid = buildDriveGrid(log);
  const scoreLine = log.won
    ? `🤖 ${BOT_NAME}: ${log.score} pts on a $${spend} squad. Beat his drive ▶`
    : log.score > 0
      ? `🤖 ${BOT_NAME} stalled out: ${log.score} pts. Punish him ▶`
      : `🤖 ${BOT_NAME} laid an egg: 0 pts. Do literally anything better ▶`;
  let post = [`🏈 Today's drill is live (${dateLabel}) — same board for everyone, one shot.`, grid, `${scoreLine} ${url}`].join("\n");
  if (post.length > 292) post = [`🏈 Today's drill is live (${dateLabel}).`, `${scoreLine} ${url}`].join("\n");
  return { post, url };
}

// ---- Compose: evening recap -------------------------------------------------

interface BoardRow {
  name: string;
  score: number;
  spend: number | null;
}

export function composeRecap(rows: BoardRow[], coachScore: number, dateLabel: string): string | null {
  // One entry per PERSON: the board already holds one post per device (its
  // first -- migration 015); a name on two devices keeps its best (never
  // inflate the count), and the bot's own row never counts as a player.
  const best = new Map<string, BoardRow>();
  for (const r of rows) {
    if (r.name === BOT_NAME) continue;
    const prev = best.get(r.name);
    if (!prev || r.score > prev.score) best.set(r.name, r);
  }
  const players = [...best.values()];
  if (players.length < MIN_RECAP_PLAYERS) return null;
  const beatCoach = players.filter((r) => r.score > coachScore).length;
  const top = players.reduce((a, b) => (b.score > a.score ? b : a));

  const topLine = top.spend !== null ? `🥇 ${top.score} pts on a $${top.spend} squad.` : `🥇 Top drive: ${top.score} pts.`;
  const coachLine =
    beatCoach === 0
      ? `🤖 ${BOT_NAME}'s ${coachScore} held up against all ${players.length} of them. Unacceptable.`
      : `${players.length} played · ${beatCoach} beat ${BOT_NAME}'s ${coachScore}.`;
  let post = [`🌙 The ${dateLabel} drill is in the books.`, coachLine, topLine, `Fresh board at midnight ET ▶ ${ORIGIN}`].join("\n");
  if (post.length > 292) post = [coachLine, `Fresh board at midnight ▶ ${ORIGIN}`].join("\n");
  return post;
}

// ---- Compose: weekly winner -------------------------------------------------

interface WeekRow {
  name: string;
  week_points: number;
  days_played: number;
  total_spend: number | null;
}

/** Rows arrive already ranked (points, then the cheaper squad, then who got
 * there first -- the view's own order). `nextWeek` is null after the final
 * week: the season closes instead of promising another race. */
export function composeWeekly(rows: WeekRow[], week: number, nextWeek: number | null): string | null {
  const players = rows.filter((r) => r.name !== BOT_NAME && r.name !== "Anonymous");
  if (players.length < MIN_RECAP_PLAYERS) return null;
  const [winner, ...rest] = players;
  const drills = `${winner.days_played} drill${winner.days_played === 1 ? "" : "s"}`;
  const podium = rest
    .slice(0, 2)
    .map((r, i) => `${i === 0 ? "🥈" : "🥉"} ${r.name} ${r.week_points}`)
    .join(" · ");
  const opener =
    nextWeek === null
      ? `That's a wrap on the ${SEASON_LABEL}. Thanks for every drive ▶ ${ORIGIN}`
      : `Week ${nextWeek} starts now — fresh race, every drill counts ▶ ${ORIGIN}`;
  let post = [`🏆 Week ${week} is in the books. ${winner.name} takes it — ${winner.week_points} pts over ${drills}.`, podium, opener]
    .filter(Boolean)
    .join("\n");
  if (post.length > 292) post = [`🏆 Week ${week}: ${winner.name} wins with ${winner.week_points} pts.`, opener].join("\n");
  return post;
}

// ---- Public board reads (anon key; both values are public by design) ---------

function boardHeaders(): { url: string; headers: Record<string, string> } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("board reads need SUPABASE_URL + SUPABASE_ANON_KEY");
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

async function fetchBoard(id: string): Promise<BoardRow[]> {
  const { url, headers } = boardHeaders();
  const res = await fetch(
    `${url}/rest/v1/daily_entries?select=name,score,spend&challenge_date=eq.${id}&order=score.desc&limit=200`,
    { headers }
  );
  if (!res.ok) throw new Error(`board fetch failed: HTTP ${res.status}`);
  return (await res.json()) as BoardRow[];
}

async function fetchWeekTop(weekStart: string): Promise<WeekRow[]> {
  const { url, headers } = boardHeaders();
  const res = await fetch(
    `${url}/rest/v1/weekly_totals?select=name,week_points,days_played,total_spend&week_start=eq.${weekStart}` +
      `&order=week_points.desc,total_spend.asc.nullslast,last_played_at.asc&limit=10`,
    { headers }
  );
  if (!res.ok) throw new Error(`week fetch failed: HTTP ${res.status}`);
  return (await res.json()) as WeekRow[];
}

// ---- Post (each platform independently gated on its secrets) ----------------

const dryRun = process.env.SKIP_POST === "1";

async function postBluesky(post: string, url: string): Promise<void> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password || dryRun) return console.log("bluesky: skipped");
  configuredPlatforms++;
  const sess = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`bsky auth ${r.status}`))));
  // Make the URL clickable: facet over its byte range (posts end with the URL).
  const bytes = new TextEncoder().encode(post);
  const urlBytes = new TextEncoder().encode(url);
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
  if (!res.ok) throw new Error(`bluesky: FAILED ${res.status} ${await res.text()}`);
  console.log("bluesky: posted");
}

async function postX(post: string): Promise<void> {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET || dryRun) return console.log("x: skipped");
  configuredPlatforms++;
  const { TwitterApi } = await import("twitter-api-v2");
  const client = new TwitterApi({ appKey: X_APP_KEY, appSecret: X_APP_SECRET, accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_SECRET });
  await client.v2.tweet(post);
  console.log("x: posted");
}

// A platform with secrets configured that fails to post must turn the run red
// (GitHub then emails the owner) -- a green run with no post is how outages
// go unnoticed for a week. Unconfigured platforms still skip silently.
let configuredPlatforms = 0;

async function publish(kind: string, post: string, url: string, id: string = challengeId): Promise<void> {
  console.log("---- post ----\n" + post + "\n--------------");
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${BOT_NAME} ${kind} — ${id}\n\n\`\`\`\n${post}\n\`\`\`\n`);
  }
  const results = await Promise.allSettled([postBluesky(post, url), postX(post)]);
  const failures = results.filter((r) => r.status === "rejected");
  for (const r of failures) console.error((r as PromiseRejectedResult).reason);
  if (failures.length > 0) {
    console.error(`::error::${failures.length} of ${configuredPlatforms} configured platform(s) failed to post`);
    process.exitCode = 1;
  }
}

// ---- Mode dispatch (only when run as a script -- import stays side-effect-free
// so the compose functions are testable) --------------------------------------

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (isMain) {
  const mode = process.env.BOT_MODE === "recap" || process.env.BOT_MODE === "weekly" ? process.env.BOT_MODE : "challenge";
  if (mode === "recap") {
    const rows = await fetchBoard(recapChallengeId);
    const post = composeRecap(
      rows,
      playCoachDrive(recapChallengeId).log.score,
      formatChallengeDate(recapChallengeId).replace(/, \d{4}$/, "") // "Aug 5", not a legal notice
    );
    if (post === null) {
      console.log(`recap: skipped -- quiet day (${rows.length} rows, need ${MIN_RECAP_PLAYERS}+ non-bot players)`);
    } else {
      await publish("recap", post, ORIGIN, recapChallengeId);
    }
  } else if (mode === "weekly") {
    const done = lastCompletedWeekStart(challengeId);
    if (done === null) {
      console.log(`weekly: skipped -- no completed week yet as of ${challengeId}`);
    } else {
      const week = weekNumberFor(done);
      const finale = weekEndFor(done) >= SEASON_END;
      const rows = await fetchWeekTop(done);
      const post = composeWeekly(rows, week, finale ? null : week + 1);
      if (post === null) {
        console.log(`weekly: skipped -- quiet week ${week} (${rows.length} rows, need ${MIN_RECAP_PLAYERS}+ named players)`);
      } else {
        await publish("weekly", post, ORIGIN, done);
      }
    }
  } else {
    const { post, url } = composeChallenge();
    await publish("challenge", post, url);
  }
}
