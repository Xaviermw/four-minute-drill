import { useRef, useState } from "react";
import { useModalBehavior } from "../../utils/useModalBehavior";
import "./howItWorks.css";

/** Footer link + modal explaining prices, play outcomes, and the final
 * score. Self-contained (own open state) so it can sit anywhere. */
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
                <h3>💵 The $25 cap — every card has a price</h3>
                <p>
                  Each card wears a <strong>price tag, $1–$10</strong>, from that player’s <strong>real NFL
                  production, 2015–2025</strong> (nflverse / nflfastR) — the better the player ranks at his
                  position, the more he costs. You get <strong>$25 for all six picks</strong>: roughly one stud and
                  bargains, or a balanced build. Cards you can’t afford lock.
                </p>
                <p className="hiw-note">
                  Out of money? <strong>Scrubs are always $0</strong> — the dice button assigns a random
                  bottom-of-the-barrel player, so you can never get stuck. You just don’t get to pick who. (Stat
                  lines are shown so you can judge a player even without a familiar name.)
                </p>
              </section>

              <section className="hiw-section">
                <h3>🎲 How plays are decided</h3>
                <p>
                  Every down, your whole offense is on the field — <strong>one spot per player</strong>. Each
                  receiver's <strong>depth is dealt</strong>, your back's run look is dealt too (inside or outside,
                  whatever the front gives), and the QB keeper is always there. Tap anyone.
                </p>
                <p>
                  The result is sampled from that player’s <strong>actual historical plays in a similar
                  situation</strong> (down, distance, field position — and for runs, inside vs. outside). When a
                  situation is too rare to sample, it falls back to broader samples, then to the player’s
                  season-long rates.
                </p>
                <p>
                  A pass combines both players: <strong>interception risk</strong> leans on the QB (75%) with some
                  receiver influence (25%), while <strong>completions and yardage</strong> lean on the receiver
                  (75%) plus the QB (25%). The QB also drives sack avoidance and scramble chance.
                </p>
              </section>

              <section className="hiw-section">
                <h3>💯 How your score is calculated</h3>
                <ul className="hiw-list">
                  <li>
                    <strong>Win the drive:</strong> Touchdown = 100 pts · Field goal = 40 pts.
                  </li>
                  <li>
                    <strong>Clutch bonus:</strong> the less time on the clock when you score, the bigger the
                    multiplier — ×1.0 with 2:00+ left, up to ×2.0 at 0:00. Milking the clock is the play.
                  </li>
                  <li>
                    <strong>Two-minute warning:</strong> the first time the clock crosses 2:00 it stops, free —
                    just like Sundays. It hands you a dead ball right as the clutch bonus starts building.
                  </li>
                  <li>
                    <strong>Come up short?</strong> You still bank <strong>half a point per yard</strong> your
                    drive advanced — a deep stall beats a three-and-out.
                  </li>
                </ul>
                <p className="hiw-formula">Win = base × clutch · Loss = yards ÷ 2</p>
              </section>
            </div>
          </div>
        </div>
  );
}
