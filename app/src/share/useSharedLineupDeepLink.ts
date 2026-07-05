import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../analytics/track";
import { useManifest } from "../data/dataContext";
import { startDrive } from "../data/startDrive";
import { useGameDispatch } from "../state/GameStateProvider";
import { useMode } from "../state/ModeProvider";
import { parseGhostParam, replayGhost } from "./ghost";
import { useGhost } from "./GhostProvider";
import { clearTeamParam, readTeamToken, rosterFromToken } from "./sharedLineup";

/**
 * On first load, if the URL carries a `?team=` token, reconstruct that lineup
 * and jump straight into a drive (skipping the draft). When the link also
 * carries a ghost (`g=`), replay the sharer's exact drive first so the friend
 * races it clock-synced on the same field. Returns whether a shared lineup is
 * in play so the UI can show a banner. Falls back silently on any malformed
 * token; a failed ghost degrades to the plain "beat their score" flow.
 */
export function useSharedLineupDeepLink(): boolean {
  const { manifest } = useManifest();
  const dispatch = useGameDispatch();
  const { setMode } = useMode();
  const { setGhost } = useGhost();
  // Capture the params once, before we strip them from the URL.
  const tokenRef = useRef<string | null>(readTeamToken());
  const ghostRef = useRef(parseGhostParam());
  const startedRef = useRef(false);
  const [sharedActive, setSharedActive] = useState(false);

  useEffect(() => {
    if (startedRef.current || !manifest || !tokenRef.current) return;
    const roster = rosterFromToken(tokenRef.current, manifest);
    clearTeamParam();
    tokenRef.current = null;
    if (!roster) return; // bad token -> stay on the normal draft screen
    startedRef.current = true;
    trackEvent("lineup_link_opened", { ghost: Boolean(ghostRef.current) }); // the viral entry

    const parsedGhost = ghostRef.current;
    ghostRef.current = null;

    startDrive(roster, manifest)
      .then(async ({ scenario, session }) => {
        // Replay the ghost before revealing the drive (datasets are already
        // cached from startDrive, so this is compute, not network).
        if (parsedGhost) {
          const ghost = await replayGhost(roster, manifest, parsedGhost).catch(() => null);
          setGhost(ghost);
        }
        // A shared lineup is a free-play drive, not today's daily -- switch
        // mode without resetting the drive we're about to start.
        setMode("free", false);
        dispatch({ type: "DRIVE_STARTED", roster, scenario, session });
        setSharedActive(true);
      })
      .catch(() => {
        // Loading the datasets failed; drop back to draft.
        startedRef.current = false;
      });
  }, [manifest, dispatch, setMode, setGhost]);

  return sharedActive;
}
