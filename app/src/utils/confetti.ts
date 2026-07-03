// Dependency-free confetti burst via the Web Animations API. Spawns short-lived
// absolutely-positioned squares at an element's center and cleans them up on
// finish. No-op under reduced-motion.
const COLORS = ["#ffc233", "#34e07a", "#5b9dff", "#f1556a"];

export function burstConfetti(target: HTMLElement, count = 14): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 3;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const size = 7 + Math.random() * 5;
    el.style.cssText =
      `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;` +
      `background:${COLORS[i % COLORS.length]};border-radius:2px;pointer-events:none;` +
      `z-index:9999;will-change:transform,opacity;`;
    document.body.appendChild(el);

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // fan upward
    const dist = 80 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist; // negative = up
    const rot = (Math.random() - 0.5) * 720;
    const dur = 700 + Math.random() * 600;

    const anim = el.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx * 1.1}px, ${dy + 240}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
    const cleanup = () => el.remove();
    anim.onfinish = cleanup;
    anim.oncancel = cleanup;
  }
}
