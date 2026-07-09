export interface Point2D {
  x: number
  y: number
}

// Flight tuning ported verbatim from the macOS app (OverlayWindow.swift:495-540).
// These values were tuned over many iterations — constants, not suggestions.
export const FLIGHT = {
  SPEED_DIVISOR: 800,
  MIN_DURATION_S: 0.6,
  MAX_DURATION_S: 1.4,
  ARC_RATIO: 0.2,
  ARC_MAX_PX: 80,
  LAND_OFFSET_X: 8,
  LAND_OFFSET_Y: 12,
  EDGE_PADDING: 20,
} as const

// Smoothstep easing: 3t^2 - 2t^3. Zero velocity at both ends.
export function smoothstep(t: number): number {
  return 3 * t * t - 2 * t * t * t
}

export function quadraticBezier(start: Point2D, control: Point2D, end: Point2D, t: number): Point2D {
  const oneMinusT = 1 - t
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
  }
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function computeFlight(
  start: Point2D,
  targetRect: DOMRect,
  viewport: { width: number; height: number },
): { end: Point2D; control: Point2D; durationMs: number } {
  // Land beside the target (bottom-right corner + offset), never on it,
  // and never closer than EDGE_PADDING to a viewport edge.
  const end: Point2D = {
    x: clampNumber(
      targetRect.right + FLIGHT.LAND_OFFSET_X,
      FLIGHT.EDGE_PADDING,
      viewport.width - FLIGHT.EDGE_PADDING,
    ),
    y: clampNumber(
      targetRect.bottom + FLIGHT.LAND_OFFSET_Y,
      FLIGHT.EDGE_PADDING,
      viewport.height - FLIGHT.EDGE_PADDING,
    ),
  }

  const distance = Math.hypot(end.x - start.x, end.y - start.y)

  // Short hops snappy, long flights dramatic — but always within [MIN, MAX].
  const durationSeconds = clampNumber(
    distance / FLIGHT.SPEED_DIVISOR,
    FLIGHT.MIN_DURATION_S,
    FLIGHT.MAX_DURATION_S,
  )

  // Arc: lift the bezier control point above the midpoint, capped so
  // cross-screen flights don't balloon into the stratosphere.
  const arcLiftPx = Math.min(distance * FLIGHT.ARC_RATIO, FLIGHT.ARC_MAX_PX)
  const control: Point2D = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 - arcLiftPx,
  }

  return { end, control, durationMs: durationSeconds * 1000 }
}
