import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { GhostDrive } from "./ghost";

/**
 * Holds the ghost drive a shared link carried (null when none / replay failed).
 * Survives "Run It Back" on the same lineup -- re-racing the ghost is the fun --
 * and is cleared when the player leaves the shared flow for a fresh draft.
 */
interface GhostContextValue {
  ghost: GhostDrive | null;
  setGhost: (g: GhostDrive | null) => void;
}

const GhostContext = createContext<GhostContextValue | null>(null);

export function GhostProvider({ children }: { children: ReactNode }) {
  const [ghost, setGhost] = useState<GhostDrive | null>(null);
  const value = useMemo(() => ({ ghost, setGhost }), [ghost]);
  return <GhostContext.Provider value={value}>{children}</GhostContext.Provider>;
}

export function useGhost(): GhostContextValue {
  const ctx = useContext(GhostContext);
  if (!ctx) throw new Error("useGhost must be used within GhostProvider");
  return ctx;
}
