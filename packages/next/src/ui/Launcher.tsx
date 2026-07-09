import { useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface LauncherProps {
  open: boolean
  onToggle(): void
  onSubmit(question: string): void
}

export function Launcher({ open, onToggle, onSubmit }: LauncherProps) {
  const [inputValue, setInputValue] = useState('')

  function handleInputKeyDown(keyboardEvent: KeyboardEvent<HTMLInputElement>) {
    if (keyboardEvent.key !== 'Enter') return
    const trimmedQuestion = inputValue.trim()
    if (trimmedQuestion.length === 0) return
    onSubmit(trimmedQuestion)
    setInputValue('')
  }

  return (
    <div className="glim-launcher">
      {open ? (
        <input
          className="glim-launcher-input"
          type="text"
          placeholder="ask glim anything…"
          value={inputValue}
          onChange={(changeEvent) => setInputValue(changeEvent.target.value)}
          onKeyDown={handleInputKeyDown}
          autoFocus
        />
      ) : null}
      <button type="button" className="glim-launcher-button" aria-label="ask glim" onClick={onToggle}>
        ✦
      </button>
    </div>
  )
}
