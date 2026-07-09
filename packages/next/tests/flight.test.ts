import { afterEach, describe, expect, it, vi } from 'vitest'
import { FLIGHT, animateFlight, computeFlight, quadraticBezier, smoothstep, type Point2D } from '../src/ui/flight'

// Build a DOMRect-shaped object without depending on the jsdom DOMRect constructor.
function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect
}

describe('smoothstep', () => {
  it('returns 0 at t=0, 0.5 at t=0.5, and 1 at t=1', () => {
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(0.5)).toBeCloseTo(0.5)
    expect(smoothstep(1)).toBe(1)
  })
})

describe('quadraticBezier', () => {
  const start: Point2D = { x: 0, y: 0 }
  const control: Point2D = { x: 10, y: -20 }
  const end: Point2D = { x: 20, y: 0 }

  it('returns start at t=0 and end at t=1', () => {
    expect(quadraticBezier(start, control, end, 0)).toEqual({ x: 0, y: 0 })
    expect(quadraticBezier(start, control, end, 1)).toEqual({ x: 20, y: 0 })
  })

  it('returns the bezier-weighted midpoint at t=0.5 (0.25*start + 0.5*control + 0.25*end)', () => {
    const midpoint = quadraticBezier(start, control, end, 0.5)
    expect(midpoint.x).toBeCloseTo(10)
    expect(midpoint.y).toBeCloseTo(-10)
  })
})

describe('computeFlight', () => {
  const viewport = { width: 1024, height: 768 }

  it('lands beside the rect: right + LAND_OFFSET_X, bottom + LAND_OFFSET_Y', () => {
    const targetRect = makeRect(192, 38, 100, 50) // right=292, bottom=88
    const flight = computeFlight({ x: 0, y: 100 }, targetRect, viewport)
    expect(flight.end).toEqual({
      x: 292 + FLIGHT.LAND_OFFSET_X,
      y: 88 + FLIGHT.LAND_OFFSET_Y,
    })
  })

  it('scales duration with distance between the clamps', () => {
    // start (0,0) -> end (400,300): distance 500px -> 500/800 s = 625 ms
    const targetRect = makeRect(292, 188, 100, 100) // right=392 -> end.x=400; bottom=288 -> end.y=300
    const flight = computeFlight({ x: 0, y: 0 }, targetRect, viewport)
    expect(flight.durationMs).toBeCloseTo(625)
  })

  it('clamps duration up to MIN_DURATION_S for a tiny hop', () => {
    // start (100,100) -> end (110,110): distance ~14px, far under the 0.6s floor
    const targetRect = makeRect(52, 48, 50, 50) // right=102 -> end.x=110; bottom=98 -> end.y=110
    const flight = computeFlight({ x: 100, y: 100 }, targetRect, viewport)
    expect(flight.durationMs).toBe(FLIGHT.MIN_DURATION_S * 1000)
  })

  it('clamps duration down to MAX_DURATION_S for a long flight', () => {
    const bigViewport = { width: 2000, height: 2000 }
    const targetRect = makeRect(1400, 1400, 100, 100) // right=1500 -> end.x=1508; bottom=1500 -> end.y=1512
    // distance = hypot(1508, 1512) ~ 2135px -> ~2.67s, clamped to 1.4s
    const flight = computeFlight({ x: 0, y: 0 }, targetRect, bigViewport)
    expect(flight.durationMs).toBe(FLIGHT.MAX_DURATION_S * 1000)
  })

  it('lifts the control point above the midpoint by distance * ARC_RATIO when under the cap', () => {
    // start (0,100) -> end (300,100): distance 300px -> lift 60px (under the 80px cap)
    const targetRect = makeRect(192, 38, 100, 50) // right=292 -> end.x=300; bottom=88 -> end.y=100
    const flight = computeFlight({ x: 0, y: 100 }, targetRect, viewport)
    expect(flight.control.x).toBeCloseTo(150)
    expect(flight.control.y).toBeCloseTo(100 - 300 * FLIGHT.ARC_RATIO)
  })

  it('caps the control point lift at ARC_MAX_PX', () => {
    // start (0,0) -> end (400,300): distance 500px -> 500*0.2=100px lift, capped at 80px
    const targetRect = makeRect(292, 188, 100, 100)
    const flight = computeFlight({ x: 0, y: 0 }, targetRect, viewport)
    expect(flight.control.x).toBeCloseTo(200)
    expect(flight.control.y).toBeCloseTo(150 - FLIGHT.ARC_MAX_PX)
  })

  it('clamps the landing point EDGE_PADDING inside the viewport (upper bound)', () => {
    const smallViewport = { width: 800, height: 600 }
    const targetRect = makeRect(750, 560, 100, 100) // right=850, bottom=660 — past the viewport edge
    const flight = computeFlight({ x: 0, y: 0 }, targetRect, smallViewport)
    expect(flight.end).toEqual({
      x: 800 - FLIGHT.EDGE_PADDING,
      y: 600 - FLIGHT.EDGE_PADDING,
    })
  })

  it('clamps the landing point EDGE_PADDING inside the viewport (lower bound)', () => {
    const targetRect = makeRect(-100, -100, 50, 50) // right=-50, bottom=-50 — off the top-left
    const flight = computeFlight({ x: 200, y: 200 }, targetRect, viewport)
    expect(flight.end).toEqual({ x: FLIGHT.EDGE_PADDING, y: FLIGHT.EDGE_PADDING })
  })
})

