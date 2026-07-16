// The single stylesheet injected into the Glim shadow root. Everything that
// animates does so via transform/opacity only — zero layout thrash in the host app.
// Design: "Glim" — a glowing AI guide on one dark translucent glass system, so it
// stays legible on light, dark, and busy backgrounds.
export const glimStyles = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

:host {
  /* glass chrome */
  --glim-glass: #1c1b2acc;
  --glim-glass-72: #1c1b2ab8;
  --glim-glass-solid: #1c1b2af2;
  --glim-glass-tint: #1c1b2a;
  --glim-border: #ffffff2b;
  --glim-border-bright: #ffffff4d;
  /* glow */
  --glim-glow: #8b7df6;
  --glim-glow-soft: #b8a9ff;
  --glim-glow-teal: #5ee0d0;
  /* text */
  --glim-text: #f6f5ff;
  --glim-text-2: #c9c6e0;
  --glim-placeholder: #9e9bbe;
  --glim-error: #f79393;
  --glim-success: #6ee7b7;
  /* type */
  --glim-font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --glim-font-brand: 'Fredoka', 'Inter', -apple-system, sans-serif;
}

.glim-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
  font-family: var(--glim-font-ui);
}

/* ---- character: violet-teal glass orb with a spark core ---- */

.glim-orb {
  position: fixed;
  top: 0;
  left: 0;
  width: 36px;
  height: 36px;
  pointer-events: none;
  will-change: transform;
  transition: opacity 220ms ease-out;
  /* sit above the launcher pill so the orb + bubble are never occluded by it */
  z-index: 2;
}

/* aura: violet → teal → transparent. No blur() — it re-rasterizes every frame
   during flight and reads as a smear; the radial gradient is already soft. */
.glim-orb-halo {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, #9e8bff 0%, #7ce8d8 55%, #9e8bff00 100%);
  opacity: 0.85;
  animation: glim-breathe 3.4s ease-in-out infinite;
}

.glim-orb-bloom {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: radial-gradient(circle, #b8a9ff80 0%, #8b7df600 66%);
  animation: glim-breathe 3s ease-in-out infinite;
}

/* core: white → lavender → violet, with a soft rim + violet glow. The core does
   NOT breathe — a scaling core re-rasterizes the spark glyph every frame and
   shimmers during flight. Promote it to its own layer so the glyph rasterizes
   once; the pulse comes from the halo/bloom glow around it. */
.glim-orb-core {
  position: absolute;
  inset: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, #ffffff 0%, #dacfff 45%, #7c6bf0 100%);
  border: 1px solid #ffffff73;
  box-shadow: 0 0 10px #8b7df6c0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.glim-orb-sparkle {
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.glim-orb-highlight {
  position: absolute;
  top: 11px;
  left: 12px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fff;
  opacity: 0.85;
}

@keyframes glim-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* the orb pulses a little brighter while Glim thinks */
.glim-orb.glim-thinking .glim-orb-halo {
  animation: glim-pulse 1.1s ease-in-out infinite;
}

@keyframes glim-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.14); opacity: 1; }
}

/* ---- particle trail (rendered only during flight) ---- */

/* the trail spins to the flight tangent; the orb face stays upright */
.glim-orb-trail {
  position: absolute;
  inset: 0;
  transform-origin: center;
}

.glim-particle {
  position: absolute;
  top: 15px;
  left: 15px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--glim-glow-soft);
  opacity: 0;
  animation: glim-particle-fade 600ms linear infinite;
}

@keyframes glim-particle-fade {
  0% { opacity: 0.85; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(-14px, 6px) scale(0.4); }
}

/* ---- speech bubble: solid glass, bright rim, orb docked at the corner ---- */

