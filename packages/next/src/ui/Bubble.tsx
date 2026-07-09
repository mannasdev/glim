export interface BubbleProps {
  text: string
  x: number
  y: number
}

// Where the bubble sits relative to the character's top-left corner.
const BUBBLE_OFFSET_X = 34
const BUBBLE_OFFSET_Y = -8

// Streamed text renders word-by-word. Each word span is keyed by its index, so
// as text grows only NEW spans mount (and get the 120ms fade-in animation);
// already-rendered words keep their DOM nodes and never re-animate or reflow.
export function Bubble({ text, x, y }: BubbleProps) {
  if (text.length === 0) return null
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  return (
    <div
      className="glim-bubble"
      style={{ transform: `translate(${x + BUBBLE_OFFSET_X}px, ${y + BUBBLE_OFFSET_Y}px)` }}
    >
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="glim-word">
          {word}{' '}
        </span>
      ))}
    </div>
  )
}
