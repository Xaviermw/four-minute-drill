import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Manifest } from "../types/player";
import { loadManifest } from "./loadManifest";

interface DataContextValue {
  manifest: Manifest | null;
  error: Error | null;
}

const DataContext = createContext<DataContextValue>({ manifest: null, error: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadManifest().then(setManifest).catch(setError);
  }, []);

  return <DataContext.Provider value={{ manifest, error }}>{children}</DataContext.Provider>;
}

export function useManifest() {
  return useContext(DataContext);
}
