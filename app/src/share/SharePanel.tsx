import { useRef, useState } from "react";
import { trackEvent } from "../analytics/track";
import { useManifest } from "../data/dataContext";
import { getPricing } from "../draft/pricing";
import type { DraftedRoster } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { ResultCard } from "./ResultCard";
import { buildShareText } from "./shareText";
import { LINEUP_SLOT_ORDER } from "./lineupCode";
import { canShareImage, copyText, downloadBlob, nodeToPngBlob } from "./shareImage";
import "./sharePanel.css";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

export function SharePanel({ driveLog, roster }: { driveLog: DriveLog; roster: DraftedRoster }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const nativeShare = canShareImage();
  const { manifest } = useManifest();
  const pricing = manifest ? getPricing(manifest.players) : null;
  const spend = pricing ? LINEUP_SLOT_ORDER.reduce((sum, s) => sum + pricing.priceFor(roster[s]), 0) : undefined;
  // Exactly what "Copy result" puts on the clipboard -- shown read-only so the
  // player sees the emoji drive grid before they share it.
  const shareText = buildShareText(driveLog, roster, spend);

  function flash(s: Status) {
    setStatus(s);
    if (s.kind === "ok" || s.kind === "err") {
      setTimeout(() => setStatus({ kind: "idle" }), 2200);
    }
  }

  async function handleCopy() {
    const ok = await copyText(shareText);
    if (ok) trackEvent("result_shared", { method: "copy", won: driveLog.won });
    flash(ok ? { kind: "ok", msg: "Copied!" } : { kind: "err", msg: "Copy failed" });
  }

  async function renderBlob(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    try {
      return await nodeToPngBlob(cardRef.current);
    } catch {
      flash({ kind: "err", msg: "Image failed" });
      return null;
    }
  }

  async function handleSaveImage() {
    flash({ kind: "busy" });
    const blob = await renderBlob();
    if (!blob) return;
    downloadBlob(blob, "four-minute-drill.png");
    trackEvent("result_shared", { method: "image", won: driveLog.won });
    flash({ kind: "ok", msg: "Saved!" });
  }

  async function handleNativeShare() {
    flash({ kind: "busy" });
    const blob = await renderBlob();
    if (!blob) return;
    const file = new File([blob], "four-minute-drill.png", { type: "image/png" });
    try {
      await navigator.share({ text: shareText, files: [file] });
      trackEvent("result_shared", { method: "native", won: driveLog.won });
      flash({ kind: "idle" });
    } catch (err) {
      // AbortError = user dismissed the sheet; not an error worth flagging.
      if (err instanceof DOMException && err.name === "AbortError") flash({ kind: "idle" });
      else flash({ kind: "err", msg: "Share failed" });
    }
  }

  return (
    <div className="share-panel">
      <p className="eyebrow share-panel-title">Share your result</p>
      <pre className="share-preview" aria-label="Share preview">{shareText}</pre>
      <div className="share-actions">
        <button type="button" className="share-button" onClick={handleCopy} disabled={status.kind === "busy"}>
          📋 Copy result
        </button>
        <button type="button" className="share-button" onClick={handleSaveImage} disabled={status.kind === "busy"}>
          🖼️ Save image
        </button>
        {nativeShare && (
          <button
            type="button"
            className="share-button"
            onClick={handleNativeShare}
            disabled={status.kind === "busy"}
          >
            📲 Share
          </button>
        )}
      </div>
      {(status.kind === "ok" || status.kind === "err") && (
        <p className={`share-status ${status.kind}`} role="status">
          {status.msg}
        </p>
      )}

      {/* Off-screen card that gets snapshotted to PNG. */}
      <div className="share-card-offscreen" aria-hidden="true">
        <ResultCard ref={cardRef} driveLog={driveLog} roster={roster} spend={spend} priceFor={pricing?.priceFor} />
      </div>
    </div>
  );
}
