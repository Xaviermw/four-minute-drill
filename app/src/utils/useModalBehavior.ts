import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal a11y: Escape-to-close, focus the first control on open, trap Tab
 * inside the dialog, and restore focus to the opener on unmount. */
export function useModalBehavior(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      ref.current
        ? Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled"))
        : [];

    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [ref, onClose]);
}
