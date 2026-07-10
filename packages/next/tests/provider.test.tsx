// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { encodeSSE } from '../src/protocol/sse'
import type { GlimServerEvent } from '../src/protocol/events'
import type { GlimTurnRequest } from '../src/protocol/messages'
import { GlimProvider } from '../src/client/GlimProvider'
import { useGlim, type GlimApi } from '../src/client/useGlim'
import { useGlimTool } from '../src/client/useGlimTool'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

// ---- helpers ---------------------------------------------------------------

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

interface RecordedFetchCall {
  url: string
  body: GlimTurnRequest
}

function installFetchMock(responsesPerCall: GlimServerEvent[][]): RecordedFetchCall[] {
  const recordedCalls: RecordedFetchCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const callIndex = recordedCalls.length
    recordedCalls.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as GlimTurnRequest,
    })
    const events = responsesPerCall[callIndex]
    if (!events) {
      throw new Error('unexpected fetch call number ' + String(callIndex))
    }
    return sseResponse(events)
  })
  vi.stubGlobal('fetch', fetchMock)
  return recordedCalls
}

function shadowTextContent(): string {
  const host = document.querySelector('div[data-glim-root]')
  return host?.shadowRoot?.textContent ?? ''
}

function shadowInnerHTML(): string {
  const host = document.querySelector('div[data-glim-root]')
  return host?.shadowRoot?.innerHTML ?? ''
}

let capturedGlimApi: GlimApi | null = null
function CaptureGlimApi(): null {
  capturedGlimApi = useGlim()
  return null
}

