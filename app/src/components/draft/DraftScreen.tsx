import { useMemo, useState } from "react";
import { useManifest } from "../../data/dataContext";
import { startDrive } from "../../data/startDrive";
import { dailyDraftRng, dailyDriveSeed } from "../../daily/dailyChallenge";
import { drawSlotOptions } from "../../draft/draftPool";
import { useGameDispatch } from "../../state/GameStateProvider";
import { useMode } from "../../state/ModeProvider";
import type { ManifestPlayerEntry, Position } from "../../types/player";
import type { DraftedRoster, RosterSlotKey } from "../../types/roster";
import { DailyDone } from "../../daily/DailyDone";
import { RosterSlotPicker } from "./RosterSlotPicker";
import { TeamPanel } from "./TeamPanel";
import "./draft.css";

const SLOTS: { key: RosterSlotKey; label: string; position: Position }[] = [
  { key: "qb", label: "Quarterback", position: "QB" },
  { key: "rb", label: "Running Back", position: "RB" },
  { key: "wr1", label: "Wide Receiver 1", position: "WR" },
  { key: "wr2", label: "Wide Receiver 2", position: "WR" },
  { key: "te", label: "Tight End", position: "TE" },
  { key: "k", label: "Kicker", position: "K" },
];

export function DraftScreen() {
  const { manifest, error } = useManifest();
  const dispatch = useGameDispatch();
  const { mode, challengeId, dailyRecord } = useMode();
  const [roster, setRoster] = useState<Partial<Record<RosterSlotKey, ManifestPlayerEntry>>>({});
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !localStorage.getItem("fmd_seen_intro");
    } catch {
      return false;
    }
  });
  const isDaily = mode === "daily";

  function dismissIntro() {
    try {
      localStorage.setItem("fmd_seen_intro", "1");
    } catch {
      /* ignore */
    }
    setShowIntro(false);
  }
  // In daily mode the pool is seeded by the date so everyone gets the same
  // three options per slot; free play redraws randomly on each new draft.
  const slotOptions = useMemo(
    () => (manifest ? drawSlotOptions(manifest.players, isDaily ? dailyDraftRng(challengeId) : Math.random) : null),
    [manifest, isDaily, challengeId]
  );

  if (error) return <div className="screen">Failed to load player data: {error.message}</div>;
  if (!manifest || !slotOptions) return <div className="screen">Loading players...</div>;
  const loadedManifest = manifest;

  // One shot per day: if today's drill is already done, show the recap instead.
  if (isDaily && dailyRecord) return <DailyDone record={dailyRecord} />;

  function pick(slot: RosterSlotKey, player: ManifestPlayerEntry) {
    // Advance immediately -- the draft should feel snappy. The deliberate
    // beat lives in the drive (the ball gliding in with the play result).
    setRoster((prev) => ({ ...prev, [slot]: player }));
    setCurrentSlotIndex((i) => i + 1);
  }

  async function handleContinue() {
    const finalRoster = roster as DraftedRoster;
    setLoading(true);
    setLoadError(null);
    try {
      const seed = isDaily ? dailyDriveSeed(challengeId) : undefined;
      const { scenario, session } = await startDrive(finalRoster, loadedManifest, seed);
      dispatch({ type: "DRIVE_STARTED", roster: finalRoster, scenario, session });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  const draftComplete = currentSlotIndex >= SLOTS.length;

  return (
    <div className="screen draft-screen">
      <header className="draft-header">
        <span className="eyebrow">{isDaily ? "Today's Drill · one shot" : "Build your team"}</span>
        <h1>
          Who can you <span className="headline-accent">win</span> with?
        </h1>
        <p className="hint">
          {isDaily
            ? "Everyone gets the same 3 options at each position today. Draft wisely — you get one attempt."
            : "Each position gives you 3 random options. The weaker your roster, the bigger the score if you somehow pull it off."}
        </p>
      </header>
      {showIntro && (
        <div className="coach-strip">
          <button type="button" className="coach-dismiss" onClick={dismissIntro} aria-label="Dismiss">
            ✕
          </button>
          <ul>
            <li>
              <strong>×Payout</strong> is your score multiplier — weaker players pay more.
            </li>
            <li>
              <strong>You call every play</strong> — run, pass, or kick.
            </li>
            <li>
              <strong>Daily = one shot</strong>, with a new drill at midnight UTC.
            </li>
          </ul>
        </div>
      )}
      <TeamPanel slots={SLOTS} roster={roster} />
      {!draftComplete && (
        <div className="draft-slot-transition">
          <div className="draft-progress">
            <span className="draft-progress-label">On the clock</span>
            <span className="draft-progress-count">
              Pick {currentSlotIndex + 1} <span className="draft-progress-total">/ {SLOTS.length}</span>
            </span>
          </div>
          <RosterSlotPicker
            key={SLOTS[currentSlotIndex].key}
            label={SLOTS[currentSlotIndex].label}
            options={slotOptions[SLOTS[currentSlotIndex].key]}
            selected={null}
            large
            onPick={(player) => pick(SLOTS[currentSlotIndex].key, player)}
          />
        </div>
      )}
      {draftComplete && (
        <div className="draft-recap">
          <p className="draft-recap-note">Your roster is set. Time to take the field.</p>
          {loadError && <p className="error">{loadError}</p>}
          <button type="button" className="cta-button" disabled={loading} onClick={handleContinue}>
            {loading ? "Loading…" : "Run the Drive →"}
          </button>
        </div>
      )}
    </div>
  );
}
