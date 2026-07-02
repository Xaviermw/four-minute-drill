/** Snapshots an off-screen card node to a PNG Blob at 2x for crisp social use.
 * html-to-image is imported dynamically so it stays out of the initial bundle
 * (only needed when a player actually saves/shares an image). */
export async function nodeToPngBlob(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    pixelRatio: 2,
    cacheBust: true,
    // The card sets its own background; pass it explicitly so transparent
    // corners don't render black in some viewers.
    backgroundColor: "#0b0f17",
  });
  if (!blob) throw new Error("Could not render the result image.");
  return blob;
}

/** Triggers a browser download of a blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** True when the browser can natively share an image File (mobile mostly). */
export function canShareImage(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob()], "x.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Copies text to the clipboard, returning whether it succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
