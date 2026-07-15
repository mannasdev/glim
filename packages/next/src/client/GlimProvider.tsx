'use client'

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { createSnapshotter } from '../snapshot/snapshotter'
import type { Snapshotter } from '../snapshot/snapshotter'
import { GlimEngine, createToolRegistry } from './engine'
import type { ClientToolRegistry, GlimStatus } from './engine'
import { createWaiter, notifyRouteChange } from './waiters'
import { isPathnameAllowed } from './allowedRoutes'
import { GlimRoot } from '../ui/GlimRoot'
import { animateFlight, computeFlight } from '../ui/flight'
import type { Point2D } from '../ui/flight'

/**
 * A custom character replaces the default orb inside GlimRoot's transform
 * wrapper. Either a static node, or a render function that receives the live
 * {status, flying} so it can react to the engine's state. When omitted, the
 * default glowing orb (with its particle trail) renders unchanged.
 */
export type GlimCharacter =
  | ReactNode
  | ((state: { status: GlimStatus; flying: boolean }) => ReactNode)

export interface GlimProviderProps {
  /** Route handler endpoint the client posts turns to. */
  endpoint?: string
  /** CSS custom properties (e.g. '--glim-hue') applied inline on the glim root element. */
  theme?: Record<string, string>
  /**
   * Master switch. When false, Glim renders no UI and does nothing on any
   * route — children still render, and useGlim()/useGlimTool() still work
   * (ask()/startGuide() become no-ops; see `active` on the returned API).
   */
  enabled?: boolean
  /**
   * Restricts Glim to specific routes — e.g. `['/', '/list', '/settings']`.
   * A route matches its own pathname or anything nested under it ('/settings'
   * matches '/settings' and '/settings/billing', but not '/settings-old').
   * Omit to allow every route (the default). Combines with `enabled`: both
   * must hold for Glim to actually render and respond on the current page.
   */
  allowedRoutes?: string[]
  /**
   * Replaces the default orb with a custom character that rides the same
   * flight/breathing/scale transform. Omit to keep the default orb.
   */
  character?: GlimCharacter
  children?: ReactNode
}

export interface GlimContextValue {
  ask(question: string): void
  open(): void
  close(): void
  startGuide(guideId: string): void
  status: GlimStatus
  registry: ClientToolRegistry
  /** True when Glim is actually live on this page (enabled AND route-allowed). */
  active: boolean
}

export const GlimContext = createContext<GlimContextValue | null>(null)

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function initialGlimPosition(): Point2D {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }
  // Start near the bottom-right launcher so the first flight begins from home.
  return { x: window.innerWidth - 80, y: window.innerHeight - 120 }
}

