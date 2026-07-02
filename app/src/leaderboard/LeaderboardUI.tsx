import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Lazy so the leaderboard modal (+ its supabase code path) stays out of the
// initial bundle; only loaded when a player opens it.
const LeaderboardScreen = lazy(() =>
  import("./LeaderboardScreen").then((m) => ({ default: m.LeaderboardScreen }))
);

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
      {isOpen && (
        <Suspense fallback={null}>
          <LeaderboardScreen onClose={close} />
        </Suspense>
      )}
    </LeaderboardUIContext.Provider>
  );
}

export function useLeaderboardUI() {
  return useContext(LeaderboardUIContext);
}
