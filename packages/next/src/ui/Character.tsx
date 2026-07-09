import type { CSSProperties } from 'react'

export interface CharacterProps {
  x: number
  y: number
  angleDeg: number
  scale: number
  flying: boolean
}

const PARTICLE_COUNT = 5
const PARTICLE_STAGGER_MS = 90

// The glowing orb. Position/rotation/scale come from the flight animator via
// props and are applied as a single transform — the only property that changes
// per frame, so the host app never re-layouts.
export function Character({ x, y, angleDeg, scale, flying }: CharacterProps) {
  const orbTransformStyle: CSSProperties = {
    transform: `translate(${x}px, ${y}px) rotate(${angleDeg}deg) scale(${scale})`,
  }
  return (
    <div className="glim-orb" style={orbTransformStyle}>
      <div className="glim-orb-halo" />
      <div className="glim-orb-bloom" />
      <div className="glim-orb-core" />
      {flying
        ? Array.from({ length: PARTICLE_COUNT }, (_, particleIndex) => (
            <div
              key={particleIndex}
              className="glim-particle"
              style={{ animationDelay: `${particleIndex * PARTICLE_STAGGER_MS}ms` }}
            />
          ))
        : null}
    </div>
  )
}