.glim-bubble {
  position: fixed;
  top: 0;
  left: 0;
  max-width: 300px;
  padding: 15px 16px;
  border-radius: 18px;
  background: var(--glim-glass-solid);
  -webkit-backdrop-filter: blur(26px);
  backdrop-filter: blur(26px);
  border: 1px solid var(--glim-border-bright);
  color: var(--glim-text);
  font-size: 14.5px;
  line-height: 1.45;
  letter-spacing: -0.003em;
  box-shadow:
    0 14px 36px -8px #0000008c,
    0 3px 10px #00000059,
    0 0 22px -2px #8b7df64d,
    inset 0 1px 0 #ffffff3d;
  pointer-events: none;
  will-change: transform;
  z-index: 3;
}

/* error: warm rim so a failure never reads as a dead end */
.glim-bubble.glim-bubble-error {
  border-color: #f7939366;
  box-shadow:
    0 14px 36px -8px #0000008c,
    0 3px 10px #00000059,
    0 0 22px -2px #f7939340,
    inset 0 1px 0 #ffffff3d;
}

.glim-word {
  animation: glim-word-in 120ms ease-out both;
}

@keyframes glim-word-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* soft cursor trailing the last streamed word */
.glim-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 1px;
  vertical-align: -0.15em;
  border-radius: 2px;
  background: var(--glim-glow-soft);
  animation: glim-caret-blink 1s steps(1) infinite;
}

@keyframes glim-caret-blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}

/* ---- thinking: three breathing dots ---- */

.glim-loading {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 11px 13px;
  border-radius: 14px;
  background: var(--glim-glass-solid);
  -webkit-backdrop-filter: blur(26px);
  backdrop-filter: blur(26px);
  border: 1px solid var(--glim-border-bright);
  box-shadow:
    0 14px 36px -8px #0000008c,
    0 0 22px -2px #8b7df64d,
    inset 0 1px 0 #ffffff3d;
  pointer-events: none;
  will-change: transform;
  z-index: 3;
}

.glim-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--glim-glow-soft);
  animation: glim-dot 1s ease-in-out infinite;
}

.glim-loading-dot:nth-child(2) { animation-delay: 0.15s; }
.glim-loading-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes glim-dot {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}

/* ---- launcher: "Ask Glim" pill that morphs into the question input ---- */

.glim-launcher {
  position: fixed;
  right: 20px;
  bottom: 20px;
  pointer-events: auto;
  /* below the orb + bubble, so an answer near the corner is never hidden behind it */
  z-index: 1;
}

/* shared glass chrome for the pill + input */
.glim-launcher-pill,
.glim-launcher-input-wrap {
  display: flex;
  align-items: center;
  border-radius: 24px;
  border: 1px solid var(--glim-border);
  background: var(--glim-glass);
  -webkit-backdrop-filter: blur(22px);
  backdrop-filter: blur(22px);
  box-shadow:
    0 10px 28px -6px #00000073,
    0 2px 8px #0000004d,
    0 0 18px -2px #8b7df63d,
    inset 0 1px 0 #ffffff33;
}

.glim-launcher-pill {
  gap: 9px;
  padding: 8px 18px 8px 10px;
  cursor: pointer;
  transition: transform 160ms ease-out, box-shadow 160ms ease-out;
}

/* hover: glow intensifies, rim brightens, pill lifts 2px */
.glim-launcher-pill:hover {
  transform: translateY(-2px);
  border-color: var(--glim-border-bright);
  box-shadow:
    0 14px 32px -6px #00000080,
    0 2px 8px #0000004d,
    0 0 28px -1px #8b7df666,
    inset 0 1px 0 #ffffff40;
}

/* focus: 2px violet ring at 4px offset, legible on any backdrop */
.glim-launcher-pill:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--glim-glow),
    0 0 0 6px #8b7df640,
    0 10px 28px -6px #00000073,
    inset 0 1px 0 #ffffff33;
}

.glim-launcher-label {
  font-family: var(--glim-font-brand);
  font-size: 15px;
  font-weight: 500;
  color: var(--glim-text);
  letter-spacing: 0.01em;
}