function BillingTool(): null {
  useGlimTool('open_billing_modal', 'opens the billing dialog', () => 'modal is open')
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

it('streams say_delta text into the speech bubble', async () => {
  installFetchMock([
    [
      { type: 'say_delta', text: 'hey ' },
      { type: 'say_delta', text: 'there' },
      { type: 'done', suspended: false },
    ],
  ])

  render(
    <GlimProvider>
      <CaptureGlimApi />
    </GlimProvider>,
  )

  act(() => {
    capturedGlimApi!.ask('hello?')
  })

  await waitFor(() => {
    expect(shadowTextContent()).toContain('hey')
    expect(shadowTextContent()).toContain('there')
  })
})

it('scrolls to and lands beside the pointed element (reduced-motion path)', async () => {
  const scrollIntoViewMock = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoViewMock

  installFetchMock([
    [
      { type: 'say_delta', text: 'hit publish right here' },
      { type: 'point', ref: 'e1', description: 'the publish button' },
      { type: 'done', suspended: false },
    ],
  ])

  render(
    <GlimProvider>
      <button type="button">Publish</button>
      <CaptureGlimApi />
    </GlimProvider>,
  )

  // Place the button below the fold: offscreen triggers scrollIntoView, and
  // the landing position is computed from this rect (jsdom viewport 1024x768).
  const publishButton = document.querySelector('button')!
  publishButton.getBoundingClientRect = () =>
    ({
      x: 100,
      y: 2000,
      left: 100,
      top: 2000,
      right: 180,
      bottom: 2030,
      width: 80,
      height: 30,
      toJSON: () => ({}),
    }) as DOMRect

  act(() => {
    capturedGlimApi!.ask('how do i publish?')
  })

  await waitFor(() => {
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  // computeFlight end: x = rect.right(180) + LAND_OFFSET_X(8) = 188,
  // y = rect.bottom(2030) + LAND_OFFSET_Y(12) clamped to 768 - EDGE_PADDING(20) = 748.
  await waitFor(() => {
    expect(shadowInnerHTML()).toContain('188')
    expect(shadowInnerHTML()).toContain('748')
  })
})

it('runs a useGlimTool function and sends its result in the resume request body', async () => {
  const recordedCalls = installFetchMock([
    [
      { type: 'tool_call', id: 'toolu_01', name: 'open_billing_modal', input: {} },
      { type: 'history', messages: [{ role: 'assistant', content: 'placeholder' }] },
      { type: 'done', suspended: true },
    ],
    [
      { type: 'say_delta', text: 'opened it for you' },
      { type: 'done', suspended: false },
    ],
  ])

  render(
    <GlimProvider>
      <BillingTool />
      <CaptureGlimApi />
    </GlimProvider>,
  )

  act(() => {
    capturedGlimApi!.ask('open my billing settings')
  })

  await waitFor(() => {
    expect(recordedCalls).toHaveLength(2)
  })

  expect(recordedCalls[0]!.url).toBe('/api/glim')
  expect(recordedCalls[0]!.body.kind).toBe('ask')
  expect(recordedCalls[0]!.body.clientTools).toEqual([
    { name: 'open_billing_modal', description: 'opens the billing dialog' },
  ])

  expect(recordedCalls[1]!.body.kind).toBe('resume')
  expect(recordedCalls[1]!.body.toolResults).toEqual([
    { toolUseId: 'toolu_01', result: 'modal is open' },
  ])
})

it('cancels the active waiter and resets visible state when enabled flips to false mid-conversation', async () => {
  const recordedCalls = installFetchMock([
    [
      { type: 'point', ref: 'e1', description: 'the delete button' },
      { type: 'wait_for', id: 'toolu_01', condition: { kind: 'click' } },
      { type: 'history', messages: [] },
      { type: 'done', suspended: true },
    ],
  ])

  const { rerender } = render(
    <GlimProvider enabled={true}>
      <button type="button">Delete</button>
      <CaptureGlimApi />
    </GlimProvider>,
  )

  act(() => {
    capturedGlimApi!.ask('how do i delete this?')
  })

  await waitFor(() => {
    expect(capturedGlimApi!.status).toBe('waiting')
  })

  // Route becomes disallowed mid-wait (e.g. the host app's own gating logic
  // flips `enabled` to false). CaptureGlimApi is dropped here on purpose —
  // useGlim() throws with no <GlimProvider> context, matching what actually
  // renders when the host stops rendering the context/UI branch.
  rerender(
    <GlimProvider enabled={false}>
      <button type="button">Delete</button>
    </GlimProvider>,
  )

  expect(document.querySelector('[data-glim-root]')).toBeNull()

  // If the waiter's document click listener were still attached, this would
  // resolve it and trigger a resume POST.
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(recordedCalls).toHaveLength(1)

  // Re-enabling should start clean, not resume into a stale mid-turn bubble.
  // Bubble renders null when its text is empty, so its absence (rather than
  // shadowTextContent(), which always contains the injected <style> text)
  // is the precise signal that the reset actually took effect.
  rerender(
    <GlimProvider enabled={true}>
      <button type="button">Delete</button>
      <CaptureGlimApi />
    </GlimProvider>,
  )
  const shadowRootAfterReenable = document.querySelector('[data-glim-root]')?.shadowRoot
  expect(shadowRootAfterReenable?.querySelector('.glim-bubble')).toBeNull()
})

it('useGlim throws a clear error outside of <GlimProvider>', () => {
  function Orphan(): null {
    useGlim()
    return null
  }
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<Orphan />)).toThrow('useGlim must be used within a <GlimProvider>')
  consoleErrorSpy.mockRestore()
})

it('exposes the public API from both package entry points', async () => {
  const clientEntry = await import('../src/index')
  expect(typeof clientEntry.GlimProvider).toBe('function')
  expect(typeof clientEntry.useGlim).toBe('function')
  expect(typeof clientEntry.useGlimTool).toBe('function')
  expect(typeof clientEntry.defineGuide).toBe('function')
  expect(typeof clientEntry.point).toBe('function')
  expect(typeof clientEntry.waitFor).toBe('function')
  expect(typeof clientEntry.say).toBe('function')

  const serverEntry = await import('../src/server')
  expect(typeof serverEntry.createGlimHandler).toBe('function')
  expect(typeof serverEntry.defineGuide).toBe('function')
  expect(typeof serverEntry.point).toBe('function')
  expect(typeof serverEntry.waitFor).toBe('function')
  expect(typeof serverEntry.say).toBe('function')
})
