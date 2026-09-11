import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todaysChallengeId } from "../daily/dailyChallenge";
import {
  dailyRecordKey,
  getDailyRecord,
  markDailySubmitted,
  saveDailyRecord,
  type DailyRecord,
} from "../daily/dailyState";
import { isRookie } from "./rookie";
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
  /** Re-read today's record from storage -- another tab may have banked the
   * drill since this page loaded -- and return it (null = still unplayed). */
  syncDaily: () => DailyRecord | null;
}

const ModeContext = createContext<ModeContextValue | null>(null);

/** Tracks whether the player is on the shared Daily Challenge (the default) or
 * Free Play, plus today's one-shot record. Lives below GameStateProvider so a
 * mode switch can reset the board to the draft screen. */
export function ModeProvider({ children }: { children: ReactNode }) {
  const dispatch = useGameDispatch();
  const challengeId = useMemo(() => todaysChallengeId(), []);
  // Rookies start in free play (the practice drive) so their first-ever game
  // can't burn the one-shot daily; everyone else lands on the daily as usual.
  const [mode, setModeState] = useState<Mode>(() => (isRookie() ? "free" : "daily"));
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

  // Storage is the truth: the copy read at mount goes stale the moment another
  // tab finishes the drill (by Sep 11, 9 devices had posted a daily twice that
  // way). Memory only ever GAINS a record here, so a storage failure or a
  // cleared key can't reopen a drill this page already saw played.
  const syncDaily = useCallback(() => {
    const stored = getDailyRecord(challengeId);
    if (stored) setDailyRecord(stored);
    return stored;
  }, [challengeId]);

  // `storage` fires only in OTHER tabs -- exactly the ones holding a stale copy.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === dailyRecordKey(challengeId)) syncDaily();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [challengeId, syncDaily]);

  const value = useMemo(
    () => ({ mode, challengeId, dailyRecord, setMode, saveDaily, markSubmitted, syncDaily }),
    [mode, challengeId, dailyRecord, setMode, saveDaily, markSubmitted, syncDaily]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