.glim-launcher-input-wrap {
  gap: 10px;
  padding: 7px 8px 7px 12px;
  width: 320px;
  background: var(--glim-glass-72);
  transition: box-shadow 160ms ease-out, border-color 160ms ease-out;
}

.glim-launcher-input-wrap:focus-within {
  border-color: var(--glim-border-bright);
  box-shadow:
    0 0 0 2px var(--glim-glow),
    0 0 0 6px #8b7df633,
    0 14px 36px -8px #0000008c,
    0 0 22px -2px #8b7df64d,
    inset 0 1px 0 #ffffff3d;
}

.glim-launcher-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  color: var(--glim-text);
  font-family: var(--glim-font-ui);
  font-size: 15px;
  line-height: 1.4;
}

.glim-launcher-input::placeholder {
  color: var(--glim-placeholder);
}

/* violet gradient send button */
.glim-send {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(315deg, #a99bff 0%, #6d5de8 100%);
  box-shadow: 0 2px 10px -1px #6d5de8aa;
  transition: transform 120ms ease-out, filter 120ms ease-out, opacity 120ms ease-out;
}

.glim-send:hover {
  filter: brightness(1.08);
  transform: scale(1.05);
}

.glim-send:disabled {
  opacity: 0.45;
  cursor: default;
}

.glim-send svg {
  width: 18px;
  height: 18px;
}

/* mini orb that leads the pill / input (the resting Glim) */
.glim-mini-orb {
  position: relative;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.glim-mini-orb-halo {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: radial-gradient(circle, #9e8bff 0%, #7ce8d8 55%, #9e8bff00 100%);
  opacity: 0.7;
  animation: glim-breathe 3.2s ease-in-out infinite;
}

.glim-mini-orb-core {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, #ffffff 0%, #dacfff 45%, #7c6bf0 100%);
  border: 1px solid #ffffff73;
  box-shadow: 0 0 8px #8b7df6a0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.glim-mini-orb-spark {
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}

/* ---- custom character mount ---- */

/* A custom character (via the GlimProvider \`character\` prop) is placed here and
   carries the same fixed-position translate/scale transform as the orb. */
.glim-character-mount {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  will-change: transform;
  z-index: 2;
}

/* ---- reduced motion: freeze everything animated ---- */

@media (prefers-reduced-motion: reduce) {
  .glim-orb-halo,
  .glim-orb-bloom,
  .glim-orb-core,
  .glim-mini-orb-halo,
  .glim-particle,
  .glim-word,
  .glim-caret,
  .glim-loading-dot {
    animation: none;
  }
  .glim-launcher-pill,
  .glim-send {
    transition: none;
  }
}

.glim-reduced .glim-orb-halo,
.glim-reduced .glim-orb-bloom,
.glim-reduced .glim-orb-core,
.glim-reduced .glim-mini-orb-halo,
.glim-reduced .glim-particle,
.glim-reduced .glim-word,
.glim-reduced .glim-caret,
.glim-reduced .glim-loading-dot {
  animation: none;
}

.glim-reduced .glim-launcher-pill,
.glim-reduced .glim-send {
  transition: none;
}

/* ---- built-in cloud character (opt-in alternative) ---- */

.glim-cloud {
  position: relative;
  width: 72px;
  height: 56px;
  margin-left: -36px;
  margin-top: -28px;
  pointer-events: none;
}

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
  animation-name: glim-cloud-glow-breathe;
  animation-duration: 3.4s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.glim-cloud-body {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  animation: glim-cloud-breathe 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px hsl(38 60% 30% / 0.28));
}

.glim-cloud-fill { fill: #f5cf56; }
.glim-cloud-highlight { fill: #fbebb5; opacity: 0.85; }
.glim-cloud-blush { fill: #f5a25d; opacity: 0.6; }
.glim-cloud-eye { fill: #241c14; }
.glim-cloud-smile { stroke: #241c14; stroke-width: 2.2; stroke-linecap: round; }

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

@keyframes glim-cloud-glow-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
  50% { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
}

@keyframes glim-cloud-antenna-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.5px); }
}

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
