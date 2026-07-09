import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlimEngine, createToolRegistry } from '../src/client/engine'
import { createWaiter } from '../src/client/waiters'
import type { EngineBindings } from '../src/client/engine'
import type { Snapshotter } from '../src/snapshot/snapshotter'

function sseResponse(events: object[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function makeBindings(): EngineBindings & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { onSayDelta: [], onBubbleReset: [], onPoint: [], onStatus: [], onError: [] }
  return {
    calls,
    onSayDelta: (t) => calls.onSayDelta.push([t]),
    onBubbleReset: () => calls.onBubbleReset.push([]),
    onPoint: (r, d) => calls.onPoint.push([r, d]),
    onStatus: (s) => calls.onStatus.push([s]),
    onError: (m) => calls.onError.push([m]),
  }
}

const fakeSnapshotter: Snapshotter = { capture: () => '[main] "test page"', resolve: () => null }

function makeEngine(bindings: EngineBindings) {
  return new GlimEngine({
    endpoint: '/api/glim',
    snapshotter: fakeSnapshotter,
    tools: createToolRegistry(),
    bindings,
    waiters: createWaiter,
  })
}

describe('engine resilience', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries once on a retryable error and succeeds silently', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([{ type: 'error', message: 'overloaded', retryable: true }, { type: 'done', suspended: false }]))
      .mockResolvedValueOnce(sseResponse([{ type: 'say_delta', text: 'hi there' }, { type: 'history', messages: [] }, { type: 'done', suspended: false }]))
    vi.stubGlobal('fetch', fetchMock)

    const bindings = makeBindings()
    const engine = makeEngine(bindings)
    const turn = engine.ask('hello')
    await vi.advanceTimersByTimeAsync(1500)
    await turn

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bindings.calls.onError).toHaveLength(0)
    expect(bindings.calls.onSayDelta.flat().join('')).toContain('hi there')
    // the two request bodies are identical
    expect(fetchMock.mock.calls[0][1]!.body).toEqual(fetchMock.mock.calls[1][1]!.body)
  })

  it('surfaces the error when the retry also fails', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(sseResponse([{ type: 'error', message: 'overloaded', retryable: true }, { type: 'done', suspended: false }])))
    vi.stubGlobal('fetch', fetchMock)

    const bindings = makeBindings()
    const engine = makeEngine(bindings)
    const turn = engine.ask('hello')
    await vi.advanceTimersByTimeAsync(1500)
    await turn

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bindings.calls.onError).toHaveLength(1)
    expect(bindings.calls.onStatus.flat()).toContain('error')
  })

  it('does not retry non-retryable errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse([{ type: 'error', message: 'bad request', retryable: false }, { type: 'done', suspended: false }]))
    vi.stubGlobal('fetch', fetchMock)

    const bindings = makeBindings()
    const engine = makeEngine(bindings)
    await engine.ask('hello')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bindings.calls.onError).toHaveLength(1)
  })

  it('nudges once after 60s of waiting, and not after resolution', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([
        { type: 'say_delta', text: 'click it' },
        { type: 'wait_for', id: 'tu_1', condition: { kind: 'click' } },
        { type: 'history', messages: [{ role: 'user', content: 'x' }] },
        { type: 'done', suspended: true },
      ]))
      .mockResolvedValueOnce(sseResponse([{ type: 'say_delta', text: 'nice' }, { type: 'done', suspended: false }]))
    vi.stubGlobal('fetch', fetchMock)

    const bindings = makeBindings()
    const engine = makeEngine(bindings)
    const turn = engine.ask('guide me')
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(60000)
    const nudges = bindings.calls.onSayDelta.flat().filter((t) => String(t).includes('still with me?'))
    expect(nudges).toHaveLength(1)

    document.body.click()
    await vi.advanceTimersByTimeAsync(120000)
    await turn
    const nudgesAfter = bindings.calls.onSayDelta.flat().filter((t) => String(t).includes('still with me?'))
    expect(nudgesAfter).toHaveLength(1)
  })

  it('hasRestoredHistory reflects sessionStorage state', () => {
    sessionStorage.setItem('glim:history', JSON.stringify([{ role: 'user', content: 'earlier' }]))
    expect(makeEngine(makeBindings()).hasRestoredHistory()).toBe(true)

    sessionStorage.setItem('glim:history', JSON.stringify([]))
    expect(makeEngine(makeBindings()).hasRestoredHistory()).toBe(false)

    sessionStorage.removeItem('glim:history')
    expect(makeEngine(makeBindings()).hasRestoredHistory()).toBe(false)
  })
})
