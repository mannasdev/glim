import type { CSSProperties } from 'react'

export interface CharacterProps {
  x: number
  y: number
  angleDeg: number
  scale: number
  flying: boolean
  thinking?: boolean
  /** Faded out (but kept mounted) while Glim rests in the launcher pill. */
  hidden?: boolean
}

const PARTICLE_COUNT = 5
const PARTICLE_STAGGER_MS = 90

// The glowing violet-teal orb with a spark core. Position/scale come from the
// flight animator and are applied as a single transform on the orb — the only
// property that changes per frame, so the host app never re-layouts. The orb
// FACE (core/spark/highlight) stays upright; only the particle trail rotates to
// the flight tangent so it streams behind the direction of travel.
export function Character({ x, y, angleDeg, scale, flying, thinking = false, hidden = false }: CharacterProps) {
  const orbTransformStyle: CSSProperties = {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    opacity: hidden ? 0 : 1,
  }
  const trailTransformStyle: CSSProperties = {
    transform: `rotate(${angleDeg}deg)`,
  }
  const orbClassName = thinking ? 'glim-orb glim-thinking' : 'glim-orb'
  return (
    <div className={orbClassName} style={orbTransformStyle}>
      <div className="glim-orb-halo" />
      <div className="glim-orb-bloom" />
      <div className="glim-orb-core">
        <span className="glim-orb-sparkle">✦</span>
      </div>
      <div className="glim-orb-highlight" />
      {flying ? (
        <div className="glim-orb-trail" style={trailTransformStyle}>
          {Array.from({ length: PARTICLE_COUNT }, (_, particleIndex) => (
            <div
              key={particleIndex}
              className="glim-particle"
              style={{ animationDelay: `${particleIndex * PARTICLE_STAGGER_MS}ms` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
