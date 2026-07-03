import { useRef, useState } from "react";
import { useModalBehavior } from "../../utils/useModalBehavior";
import "./howItWorks.css";

/** Footer link + modal explaining where payout, play outcomes, and the final
 * score come from. Self-contained (own open state) so it can sit anywhere. */
export function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="how-it-works-link" onClick={() => setOpen(true)}>
        How it works
      </button>
      {open && <HowItWorksModal onClose={() => setOpen(false)} />}
    </>
  );
}

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalBehavior(modalRef, onClose);

  return (
    <div className="hiw-overlay" role="dialog" aria-modal="true" aria-label="How it works" onClick={onClose}>
      <div className="hiw-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <header className="hiw-header">
              <h2 className="hiw-heading">How it works</h2>
              <button type="button" className="hiw-close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </header>

            <div className="hiw-body">
              <section className="hiw-section">
                <h3>🏈 Payout — the number on each card</h3>
                <p>
                  Each card shows a <strong>payout multiplier</strong> (×1.0–×2.0): the weaker the player, the bigger
                  the payout, so a card’s number is exactly what it does to your score. It’s derived from that
                  player’s <strong>real NFL production, 2015–2025</strong> (nflverse / nflfastR) — stronger players
                  (better passing, rushing, catching, kicking) get a <em>smaller</em> payout. Your team’s payout is
                  the average of its six players’.
                </p>
                <p className="hiw-note">
                  The catch: a big payout means a <strong>weaker squad that’s harder to actually score with</strong>.
                  The game is that gamble — draft strong enough to win, weak enough to cash in. (Stat lines are shown
                  so you can judge a player even without a familiar name.)
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
                    <strong>Roster payout:</strong> your team’s payout multiplier — ×1.0 for a stacked squad up to
                    ×2.0 for pure underdogs. <em>Upsets pay.</em>
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
  );
}