type FrameRecord = { p: Point2D; angleDeg: number; scale: number }

// Replaces requestAnimationFrame/cancelAnimationFrame with a manually pumped
// queue so the test controls the clock deterministically.
function createRafPump() {
  let nextFrameId = 1
  let clockMs = 0
  const pendingCallbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const frameId = nextFrameId++
    pendingCallbacks.set(frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (frameId: number): void => {
    pendingCallbacks.delete(frameId)
  })
  return {
    advance(deltaMs: number): void {
      clockMs += deltaMs
      const callbacksToRun = [...pendingCallbacks.values()]
      pendingCallbacks.clear()
      for (const callback of callbacksToRun) callback(clockMs)
    },
  }
}

describe('animateFlight', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const start: Point2D = { x: 0, y: 0 }
  const control: Point2D = { x: 50, y: -40 }
  const end: Point2D = { x: 100, y: 0 }

  it('progresses monotonically, ends exactly at the end point, and calls onDone exactly once', () => {
    const rafPump = createRafPump()
    const frames: FrameRecord[] = []
    let doneCount = 0
    animateFlight({
      start,
      end,
      control,
      durationMs: 1000,
      onFrame: (p, angleDeg, scale) => frames.push({ p, angleDeg, scale }),
      onDone: () => {
        doneCount += 1
      },
    })
    rafPump.advance(0) // first frame establishes the start timestamp: t=0
    rafPump.advance(250) // t=0.25
    rafPump.advance(250) // t=0.5
    rafPump.advance(250) // t=0.75
    rafPump.advance(250) // t=1 -> final frame + onDone
    rafPump.advance(250) // nothing scheduled anymore — must be a no-op

    expect(frames).toHaveLength(5)
    expect(doneCount).toBe(1)
    for (let frameIndex = 1; frameIndex < frames.length; frameIndex++) {
      expect(frames[frameIndex].p.x).toBeGreaterThanOrEqual(frames[frameIndex - 1].p.x)
    }
    expect(frames[0].p).toEqual({ x: 0, y: 0 })
    expect(frames[4].p.x).toBeCloseTo(100)
    expect(frames[4].p.y).toBeCloseTo(0)
  })

  it('rotates with the curve tangent and peaks scale at 1.15 mid-flight', () => {
    const rafPump = createRafPump()
    const frames: FrameRecord[] = []
    animateFlight({
      start,
      end,
      control,
      durationMs: 1000,
      onFrame: (p, angleDeg, scale) => frames.push({ p, angleDeg, scale }),
      onDone: () => {},
    })
    rafPump.advance(0) // t=0
    rafPump.advance(500) // t=0.5 (eased=0.5)
    rafPump.advance(500) // t=1

    // t=0: tangent = 2*(control-start) = (100,-80) -> atan2(-80,100) ~ -38.66 deg (flying up)
    expect(frames[0].angleDeg).toBeCloseTo(-38.66, 1)
    expect(frames[0].scale).toBeCloseTo(1)
    // eased=0.5: tangent = (control-start)+(end-control) = (100,0) -> 0 deg; scale = 1+0.15*sin(pi/2)
    expect(frames[1].angleDeg).toBeCloseTo(0)
    expect(frames[1].scale).toBeCloseTo(1.15)
    // t=1: scale settles back to 1
    expect(frames[2].scale).toBeCloseTo(1)
  })

  it('the returned cancel function stops the loop so onDone never fires', () => {
    const rafPump = createRafPump()
    let doneCount = 0
    const cancelFlight = animateFlight({
      start,
      end,
      control,
      durationMs: 1000,
      onFrame: () => {},
      onDone: () => {
        doneCount += 1
      },
    })
    rafPump.advance(0)
    cancelFlight()
    rafPump.advance(2000)
    expect(doneCount).toBe(0)
  })

  it('handles durationMs: 0 by emitting exactly one onFrame at the end state and calling onDone once, scheduling nothing', () => {
    const rafPump = createRafPump()
    const frames: FrameRecord[] = []
    let doneCount = 0
    const cancelFlight = animateFlight({
      start,
      end,
      control,
      durationMs: 0,
      onFrame: (p, angleDeg, scale) => frames.push({ p, angleDeg, scale }),
      onDone: () => {
        doneCount += 1
      },
    })

    expect(frames).toHaveLength(1)
    expect(doneCount).toBe(1)
    expect(frames[0].p.x).toBeCloseTo(end.x)
    expect(frames[0].p.y).toBeCloseTo(end.y)
    expect(frames[0].scale).toBeCloseTo(1)

    // Nothing was scheduled via requestAnimationFrame, so a manual pump must be a no-op.
    rafPump.advance(1000)
    expect(frames).toHaveLength(1)
    expect(doneCount).toBe(1)

    // Calling cancel afterward must not throw.
    expect(() => cancelFlight()).not.toThrow()
  })
})
