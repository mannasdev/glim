'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { GlimStatus } from '../client/engine'
import type { Point2D } from './flight'
import { glimStyles } from './theme'
import { Character } from './Character'
import { Bubble } from './Bubble'
import { Launcher } from './Launcher'

export interface GlimRootProps {
  status: GlimStatus
  bubbleText: string
  glimPosition: Point2D
  glimAngle: number
  glimScale: number
  onSubmit(question: string): void
  open: boolean
  onToggle(): void
  reducedMotion: boolean
  /**
   * When provided, replaces the default orb inside the transform wrapper. A
   * render function receives the live {status, flying}. Particles are tied to
   * the default orb only, so a custom character never renders them.
   */
  character?: ReactNode | ((state: { status: GlimStatus; flying: boolean }) => ReactNode)
}

// Mounts the single <div data-glim-root> host on document.body with an open
// shadow root for style isolation, injects the Glim stylesheet, and portals all
// Glim UI into a container inside that shadow root. The snapshotter excludes
// [data-glim-root] subtrees, so Glim never sees its own UI.
export function GlimRoot(props: GlimRootProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const hostElement = document.createElement('div')
    hostElement.setAttribute('data-glim-root', '')
    document.body.appendChild(hostElement)

    const shadowRoot = hostElement.attachShadow({ mode: 'open' })
    const styleElement = document.createElement('style')
    styleElement.textContent = glimStyles
    shadowRoot.appendChild(styleElement)

    const containerElement = document.createElement('div')
    shadowRoot.appendChild(containerElement)
    setPortalContainer(containerElement)

    return () => {
      hostElement.remove()
    }
  }, [])

  if (portalContainer === null) return null

  // The character is "flying" exactly while the engine reports pointing status;
  // that is the only time the particle trail renders.
  const characterIsFlying = props.status === 'pointing'

  const containerClassName = props.reducedMotion ? 'glim-container glim-reduced' : 'glim-container'

  // A custom character replaces the orb and rides the flight transform
  // (position/scale) — but NOT the tangent rotation. Rotation exists so the
  // default orb's particle trail streams behind the flight direction; on the
  // radially-symmetric orb the spin itself is invisible, while an asymmetric
  // character (a cloud, a mascot) would visibly bank and tumble mid-flight.
  const characterMountTransform: CSSProperties = {
    transform: `translate(${props.glimPosition.x}px, ${props.glimPosition.y}px) scale(${props.glimScale})`,
  }
  const customCharacterNode =
    props.character === undefined
      ? null
      : typeof props.character === 'function'
        ? props.character({ status: props.status, flying: characterIsFlying })
        : props.character

  return createPortal(
    <div className={containerClassName}>
      {customCharacterNode === null ? (
        <Character
          x={props.glimPosition.x}
          y={props.glimPosition.y}
          angleDeg={props.glimAngle}
          scale={props.glimScale}
          flying={characterIsFlying}
        />
      ) : (
        <div className="glim-character-mount" style={characterMountTransform}>
          {customCharacterNode}
        </div>
      )}
      <Bubble text={props.bubbleText} x={props.glimPosition.x} y={props.glimPosition.y} />
      <Launcher open={props.open} onToggle={props.onToggle} onSubmit={props.onSubmit} />
    </div>,
    portalContainer
  )
}
