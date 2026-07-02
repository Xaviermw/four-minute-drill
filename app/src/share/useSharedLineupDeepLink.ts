import { useEffect, useRef, useState } from "react";
import { useManifest } from "../data/dataContext";
import { startDrive } from "../data/startDrive";
import { useGameDispatch } from "../state/GameStateProvider";
import { clearTeamParam, readTeamToken, rosterFromToken } from "./sharedLineup";

/**
 * On first load, if the URL carries a `?team=` token, reconstruct that lineup
 * and jump straight into a drive (skipping the draft). Returns whether a shared
 * lineup is currently in play so the UI can show a banner. Falls back silently
 * to the normal draft flow on any malformed/unknown token.
 */
export function useSharedLineupDeepLink(): boolean {
  const { manifest } = useManifest();
  const dispatch = useGameDispatch();
  // Capture the token once, before we strip it from the URL.
  const tokenRef = useRef<string | null>(readTeamToken());
  const startedRef = useRef(false);
  const [sharedActive, setSharedActive] = useState(false);

  useEffect(() => {
    if (startedRef.current || !manifest || !tokenRef.current) return;
    const roster = rosterFromToken(tokenRef.current, manifest);
    clearTeamParam();
    tokenRef.current = null;
    if (!roster) return; // bad token -> stay on the normal draft screen
    startedRef.current = true;

    startDrive(roster, manifest)
      .then(({ scenario, session }) => {
        dispatch({ type: "DRIVE_STARTED", roster, scenario, session });
        setSharedActive(true);
      })
      .catch(() => {
        // Loading the datasets failed; drop back to draft.
        startedRef.current = false;
      });
  }, [manifest, dispatch]);

  return sharedActive;
}
