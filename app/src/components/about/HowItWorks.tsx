import { useState } from "react";
import "./howItWorks.css";

/** Footer link + modal explaining where OVR ratings, play outcomes, and the
 * final score come from. Self-contained (own open state) so it can sit anywhere. */
export function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="how-it-works-link" onClick={() => setOpen(true)}>
        How it works
      </button>

      {open && (
        <div className="hiw-overlay" role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setOpen(false)}>
          <div className="hiw-modal" onClick={(e) => e.stopPropagation()}>
            <header className="hiw-header">
              <h2 className="hiw-heading">How it works</h2>
              <button type="button" className="hiw-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </header>

            <div className="hiw-body">
              <section className="hiw-section">
                <h3>🏈 Overall ratings (OVR)</h3>
                <p>
                  Every player’s OVR (40–99) is computed from their <strong>real NFL stats, 2015–2025</strong>{" "}
                  (nflverse / nflfastR) — no hand-picked tiers. QBs blend passing efficiency, dual-threat rushing,
                  and career volume; running backs come from rushing production; receivers and tight ends from
                  their catch and yardage rates; kickers from make rate, with a bonus for long-range accuracy.
                  Better real production → higher OVR.
                </p>
                <p className="hiw-note">
                  Because it’s pure production, some <strong>recent rookies and high-volume young players</strong> on
                  struggling offenses can rate lower than their reputation — the numbers only see efficiency, not
                  hype, and a rookie has just a season or two of data. Remember a <strong>lower OVR isn’t all bad
                  here</strong>: it hands you a bigger scoring multiplier, so an underrated player can be a smart
                  pick.
                </p>
              </section>

              <section className="hiw-section">
                <h3>🎲 How plays are decided</h3>
                <p>
                  Each play is sampled from that player’s <strong>actual historical plays in a similar
                  situation</strong> (down, distance, field position). When a situation is too rare to sample, it
                  falls back to broader samples, then to the player’s season-long rates.
                </p>
                <p>
                  A pass combines both players: <strong>interception risk</strong> leans on the QB (75%) with some
                  receiver influence (25%), while <strong>completions and yardage</strong> lean on the receiver
                  (75%) plus the QB (25%). The QB also drives sack avoidance and scramble chance.
                </p>
              </section>

              <section className="hiw-section">
                <h3>💯 How your score is calculated</h3>
                <p>You only score by winning the drive. Then a base value gets multiplied twice:</p>
                <ul className="hiw-list">
                  <li>
                    <strong>Base:</strong> Touchdown = 100 pts · Field goal = 40 pts.
                  </li>
                  <li>
                    <strong>Roster strength:</strong> a weaker team multiplies the score up — ×1.0 at 99 OVR up to
                    ×2.0 at 40 OVR. <em>Upsets pay.</em>
                  </li>
                  <li>
                    <strong>Time bonus:</strong> the less time on the clock when you score, the bigger the
                    multiplier — ×1.0 with 2:00+ left, up to ×2.0 at 0:00.
                  </li>
                </ul>
                <p className="hiw-formula">Final score = base × roster × time · (any loss scores 0)</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
