// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { encodeSSE } from '../src/protocol/sse'
import type { GlimServerEvent } from '../src/protocol/events'
import { GlimProvider } from '../src/client/GlimProvider'
import { useGlim, type GlimApi } from '../src/client/useGlim'
import { CloudCharacter } from '../src/ui/CloudCharacter'
import type { GlimStatus } from '../src/client/engine'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

// ---- helpers (mirrors tests/provider.test.tsx) -----------------------------

function sseResponse(events: GlimServerEvent[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(encodeSSE(event)))
      }
      controller.close()
    },
  })
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

function installFetchMock(responsesPerCall: GlimServerEvent[][]): void {
  let callIndex = 0
  const fetchMock = vi.fn(async () => {
    const events = responsesPerCall[callIndex]
    callIndex += 1
    if (!events) {
      throw new Error('unexpected fetch call number ' + String(callIndex - 1))
    }
    return sseResponse(events)
  })
  vi.stubGlobal('fetch', fetchMock)
}

function getShadowRoot(): ShadowRoot {
  const hostElement = document.body.querySelector('[data-glim-root]')
  if (hostElement === null) throw new Error('expected a [data-glim-root] host on document.body')
  if (hostElement.shadowRoot === null) throw new Error('expected the host to have an open shadow root')
  return hostElement.shadowRoot
}

let capturedGlimApi: GlimApi | null = null
function CaptureGlimApi(): null {
  capturedGlimApi = useGlim()
  return null
}

beforeEach(() => {
  capturedGlimApi = null
  sessionStorage.clear()
  // Deterministic animations: report prefers-reduced-motion so pointing jumps
  // straight to the landing position instead of running a rAF flight.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.querySelectorAll('[data-glim-root]').forEach((node) => node.remove())
  document.body.innerHTML = ''
})

// ---- tests -----------------------------------------------------------------

describe('character prop', () => {
  it('renders the default orb (with particle-capable structure) when no character prop is given', () => {
    render(<GlimProvider />)
    const shadowRoot = getShadowRoot()
    expect(shadowRoot.querySelector('.glim-orb')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-orb-core')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-orb-bloom')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-orb-halo')).not.toBeNull()
  })

  it('renders a custom ReactNode character inside the transform wrapper, with the orb and particles absent', () => {
    render(<GlimProvider character={<div className="my-custom-character">hi</div>} />)
    const shadowRoot = getShadowRoot()

    const customNode = shadowRoot.querySelector('.my-custom-character') as HTMLElement | null
    expect(customNode).not.toBeNull()

    // The custom node rides inside the positioned/rotated/scaled wrapper.
    const transformWrapper = customNode!.closest('.glim-character-mount') as HTMLElement | null
    expect(transformWrapper).not.toBeNull()
    expect(transformWrapper!.style.transform).toContain('translate(')

    // Default orb + particles do not render when a character replaces them.
    expect(shadowRoot.querySelector('.glim-orb')).toBeNull()
    expect(shadowRoot.querySelectorAll('.glim-particle').length).toBe(0)
  })

  it('calls a render-function character with live {status, flying} and re-invokes it as status changes', async () => {
    const observedStates: Array<{ status: GlimStatus; flying: boolean }> = []
    const characterRenderFunction = (state: { status: GlimStatus; flying: boolean }): ReactNode => {
      observedStates.push({ status: state.status, flying: state.flying })
      return <div className="fn-character" data-status={state.status} data-flying={String(state.flying)} />
    }

    installFetchMock([
      [
        { type: 'say_delta', text: 'hello' },
        { type: 'done', suspended: false },
      ],
    ])

    render(
      <GlimProvider character={characterRenderFunction}>
        <CaptureGlimApi />
      </GlimProvider>,
    )

    // Initial render happened with the idle status.
    expect(observedStates.some((state) => state.status === 'idle')).toBe(true)
    const initialNode = getShadowRoot().querySelector('.fn-character') as HTMLElement
    expect(initialNode.getAttribute('data-status')).toBe('idle')

    act(() => {
      capturedGlimApi!.ask('hi there?')
    })

    // Driving a turn moves the engine through non-idle statuses, so the render
    // function must be re-invoked with a changed status.
    await waitFor(() => {
      expect(observedStates.some((state) => state.status !== 'idle')).toBe(true)
    })
  })
})

describe('CloudCharacter', () => {
  it('renders body, eyes, smile, blush, highlight, and antenna elements', () => {
    render(<GlimProvider character={<CloudCharacter />} />)
    const shadowRoot = getShadowRoot()

    expect(shadowRoot.querySelector('.glim-cloud')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-cloud-glow')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-cloud-body')).not.toBeNull()
    expect(shadowRoot.querySelectorAll('.glim-cloud-eye').length).toBe(2)
    expect(shadowRoot.querySelector('.glim-cloud-smile')).not.toBeNull()
    expect(shadowRoot.querySelectorAll('.glim-cloud-blush').length).toBe(2)
    expect(shadowRoot.querySelector('.glim-cloud-highlight')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-cloud-antenna')).not.toBeNull()
    expect(shadowRoot.querySelector('.glim-cloud-antenna-ball')).not.toBeNull()
  })

  it('injects the .glim-cloud stylesheet with reduced-motion handling', () => {
    render(<GlimProvider character={<CloudCharacter />} />)
    const styleText = getShadowRoot().querySelector('style')!.textContent ?? ''
    expect(styleText).toContain('.glim-cloud')
    expect(styleText).toContain('.glim-reduced .glim-cloud')
  })
})

describe('public surface', () => {
  it('exports CloudCharacter from the package index', async () => {
    const clientEntry = await import('../src/index')
    expect(typeof clientEntry.CloudCharacter).toBe('function')
  })
})
