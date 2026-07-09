// The single stylesheet injected into the Glim shadow root. Everything that
// animates does so via transform/opacity only — zero layout thrash in the host app.
export const glimStyles = `
:host {
  --glim-hue: 205;
  --glim-surface: hsl(222 16% 14%);
  --glim-text: hsl(220 20% 92%);
}

.glim-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* ---- character: layered glowing orb ---- */

.glim-orb {
  position: fixed;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  pointer-events: none;
  will-change: transform;
}

.glim-orb-core,
.glim-orb-bloom,
.glim-orb-halo {
  position: absolute;
  border-radius: 50%;
  animation: glim-breathe 3s ease-in-out infinite;
}

.glim-orb-core {
  inset: 8px;
  background: radial-gradient(
    circle,
    hsl(var(--glim-hue) 100% 95%) 0%,
    hsl(var(--glim-hue) 95% 72%) 55%,
    hsl(var(--glim-hue) 95% 72% / 0) 75%
  );
}

.glim-orb-bloom {
  inset: -8px;
  background: radial-gradient(
    circle,
    hsl(var(--glim-hue) 90% 65% / 0.45) 0%,
    hsl(var(--glim-hue) 90% 65% / 0) 65%
  );
}

.glim-orb-halo {
  inset: -24px;
  background: radial-gradient(
    circle,
    hsl(var(--glim-hue) 85% 60% / 0.16) 0%,
    hsl(var(--glim-hue) 85% 60% / 0) 60%
  );
}

@keyframes glim-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

/* ---- particle trail (rendered only during flight) ---- */

.glim-particle {
  position: absolute;
  top: 17px;
  left: 17px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--glim-hue) 95% 78%);
  opacity: 0;
  animation: glim-particle-fade 600ms linear infinite;
}

@keyframes glim-particle-fade {
  0% { opacity: 0.8; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(-14px, 6px) scale(0.5); }
}

/* ---- speech bubble ---- */

.glim-bubble {
  position: fixed;
  top: 0;
  left: 0;
  max-width: 36ch;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--glim-surface);
  color: var(--glim-text);
  font-size: 14.5px;
  line-height: 1.5;
  box-shadow:
    0 2px 8px hsl(222 40% 4% / 0.35),
    0 16px 40px hsl(222 40% 4% / 0.25);
  pointer-events: none;
  will-change: transform;
}

.glim-word {
  animation: glim-word-in 120ms ease-out both;
}

@keyframes glim-word-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ---- launcher ---- */

.glim-launcher {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  cursor: pointer;
}

.glim-launcher-button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--glim-surface);
  color: hsl(var(--glim-hue) 95% 78%);
  font-size: 18px;
  cursor: pointer;
  box-shadow:
    0 2px 8px hsl(222 40% 4% / 0.35),
    0 12px 28px hsl(222 40% 4% / 0.25);
  transition: transform 150ms ease-out;
}

.glim-launcher-button:hover {
  transform: scale(1.06);
}

.glim-launcher-input {
  width: 240px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid hsl(var(--glim-hue) 30% 40% / 0.5);
  background: var(--glim-surface);
  color: var(--glim-text);
  font-size: 14.5px;
  line-height: 1.5;
  outline: none;
}

/* ---- reduced motion: kill breathing, particles, word fades, transitions ---- */

@media (prefers-reduced-motion: reduce) {
  .glim-orb-core,
  .glim-orb-bloom,
  .glim-orb-halo,
  .glim-particle,
  .glim-word {
    animation: none;
  }
  .glim-launcher-button {
    transition: none;
  }
}

.glim-reduced .glim-orb-core,
.glim-reduced .glim-orb-bloom,
.glim-reduced .glim-orb-halo,
.glim-reduced .glim-particle,
.glim-reduced .glim-word {
  animation: none;
}

.glim-reduced .glim-launcher-button {
  transition: none;
}
`
