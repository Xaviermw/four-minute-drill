import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LeaderboardScreen } from "./LeaderboardScreen";

interface LeaderboardUIValue {
  open: () => void;
}

const LeaderboardUIContext = createContext<LeaderboardUIValue>({ open: () => {} });

/** Holds the leaderboard overlay's open/close state and renders it on top of
 * the app. Any descendant can trigger it via `useLeaderboardUI().open()`. */
export function LeaderboardUIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <LeaderboardUIContext.Provider value={value}>
      {children}
      {isOpen && <LeaderboardScreen onClose={close} />}
    </LeaderboardUIContext.Provider>
  );
}

export function useLeaderboardUI() {
  return useContext(LeaderboardUIContext);
}
