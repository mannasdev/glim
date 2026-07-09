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

/* ---- custom character mount ---- */

/* A custom character (via the GlimProvider \`character\` prop) is placed here and
   carries the same fixed-position translate/rotate/scale transform as the orb,
   so it maps to viewport coordinates and inherits flight + the scale swoop. */
.glim-character-mount {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
}

/* ---- built-in cloud character ---- */

.glim-cloud {
  position: relative;
  width: 72px;
  height: 56px;
  /* Center the cloud on the mount's transform origin so it points from its
     middle, matching the orb which is centered in its 40px box. */
  margin-left: -36px;
  margin-top: -28px;
  pointer-events: none;
}

/* Warm yellow bloom behind the body — the orb's halo idea, in yellow. Keeps the
   cloud legible on both light and dark host pages. */
.glim-cloud-glow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 108px;
  height: 108px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    hsl(45 92% 62% / 0.42) 0%,
    hsl(42 90% 58% / 0.18) 42%,
    hsl(42 90% 58% / 0) 68%
  );
  animation: glim-cloud-breathe 3.4s ease-in-out infinite;
}

.glim-cloud-body {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  /* The whole cloud gently breathes; the glow breathes on its own slightly
     slower rhythm for a soft, layered pulse. */
  animation: glim-cloud-breathe 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px hsl(38 60% 30% / 0.28));
}

.glim-cloud-fill {
  fill: #f5cf56;
}

.glim-cloud-highlight {
  fill: #fbebb5;
  opacity: 0.85;
}

.glim-cloud-blush {
  fill: #f5a25d;
  opacity: 0.6;
}

.glim-cloud-eye {
  fill: #241c14;
}

.glim-cloud-smile {
  stroke: #241c14;
  stroke-width: 2.2;
  stroke-linecap: round;
}

/* Antenna: short stem angled up-right from the top-right lobe. */
.glim-cloud-antenna {
  position: absolute;
  left: 52px;
  top: 8px;
  width: 2px;
  height: 12px;
  background: #f0b429;
  border-radius: 1px;
  transform-origin: bottom center;
  transform: rotate(24deg);
}

.glim-cloud-antenna-ball {
  position: absolute;
  left: 57px;
  top: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffdd7a 0%, #f0b429 70%);
  box-shadow: 0 0 6px hsl(42 92% 55% / 0.6);
  animation: glim-cloud-antenna-bob 3s ease-in-out infinite;
}

@keyframes glim-cloud-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

/* The glow variant re-centers itself while breathing. */
.glim-cloud-glow {
  animation-name: glim-cloud-glow-breathe;
}

@keyframes glim-cloud-glow-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
  50% { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
}

@keyframes glim-cloud-antenna-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.5px); }
}

/* Reduced motion: freeze every cloud animation, matching the orb's handling. */
@media (prefers-reduced-motion: reduce) {
  .glim-cloud-body,
  .glim-cloud-glow,
  .glim-cloud-antenna-ball {
    animation: none;
  }
}

.glim-reduced .glim-cloud-body,
.glim-reduced .glim-cloud-glow,
.glim-reduced .glim-cloud-antenna-ball {
  animation: none;
}
`
