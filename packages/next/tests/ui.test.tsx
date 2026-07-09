// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { GlimRoot } from '../src/ui/GlimRoot'
import type { GlimStatus } from '../src/client/engine'

interface GlimRootTestProps {
  status: GlimStatus
  bubbleText: string
  glimPosition: { x: number; y: number }
  glimAngle: number
  glimScale: number
  onSubmit: (question: string) => void
  open: boolean
  onToggle: () => void
  reducedMotion: boolean
}

function makeProps(overrides: Partial<GlimRootTestProps> = {}): GlimRootTestProps {
  return {
    status: 'idle',
    bubbleText: '',
    glimPosition: { x: 120, y: 240 },
    glimAngle: 0,
    glimScale: 1,
    onSubmit: vi.fn(),
    open: false,
    onToggle: vi.fn(),
    reducedMotion: false,
    ...overrides,
  }
}

function getShadowRoot(): ShadowRoot {
  const hostElement = document.body.querySelector('[data-glim-root]')
  if (hostElement === null) throw new Error('expected a [data-glim-root] host on document.body')
  if (hostElement.shadowRoot === null) throw new Error('expected the [data-glim-root] host to have an open shadow root')
  return hostElement.shadowRoot
}

afterEach(() => {
  cleanup()
})

describe('GlimRoot', () => {
  it('mounts a [data-glim-root] host on document.body with an open shadow root and injected styles', () => {
    render(<GlimRoot {...makeProps()} />)
    const shadowRoot = getShadowRoot()
    const styleElement = shadowRoot.querySelector('style')
    expect(styleElement).not.toBeNull()
    expect(styleElement!.textContent).toContain('--glim-hue: 205')
    expect(styleElement!.textContent).toContain('glim-breathe')
    expect(shadowRoot.querySelector('.glim-container')).not.toBeNull()
  })

  it('applies the glim-reduced class when reducedMotion is true', () => {
    render(<GlimRoot {...makeProps({ reducedMotion: true })} />)
    const containerElement = getShadowRoot().querySelector('.glim-container')
    expect(containerElement!.classList.contains('glim-reduced')).toBe(true)
  })

  it('does not apply the glim-reduced class when reducedMotion is false', () => {
    render(<GlimRoot {...makeProps()} />)
    const containerElement = getShadowRoot().querySelector('.glim-container')
    expect(containerElement!.classList.contains('glim-reduced')).toBe(false)
  })
})

describe('Launcher', () => {
  it('shows the launcher button with aria-label "ask glim" and no input while closed; clicking calls onToggle', () => {
    const props = makeProps()
    render(<GlimRoot {...props} />)
    const shadowRoot = getShadowRoot()
    const launcherButton = shadowRoot.querySelector('button[aria-label="ask glim"]')
    expect(launcherButton).not.toBeNull()
    expect(shadowRoot.querySelector('input')).toBeNull()
    fireEvent.click(launcherButton!)
    expect(props.onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows an input when open; Enter with a non-empty value submits and clears, empty Enter does nothing', () => {
    const props = makeProps({ open: true })
    render(<GlimRoot {...props} />)
    const shadowRoot = getShadowRoot()
    const inputElement = shadowRoot.querySelector('input')
    expect(inputElement).not.toBeNull()

    fireEvent.keyDown(inputElement!, { key: 'Enter' })
    expect(props.onSubmit).not.toHaveBeenCalled()

    fireEvent.change(inputElement!, { target: { value: 'how do i publish?' } })
    fireEvent.keyDown(inputElement!, { key: 'Enter' })
    expect(props.onSubmit).toHaveBeenCalledWith('how do i publish?')
    expect((inputElement as HTMLInputElement).value).toBe('')
  })
})

describe('Bubble', () => {
  it('is hidden when bubbleText is empty and renders one .glim-word span per word otherwise', () => {
    const props = makeProps()
    const { rerender } = render(<GlimRoot {...props} />)
    expect(getShadowRoot().querySelector('.glim-bubble')).toBeNull()

    rerender(<GlimRoot {...props} bubbleText="hit publish right here" />)
    const wordSpans = getShadowRoot().querySelectorAll('.glim-word')
    expect(wordSpans.length).toBe(4)
    expect(getShadowRoot().querySelector('.glim-bubble')!.textContent).toContain('hit publish right here')
  })

  it('keeps already-rendered word spans mounted as the text grows', () => {
    const props = makeProps({ bubbleText: 'nice — your' })
    const { rerender } = render(<GlimRoot {...props} />)
    const initialWordSpans = Array.from(getShadowRoot().querySelectorAll('.glim-word'))
    expect(initialWordSpans.length).toBe(3)

    rerender(<GlimRoot {...props} bubbleText="nice — your place is live!" />)
    const grownWordSpans = Array.from(getShadowRoot().querySelectorAll('.glim-word'))
    expect(grownWordSpans.length).toBe(6)
    expect(grownWordSpans[0]).toBe(initialWordSpans[0])
    expect(grownWordSpans[1]).toBe(initialWordSpans[1])
    expect(grownWordSpans[2]).toBe(initialWordSpans[2])
  })
})

describe('Character', () => {
  it('positions the orb with a translate/rotate/scale transform', () => {
    render(<GlimRoot {...makeProps({ glimPosition: { x: 300, y: 150 }, glimAngle: 12, glimScale: 1.15 })} />)
    const orbElement = getShadowRoot().querySelector('.glim-orb') as HTMLElement
    expect(orbElement.style.transform).toBe('translate(300px, 150px) rotate(12deg) scale(1.15)')
  })

  it('renders particles only while flying (status pointing)', () => {
    const props = makeProps()
    const { rerender } = render(<GlimRoot {...props} />)
    expect(getShadowRoot().querySelectorAll('.glim-particle').length).toBe(0)

    rerender(<GlimRoot {...props} status="pointing" />)
    expect(getShadowRoot().querySelectorAll('.glim-particle').length).toBe(5)

    rerender(<GlimRoot {...props} status="idle" />)
    expect(getShadowRoot().querySelectorAll('.glim-particle').length).toBe(0)
  })
})