export function GlimProvider(props: GlimProviderProps): ReactElement {
  const { endpoint = '/api/glim', theme, enabled = true, allowedRoutes, character, children } = props

  const pathname = usePathname()
  const isRouteAllowed = allowedRoutes === undefined || isPathnameAllowed(pathname ?? '', allowedRoutes)
  const active = enabled && isRouteAllowed

  const [status, setStatus] = useState<GlimStatus>('idle')
  const [bubbleText, setBubbleText] = useState('')
  const [open, setOpen] = useState(false)
  const [glimPosition, setGlimPositionState] = useState<Point2D>(initialGlimPosition)
  const [glimAngle, setGlimAngle] = useState(0)
  const [glimScale, setGlimScale] = useState(1)
  const [flying, setFlying] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // The engine's onPoint callback is bound once but must read the glim's
  // current position, so the position is mirrored into a ref.
  const glimPositionRef = useRef<Point2D>(glimPosition)
  const cancelFlightRef = useRef<(() => void) | null>(null)
  const snapshotterRef = useRef<Snapshotter | null>(null)
  const registryRef = useRef<ClientToolRegistry | null>(null)
  const engineRef = useRef<GlimEngine | null>(null)

  const setGlimPosition = useCallback((position: Point2D) => {
    glimPositionRef.current = position
    setGlimPositionState(position)
  }, [])

  const handlePoint = useCallback(
    (ref: string, _description: string) => {
      const snapshotter = snapshotterRef.current
      if (snapshotter === null) return
      const targetElement = snapshotter.resolve(ref)
      if (targetElement === null) return

      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const rectBeforeScroll = targetElement.getBoundingClientRect()
      const targetIsOffscreen =
        rectBeforeScroll.bottom < 0 ||
        rectBeforeScroll.top > viewport.height ||
        rectBeforeScroll.right < 0 ||
        rectBeforeScroll.left > viewport.width
      if (targetIsOffscreen) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }

      const targetRect = targetElement.getBoundingClientRect()
      const flightStart = glimPositionRef.current
      const flight = computeFlight(flightStart, targetRect, viewport)

      cancelFlightRef.current?.()
      cancelFlightRef.current = null

      if (prefersReducedMotion()) {
        // Reduced motion: skip the flight entirely, appear at the landing spot.
        setGlimPosition(flight.end)
        setGlimAngle(0)
        setGlimScale(1)
        setFlying(false)
        return
      }

      setFlying(true)
      cancelFlightRef.current = animateFlight({
        start: flightStart,
        end: flight.end,
        control: flight.control,
        durationMs: flight.durationMs,
        onFrame: (framePosition, angleDeg, scale) => {
          setGlimPosition(framePosition)
          setGlimAngle(angleDeg)
          setGlimScale(scale)
        },
        onDone: () => {
          cancelFlightRef.current = null
          setFlying(false)
          setGlimAngle(0)
          setGlimScale(1)
        },
      })
    },
    [setGlimPosition],
  )

  // The engine is constructed exactly once, so its onPoint binding goes
  // through this ref to always reach the latest handlePoint closure.
  const handlePointRef = useRef(handlePoint)
  handlePointRef.current = handlePoint

  if (registryRef.current === null) {
    registryRef.current = createToolRegistry()
  }
  const registry = registryRef.current

  if (typeof window !== 'undefined' && engineRef.current === null) {
    const snapshotter = createSnapshotter()
    snapshotterRef.current = snapshotter
    engineRef.current = new GlimEngine({
      endpoint,
      snapshotter,
      tools: registry,
      bindings: {
        onSayDelta: (text) => {
          setBubbleText((previousBubbleText) => previousBubbleText + text)
        },
        onBubbleReset: () => setBubbleText(''),
        onPoint: (ref, description) => handlePointRef.current(ref, description),
        onStatus: (nextStatus) => setStatus(nextStatus),
        onError: () => setBubbleText('hmm, i glitched — ask me again?'),
      },
      waiters: createWaiter,
    })
  }

  const ask = useCallback(
    (question: string) => {
      if (!active) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[glim] ask() called while inactive (enabled=false, or the current route is not in allowedRoutes) — ignoring.',
          )
        }
        return
      }
      // New input cancels everything instantly: halt any running flight first
      // (the engine aborts its own in-flight turn inside ask()).
      cancelFlightRef.current?.()
      cancelFlightRef.current = null
      setFlying(false)
      const engine = engineRef.current
      if (engine === null) return
      void engine.ask(question)
    },
    [active],
  )

  const openLauncher = useCallback(() => setOpen(true), [])
  const closeLauncher = useCallback(() => setOpen(false), [])
  const toggleLauncher = useCallback(() => setOpen((previousOpen) => !previousOpen), [])
  const startGuide = useCallback(
    (guideId: string) => {
      ask('[start-guide:' + guideId + ']')
    },
    [ask],
  )

  const contextValue = useMemo<GlimContextValue>(
    () => ({
      ask,
      open: openLauncher,
      close: closeLauncher,
      startGuide,
      status,
      registry,
      active,
    }),
    [ask, openLauncher, closeLauncher, startGuide, status, registry, active],
  )

  useEffect(() => {
    if (pathname) {
      notifyRouteChange(pathname)
    }
  }, [pathname])

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
  }, [])

  useEffect(() => {
    if (engineRef.current?.hasRestoredHistory()) {
      setBubbleText('want to pick back up where we left off?')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active || !theme) return
    // GlimRoot (a child) has already created the portal host by the time this
    // parent effect runs — child effects fire before parent effects.
    const rootElement = document.querySelector<HTMLElement>('div[data-glim-root]')
    if (rootElement === null) return
    for (const [customPropertyName, customPropertyValue] of Object.entries(theme)) {
      rootElement.style.setProperty(customPropertyName, customPropertyValue)
    }
  }, [active, theme])

  useEffect(() => {
    return () => {
      cancelFlightRef.current?.()
      engineRef.current?.cancel()
    }
  }, [])

  // GlimProvider itself never unmounts when `active` flips to false — a host
  // app typically keeps rendering the same <GlimProvider allowedRoutes={...}>
  // across route changes, so only the rendered output below changes. Without
  // this, an in-flight turn's abort controller and any active waiter (a
  // document-level click listener, a route listener, or a MutationObserver)
  // would keep running unseen on whatever page comes next, and could resolve
  // there against completely unrelated user activity. This fires for both
  // `enabled` flipping and a route falling outside `allowedRoutes`.
  const previousActiveRef = useRef(active)
  useEffect(() => {
    if (previousActiveRef.current && !active) {
      cancelFlightRef.current?.()
      cancelFlightRef.current = null
      engineRef.current?.cancel()
      setFlying(false)
      setStatus('idle')
      setBubbleText('')
    }
    previousActiveRef.current = active
  }, [active])

  // Context is always provided — even inactive, useGlim()/useGlimTool() stay
  // usable (ask()/startGuide() just no-op, per the guard above) instead of
  // throwing the moment a host component happens to render on a route
  // outside `allowedRoutes`. Only the visible UI is gated on `active`.
  // While the character is mid-flight the visible status is 'pointing' so the
  // character layer can show its particle trail.
  const statusForRoot: GlimStatus = flying ? 'pointing' : status

  return (
    <GlimContext.Provider value={contextValue}>
      {children}
      {active && (
        <GlimRoot
          status={statusForRoot}
          bubbleText={bubbleText}
          glimPosition={glimPosition}
          glimAngle={glimAngle}
          glimScale={glimScale}
          onSubmit={ask}
          open={open}
          onToggle={toggleLauncher}
          reducedMotion={reducedMotion}
          character={character}
        />
      )}
    </GlimContext.Provider>
  )
}
