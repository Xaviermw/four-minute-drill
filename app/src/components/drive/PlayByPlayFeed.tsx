import type { PlayResult } from "../../types/simResult";
import { formatBallOn, ordinalDown } from "../../utils/formatting";
import "./drive.css";

export function PlayByPlayFeed({ plays }: { plays: PlayResult[] }) {
  return (
    <ul className="play-feed">
      {plays.map((p) => (
        <li key={p.playNumber} className={p.outcome.isTouchdown ? "touchdown" : p.outcome.isTurnover ? "turnover" : ""}>
          <span className="play-situation">
            {ordinalDown(p.down)} &amp; {p.distance} · {formatBallOn(p.fieldPosition)}
          </span>
          <span className="play-description">{p.description}</span>
          {p.twoMinuteWarning && <span className="play-two-minute">⏱ Two-minute warning</span>}
        </li>
      ))}
    </ul>
  );
}
