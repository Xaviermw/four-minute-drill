import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { todaysChallengeId } from "../daily/dailyChallenge";
import { getDailyRecord, markDailySubmitted, saveDailyRecord, type DailyRecord } from "../daily/dailyState";
import { useGameDispatch } from "./GameStateProvider";

export type Mode = "daily" | "free";

interface ModeContextValue {
  mode: Mode;
  challengeId: string;
  /** Today's completed daily drill, if any (null until the player finishes it). */
  dailyRecord: DailyRecord | null;
  /** Switch modes. Resets to the draft screen unless `reset` is false (used by
   * the shared-lineup deep link, which switches to free play mid-drive-start). */
  setMode: (m: Mode, reset?: boolean) => void;
  /** Persist a finished daily drill (enforces the one-shot gate). */
  saveDaily: (record: DailyRecord) => void;
  markSubmitted: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

/** Tracks whether the player is on the shared Daily Challenge (the default) or
 * Free Play, plus today's one-shot record. Lives below GameStateProvider so a
 * mode switch can reset the board to the draft screen. */
export function ModeProvider({ children }: { children: ReactNode }) {
  const dispatch = useGameDispatch();
  const challengeId = useMemo(() => todaysChallengeId(), []);
  const [mode, setModeState] = useState<Mode>("daily");
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(() => getDailyRecord(challengeId));

  const setMode = useCallback(
    (m: Mode, reset = true) => {
      setModeState(m);
      if (reset) dispatch({ type: "RESTART" }); // back to the draft screen for the new mode
    },
    [dispatch]
  );

  const saveDaily = useCallback((record: DailyRecord) => {
    saveDailyRecord(record);
    setDailyRecord(record);
  }, []);

  const markSubmitted = useCallback(() => {
    markDailySubmitted(challengeId);
    setDailyRecord((r) => (r ? { ...r, submitted: true } : r));
  }, [challengeId]);

  const value = useMemo(
    () => ({ mode, challengeId, dailyRecord, setMode, saveDaily, markSubmitted }),
    [mode, challengeId, dailyRecord, setMode, saveDaily, markSubmitted]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
