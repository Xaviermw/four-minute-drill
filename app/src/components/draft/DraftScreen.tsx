import { useMemo, useState } from "react";
import { useManifest } from "../../data/dataContext";
import { startDrive } from "../../data/startDrive";
import { useGameDispatch } from "../../state/GameStateProvider";
import type { ManifestPlayerEntry, Position } from "../../types/player";
import type { DraftedRoster, RosterSlotKey } from "../../types/roster";
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

function pickRandom3(pool: ManifestPlayerEntry[]): ManifestPlayerEntry[] {
  const copy = [...pool];
  const drawn: ManifestPlayerEntry[] = [];
  for (let i = 0; i < 3 && copy.length > 0; i++) {
    const index = Math.floor(Math.random() * copy.length);
    drawn.push(copy[index]);
    copy.splice(index, 1);
  }
  return drawn;
}

/**
 * Draws a fixed, non-rerollable random 3-of-pool for every slot. WR1 and WR2
 * share a position pool, so WR2's draw excludes whichever 3 WR1 already
 * drew -- guarantees the two can never collide no matter which gets picked.
 */
function drawSlotOptions(players: ManifestPlayerEntry[]): Record<RosterSlotKey, ManifestPlayerEntry[]> {
  const byPosition = (position: Position) => players.filter((p) => p.position === position);

  const wrPool = byPosition("WR");
  const wr1Options = pickRandom3(wrPool);
  const wr1Ids = new Set(wr1Options.map((p) => p.gsisId));
  const wr2Options = pickRandom3(wrPool.filter((p) => !wr1Ids.has(p.gsisId)));

  return {
    qb: pickRandom3(byPosition("QB")),
    rb: pickRandom3(byPosition("RB")),
    wr1: wr1Options,
    wr2: wr2Options,
    te: pickRandom3(byPosition("TE")),
    k: pickRandom3(byPosition("K")),
  };
}

const TRANSITION_MS = 220;

export function DraftScreen() {
  const { manifest, error } = useManifest();
  const dispatch = useGameDispatch();
  const [roster, setRoster] = useState<Partial<Record<RosterSlotKey, ManifestPlayerEntry>>>({});
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const slotOptions = useMemo(() => (manifest ? drawSlotOptions(manifest.players) : null), [manifest]);

  if (error) return <div className="screen">Failed to load player data: {error.message}</div>;
  if (!manifest || !slotOptions) return <div className="screen">Loading players...</div>;
  const loadedManifest = manifest;

  function pick(slot: RosterSlotKey, player: ManifestPlayerEntry) {
    setRoster((prev) => ({ ...prev, [slot]: player }));
    setTransitioning(true);
    setTimeout(() => {
      setCurrentSlotIndex((i) => i + 1);
      setTransitioning(false);
    }, TRANSITION_MS);
  }

  async function handleContinue() {
    const finalRoster = roster as DraftedRoster;
    setLoading(true);
    setLoadError(null);
    try {
      const { scenario, session } = await startDrive(finalRoster, loadedManifest);
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
        <span className="eyebrow">Build your team</span>
        <h1>
          Who can you <span className="headline-accent">win</span> with?
        </h1>
        <p className="hint">
          Each position gives you 3 random options — no searching the whole league. The weaker your roster, the
          bigger the score if you somehow pull it off.
        </p>
      </header>
      <TeamPanel slots={SLOTS} roster={roster} />
      {!draftComplete && (
        <div className={`draft-slot-transition ${transitioning ? "fading" : ""}`}>
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
