import { useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface LauncherProps {
  open: boolean
  onToggle(): void
  onSubmit(question: string): void
}

// The resting Glim: a mini glass orb that leads the "Ask Glim" pill and the
// open question input, so the launcher reads as the companion (not a bare icon).
function MiniOrb() {
  return (
    <span className="glim-mini-orb" aria-hidden="true">
      <span className="glim-mini-orb-halo" />
      <span className="glim-mini-orb-core">
        <span className="glim-mini-orb-spark">✦</span>
      </span>
    </span>
  )
}

// Closed → the "Ask Glim" glass pill (a button). Open → the pill morphs into the
// question input with a violet send button. Enter or the send button submits.
export function Launcher({ open, onToggle, onSubmit }: LauncherProps) {
  const [inputValue, setInputValue] = useState('')

  function submitQuestion() {
    const trimmedQuestion = inputValue.trim()
    if (trimmedQuestion.length === 0) return
    onSubmit(trimmedQuestion)
    setInputValue('')
  }

  function handleInputKeyDown(keyboardEvent: KeyboardEvent<HTMLInputElement>) {
    if (keyboardEvent.key !== 'Enter') return
    submitQuestion()
  }

  return (
    <div className="glim-launcher">
      {open ? (
        <div className="glim-launcher-input-wrap">
          <MiniOrb />
          <input
            className="glim-launcher-input"
            type="text"
            placeholder="ask glim anything…"
            value={inputValue}
            onChange={(changeEvent) => setInputValue(changeEvent.target.value)}
            onKeyDown={handleInputKeyDown}
            autoFocus
          />
          <button
            type="button"
            className="glim-send"
            aria-label="send question"
            disabled={inputValue.trim().length === 0}
            onClick={submitQuestion}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="glim-launcher-pill"
          aria-label="ask glim"
          onClick={onToggle}
        >
          <MiniOrb />
          <span className="glim-launcher-label">Ask Glim</span>
        </button>
      )}
    </div>
  )
}
