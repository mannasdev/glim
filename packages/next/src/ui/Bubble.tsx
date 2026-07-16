import { useLayoutEffect, useRef, useState } from 'react'

export interface BubbleProps {
  text: string
  x: number
  y: number
  /** Warm error rim so a failure never reads as a dead end. */
  error?: boolean
  /** While streaming, a soft caret trails the last word. */
  speaking?: boolean
  /** While the orb flies to a target, hold the bubble's side so it doesn't flip. */
  pointing?: boolean
}

// Where the bubble sits relative to the character's top-left corner when it opens
// up-right (the default). Flips mirror these offsets across the anchor.
export const BUBBLE_OFFSET_X = 34
export const BUBBLE_OFFSET_Y = -8

// The bubble never comes closer than this to any viewport edge.
export const VIEWPORT_MARGIN = 20

export interface BubblePlacement {
  left: number
  top: number
  side: 'right' | 'left'
  vside: 'below' | 'above'
}

// Pure viewport-clamping math, exported so it can be unit-tested without layout
// (jsdom has no layout). Given the character anchor (its top-left), the measured
// bubble size, and the viewport size, decide which side/vside the bubble opens
// toward and the final clamped top-left pixel coordinates.
//
// Default is up-right of the anchor. Flip horizontally (open leftward) when the
// right edge would exceed the viewport's right margin, flip vertically (open
// above) when the bottom edge would exceed the bottom margin, then clamp the
// final coordinates so no edge is closer than VIEWPORT_MARGIN.
export function computeBubblePosition(
  anchor: { x: number; y: number },
  bubble: { width: number; height: number },
  viewport: { width: number; height: number },
  // When provided (while the orb is mid-flight), the side/vside are HELD to this
  // instead of re-decided from overflow — so the bubble tracks the orb without
  // visibly flipping direction as it arcs across the screen. left/top still clamp.
  forcedSide?: { side: 'right' | 'left'; vside: 'below' | 'above' },
): BubblePlacement {
  // Horizontal: default opens right of the anchor.
  const rightwardLeft = anchor.x + BUBBLE_OFFSET_X
  const wouldOverflowRight = rightwardLeft + bubble.width > viewport.width - VIEWPORT_MARGIN
  const side: 'right' | 'left' = forcedSide ? forcedSide.side : wouldOverflowRight ? 'left' : 'right'
  const unclampedLeft = side === 'right' ? rightwardLeft : anchor.x - BUBBLE_OFFSET_X - bubble.width

  // Vertical: default opens below the offset (which is slightly above the anchor).
  const belowTop = anchor.y + BUBBLE_OFFSET_Y
  const wouldOverflowBottom = belowTop + bubble.height > viewport.height - VIEWPORT_MARGIN
  const vside: 'below' | 'above' = forcedSide ? forcedSide.vside : wouldOverflowBottom ? 'above' : 'below'
  const unclampedTop = vside === 'below' ? belowTop : belowTop - bubble.height

  // Final clamp: keep every edge at least VIEWPORT_MARGIN inside the viewport. The
  // lower bound (the margin) always wins for a bubble larger than the viewport.
  const maxLeft = viewport.width - VIEWPORT_MARGIN - bubble.width
  const maxTop = viewport.height - VIEWPORT_MARGIN - bubble.height
  const left = Math.max(VIEWPORT_MARGIN, Math.min(unclampedLeft, maxLeft))
  const top = Math.max(VIEWPORT_MARGIN, Math.min(unclampedTop, maxTop))

  return { left, top, side, vside }
}

// Streamed text renders word-by-word. Each word span is keyed by its index, so
// as text grows only NEW spans mount (and get the 120ms fade-in animation);
// already-rendered words keep their DOM nodes and never re-animate or reflow.
export function Bubble({ text, x, y, error = false, speaking = false, pointing = false }: BubbleProps) {
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  // The side/vside chosen when the orb was last at rest; held during flight.
  const heldSideRef = useRef<{ side: 'right' | 'left'; vside: 'below' | 'above' } | null>(null)
  const [placement, setPlacement] = useState<BubblePlacement>({
    left: x + BUBBLE_OFFSET_X,
    top: y + BUBBLE_OFFSET_Y,
    side: 'right',
    vside: 'below',
  })

  // Measure the rendered bubble after layout and whenever the anchor or text
  // changes (text growth changes the bubble's size), then recompute the clamped
  // position. useLayoutEffect runs before paint so the bubble never flashes at an
  // overflowing position. A ResizeObserver catches size changes (word wrapping)
  // that don't otherwise re-run this effect.
  useLayoutEffect(() => {
    const bubbleElement = bubbleRef.current
    if (bubbleElement === null) return
    if (typeof window === 'undefined') return

    const recomputePlacement = (): void => {
      const measuredWidth = bubbleElement.offsetWidth
      const measuredHeight = bubbleElement.offsetHeight
      // Hold the side while the orb flies; decide freshly (and remember it) at rest.
      const forcedSide = pointing ? heldSideRef.current ?? undefined : undefined
      const nextPlacement = computeBubblePosition(
        { x, y },
        { width: measuredWidth, height: measuredHeight },
        { width: window.innerWidth, height: window.innerHeight },
        forcedSide,
      )
      if (!pointing || heldSideRef.current === null) {
        heldSideRef.current = { side: nextPlacement.side, vside: nextPlacement.vside }
      }
      setPlacement(nextPlacement)
    }

    recomputePlacement()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recomputePlacement) : null
    resizeObserver?.observe(bubbleElement)
    window.addEventListener('resize', recomputePlacement)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', recomputePlacement)
    }
  }, [x, y, text, pointing])

  if (text.length === 0) return null
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  const bubbleClassName = error ? 'glim-bubble glim-bubble-error' : 'glim-bubble'
  return (
    <div
      ref={bubbleRef}
      className={bubbleClassName}
      // Position math sets left/top once per measure (not animated); only the word
      // fade-in animates, via opacity, so the host app never re-layouts per frame.
      style={{ transform: `translate(${placement.left}px, ${placement.top}px)` }}
    >
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="glim-word">
          {word}{' '}
        </span>
      ))}
      {speaking ? <span className="glim-caret" /> : null}
    </div>
  )
}
