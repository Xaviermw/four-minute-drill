import { useEffect, useState } from "react";
import { useManifest } from "../../data/dataContext";
import { dailyDraftRng } from "../../daily/dailyChallenge";
import { drawSlotOptions } from "../../draft/draftPool";
import { getPricing } from "../../draft/pricing";
import { fetchDailyPicks, type DailyPickCounts } from "../../leaderboard/leaderboardApi";
import { isLeaderboardEnabled } from "../../leaderboard/supabaseClient";
import { LINEUP_SLOT_ORDER } from "../../share/lineupCode";
import type { RosterSlotKey } from "../../types/roster";
import "./result.css";

const SLOT_LABEL: Record<RosterSlotKey, string> = {
  qb: "QB",
  rb: "RB",
  wr1: "WR 1",
  wr2: "WR 2",
  te: "TE",
  k: "K",
};

/**
 * "How the field drafted" -- for each slot, the share of today's entrants who
 * took each of the three offered cards. Only the daily can do this honestly:
 * its board is deterministic from the date, so the same three options faced
 * everyone and the percentages are comparable. Hidden until the day has
 * enough entries to mean something.
 */
export function FieldDraftPanel({
  challengeId,
  myIds,
  refreshKey = 0,
}: {
  challengeId: string;
  myIds: string[];
  /** Bump after a submit so your own entry joins the counts. */
  refreshKey?: number;
}) {
  const { manifest } = useManifest();
  const [data, setData] = useState<DailyPickCounts | null>(null);

  useEffect(() => {
    if (!isLeaderboardEnabled) return;
    let cancelled = false;
    fetchDailyPicks(challengeId)
      .then((d) => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [challengeId, refreshKey]);

  if (!data || !manifest) return null;

  // The board everyone was dealt, rebuilt from the date -- never stored. This
  // is only sound while pricing is frozen: the pool feeds the deal, so a
  // pricing change would silently reconstruct a board nobody was offered.
  const pricing = getPricing(manifest.players);
  const board = drawSlotOptions(pricing.dealablePlayers, dailyDraftRng(challengeId));
  const mine = new Set(myIds);

  // Guard: if the reconstruction can't explain ANY pick, it isn't the board
  // these players saw -- say nothing rather than something false.
  const explained = LINEUP_SLOT_ORDER.reduce(
    (sum, slot) => sum + (board[slot] ?? []).reduce((n, p) => n + (data.picks[p.gsisId] ?? 0), 0),
    0
  );
  if (explained === 0) return null;

  return (
    <section className="field-draft">
      <p className="eyebrow">How the field drafted</p>
      <p className="field-draft-sub">{data.entries} players took today's drill.</p>
      <div className="field-draft-slots">
        {LINEUP_SLOT_ORDER.map((slot) => {
          const options = board[slot] ?? [];
          return (
            <div className="fd-slot" key={slot}>
              <span className="fd-slot-label">{SLOT_LABEL[slot]}</span>
              <div className="fd-bars">
                {(() => {
                  const offeredPicks = options.reduce((n, p) => n + (data.picks[p.gsisId] ?? 0), 0);
                  const scrubPct = Math.max(0, Math.round(((data.entries - offeredPicks) / data.entries) * 100));
                  return scrubPct > 0 ? (
                    <div className="fd-bar is-scrub" key="scrub">
                      <div className="fd-bar-fill" style={{ width: `${scrubPct}%` }} />
                      <span className="fd-bar-name">Took a $0 scrub</span>
                      <span className="fd-bar-pct">{scrubPct}%</span>
                    </div>
                  ) : null;
                })()}
                {options.map((p) => {
                  const pct = Math.round(((data.picks[p.gsisId] ?? 0) / data.entries) * 100);
                  const isMine = mine.has(p.gsisId);
                  return (
                    <div className={`fd-bar ${isMine ? "is-mine" : ""}`} key={p.gsisId}>
                      <div className="fd-bar-fill" style={{ width: `${pct}%` }} />
                      <span className="fd-bar-name">
                        {p.displayName}
                        {isMine && <span className="fd-you">you</span>}
                      </span>
                      <span className="fd-bar-pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="field-draft-note">
        Percentages count everyone who posted a score today, including the players who ran out of cap and took the
        $0 scrub.
      </p>
    </section>
  );
}
