import { describe, expect, it } from 'vitest'
import { computeBubblePosition, BUBBLE_OFFSET_X, BUBBLE_OFFSET_Y, VIEWPORT_MARGIN } from '../src/ui/Bubble'

// computeBubblePosition is a pure function (jsdom has no layout, so the DOM
// component can't be exercised for geometry). These cases cover the default
// up-right home position, all four flip quadrants, and edge clamping.

const viewport = { width: 1000, height: 800 }
const bubble = { width: 200, height: 60 }

describe('computeBubblePosition', () => {
  it('opens up-right of the anchor when there is room on both axes', () => {
    // Anchor comfortably in the middle-left/upper area: no flips.
    const result = computeBubblePosition({ x: 300, y: 400 }, bubble, viewport)
    expect(result.side).toBe('right')
    expect(result.vside).toBe('below')
    expect(result.left).toBe(300 + BUBBLE_OFFSET_X)
    expect(result.top).toBe(400 + BUBBLE_OFFSET_Y)
  })

  it('flips leftward when the right edge would exceed the viewport (right margin)', () => {
    // Anchor near the right edge: default left = 900 + 34 = 934, right edge
    // 934 + 200 = 1134 > 1000 - 20, so open leftward instead.
    const result = computeBubblePosition({ x: 900, y: 400 }, bubble, viewport)
    expect(result.side).toBe('left')
    // Opening leftward places the bubble's right edge to the LEFT of the anchor.
    expect(result.left).toBe(900 - BUBBLE_OFFSET_X - bubble.width)
    // Still clamped within the viewport.
    expect(result.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
    expect(result.left + bubble.width).toBeLessThanOrEqual(viewport.width - VIEWPORT_MARGIN)
  })

  it('flips above when the bottom edge would exceed the viewport (bottom margin)', () => {
    // Anchor near the bottom: default top = 780 + (-8) = 772, bottom edge
    // 772 + 60 = 832 > 800 - 20, so open above.
    const result = computeBubblePosition({ x: 300, y: 780 }, bubble, viewport)
    expect(result.vside).toBe('above')
    expect(result.top).toBe(780 + BUBBLE_OFFSET_Y - bubble.height)
    expect(result.top + bubble.height).toBeLessThanOrEqual(viewport.height - VIEWPORT_MARGIN)
    expect(result.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
  })

  it('flips both leftward and above in the bottom-right corner (the screenshot home position)', () => {
    // The launcher sits bottom-right; the character homes near it. A bubble opening
    // up-right from there overflows both the right and bottom edges — flip both.
    const result = computeBubblePosition({ x: 940, y: 740 }, bubble, viewport)
    expect(result.side).toBe('left')
    expect(result.vside).toBe('above')
    expect(result.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
    expect(result.left + bubble.width).toBeLessThanOrEqual(viewport.width - VIEWPORT_MARGIN)
    expect(result.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
    expect(result.top + bubble.height).toBeLessThanOrEqual(viewport.height - VIEWPORT_MARGIN)
  })

  it('clamps to at least VIEWPORT_MARGIN from the left edge when even the flipped position overflows', () => {
    // Anchor at the very top-left with a bubble wider than the anchor's left gap:
    // flipping left would push left negative, so clamp to the margin.
    const wideBubble = { width: 400, height: 60 }
    const result = computeBubblePosition({ x: 10, y: 10 }, wideBubble, viewport)
    expect(result.left).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
    expect(result.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
  })

  it('clamps to at least VIEWPORT_MARGIN from every edge for an oversized bubble', () => {
    // A bubble larger than the viewport can only satisfy the top-left clamp.
    const hugeBubble = { width: 2000, height: 2000 }
    const result = computeBubblePosition({ x: 500, y: 400 }, hugeBubble, viewport)
    expect(result.left).toBe(VIEWPORT_MARGIN)
    expect(result.top).toBe(VIEWPORT_MARGIN)
  })

  it('does not flip when the up-right position exactly meets the margin boundary', () => {
    // right edge lands exactly at viewport.width - VIEWPORT_MARGIN: still fits.
    const anchorX = viewport.width - VIEWPORT_MARGIN - bubble.width - BUBBLE_OFFSET_X
    const result = computeBubblePosition({ x: anchorX, y: 300 }, bubble, viewport)
    expect(result.side).toBe('right')
  })
})
