import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { createToolRegistry, GlimEngine } from '../src/client/engine.js'
import type { ClientToolRegistry, EngineBindings, GlimStatus } from '../src/client/engine.js'
import { encodeSSE } from '../src/protocol/sse.js'
import type { WaitForCondition, GlimServerEvent } from '../src/protocol/events.js'
import type { Snapshotter } from '../src/snapshot/snapshotter.js'
import type { WaiterFactory } from '../src/client/waiters.js'

// ---------- shared test doubles ----------

let fetchMock: Mock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Builds a Response whose body is the SSE encoding of the given events —
// exactly what the route handler would stream.
function sseResponse(events: GlimServerEvent[]): Response {
  const sseBody = events.map((event) => encodeSSE(event)).join('')
  return new Response(sseBody, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function requestBodyOfCall(callIndex: number): Record<string, unknown> {
  const requestInit = fetchMock.mock.calls[callIndex][1] as RequestInit
  return JSON.parse(requestInit.body as string) as Record<string, unknown>
}

interface RecordedBindings {
  bindings: EngineBindings
  sayDeltas: string[]
  statuses: GlimStatus[]
  points: Array<{ ref: string; description: string }>
  errors: string[]
  bubbleResetCount: () => number
}

function createRecordingBindings(): RecordedBindings {
  const sayDeltas: string[] = []
  const statuses: GlimStatus[] = []
  const points: Array<{ ref: string; description: string }> = []
  const errors: string[] = []
  let bubbleResets = 0
  return {
    bindings: {
      onSayDelta(text: string): void {
        sayDeltas.push(text)
      },
      onBubbleReset(): void {
        bubbleResets += 1
      },
      onPoint(ref: string, description: string): void {
        points.push({ ref, description })
      },
      onStatus(status: GlimStatus): void {
        statuses.push(status)
      },
      onError(message: string): void {
        errors.push(message)
      },
    },
    sayDeltas,
    statuses,
    points,
    errors,
    bubbleResetCount: () => bubbleResets,
  }
}

// Every capture() returns 'snapshot-1', 'snapshot-2', ... so tests can assert
// that resume requests carry a FRESH capture, not a reused one.
function createCountingSnapshotter(): Snapshotter {
  let captureCount = 0
  return {
    capture(): string {
      captureCount += 1
      return `snapshot-${captureCount}`
    },
    resolve(): Element | null {
      return null
    },
  }
}

interface CreatedWaiter {
  condition: WaitForCondition
  resolveWith: (result: string) => void
  wasCancelled: boolean
}

function createControllableWaiterFactory(): { factory: WaiterFactory; created: CreatedWaiter[] } {
  const created: CreatedWaiter[] = []
  const factory: WaiterFactory = (condition) => {
    let resolveWith!: (result: string) => void
    const promise = new Promise<string>((resolve) => {
      resolveWith = resolve
    })
    const createdWaiter: CreatedWaiter = { condition, resolveWith, wasCancelled: false }
    created.push(createdWaiter)
    return {
      promise,
      cancel(): void {
        createdWaiter.wasCancelled = true
      },
    }
  }
  return { factory, created }
}

interface EngineHarness {
  engine: GlimEngine
  recorded: RecordedBindings
  tools: ClientToolRegistry
}

function createEngineHarness(options?: { waiterFactory?: WaiterFactory; tools?: ClientToolRegistry }): EngineHarness {
  const recorded = createRecordingBindings()
  const tools = options?.tools ?? createToolRegistry()
  const engine = new GlimEngine({
    endpoint: '/api/glim',
    snapshotter: createCountingSnapshotter(),
    tools,
    bindings: recorded.bindings,
    waiters: options?.waiterFactory ?? createControllableWaiterFactory().factory,
  })
  return { engine, recorded, tools }
}

// ---------- createToolRegistry ----------

describe('createToolRegistry', () => {
  it('lists registered tools as specs and removes them on unregister', () => {
    const registry = createToolRegistry()
    const unregister = registry.register('open_billing_modal', 'opens the billing dialog', () => 'modal is open')
    expect(registry.specs()).toEqual([{ name: 'open_billing_modal', description: 'opens the billing dialog' }])
    unregister()
    expect(registry.specs()).toEqual([])
  })

  it('run executes the registered function and returns its result', async () => {
    const registry = createToolRegistry()
    registry.register('read_cart_total', 'reads the current cart total', async () => 'the cart total is $42')
    await expect(registry.run('read_cart_total')).resolves.toBe('the cart total is $42')
  })

  it('run returns an explanatory message for an unknown tool name', async () => {
    const registry = createToolRegistry()
    await expect(registry.run('missing_tool')).resolves.toBe('no client tool named "missing_tool" is registered')
  })
})

// ---------- basic ask turn ----------

describe('GlimEngine ask', () => {
  it('streams say deltas and points with thinking -> speaking -> pointing -> speaking -> idle transitions', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { type: 'say_delta', text: 'hey ' },
        { type: 'say_delta', text: 'there — ' },
        { type: 'point', ref: 'e14', description: 'the Publish button' },
        { type: 'say_delta', text: 'hit publish' },
        { type: 'history', messages: [{ turn: 'first' }] },
        { type: 'done', suspended: false },
      ]),
    )
    const { engine, recorded } = createEngineHarness()
    await engine.ask('how do i publish?')
    expect(recorded.sayDeltas).toEqual(['hey ', 'there — ', 'hit publish'])
    expect(recorded.points).toEqual([{ ref: 'e14', description: 'the Publish button' }])
    expect(recorded.statuses).toEqual(['thinking', 'speaking', 'pointing', 'speaking', 'idle'])
    expect(recorded.bubbleResetCount()).toBe(1)
    expect(recorded.errors).toEqual([])
  })

  it('POSTs an ask request carrying question, snapshot, url, history, and client tool specs', async () => {
    fetchMock.mockResolvedValueOnce(sseResponse([{ type: 'done', suspended: false }]))
    const tools = createToolRegistry()
    tools.register('open_billing_modal', 'opens the billing dialog', () => 'modal is open')
    const { engine } = createEngineHarness({ tools })
    await engine.ask('how do i upgrade?')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/glim')
    expect(requestBodyOfCall(0)).toEqual({
      kind: 'ask',
      question: 'how do i upgrade?',
      snapshot: 'snapshot-1',
      url: window.location.href,
      history: [],
      clientTools: [{ name: 'open_billing_modal', description: 'opens the billing dialog' }],
    })
  })
})

// ---------- suspend / resume ----------

describe('GlimEngine suspend and resume', () => {
  it('suspends on wait_for and resumes with the waiter result, fresh snapshot, and stored history', async () => {
    const { factory, created } = createControllableWaiterFactory()
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'say_delta', text: 'hit publish right here' },
          { type: 'wait_for', id: 'toolu_wait_1', condition: { kind: 'click', ref: 'e14' } },
          { type: 'history', messages: [{ turn: 'first' }] },
          { type: 'done', suspended: true },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'say_delta', text: 'nice — you are live!' },
          { type: 'history', messages: [{ turn: 'first' }, { turn: 'second' }] },
          { type: 'done', suspended: false },
        ]),
      )
    const { engine, recorded } = createEngineHarness({ waiterFactory: factory })
    const askPromise = engine.ask('how do i publish?')
    await vi.waitFor(() => {
      expect(created).toHaveLength(1)
    })
    expect(recorded.statuses).toEqual(['thinking', 'speaking', 'waiting'])
    expect(created[0].condition).toEqual({ kind: 'click', ref: 'e14' })
    created[0].resolveWith('the user clicked it')
    await askPromise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodyOfCall(1)).toEqual({
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_wait_1', result: 'the user clicked it' }],
      snapshot: 'snapshot-2',
      url: window.location.href,
      history: [{ turn: 'first' }],
      clientTools: [],
    })
    expect(recorded.sayDeltas).toEqual(['hit publish right here', 'nice — you are live!'])
    expect(recorded.statuses).toEqual(['thinking', 'speaking', 'waiting', 'speaking', 'idle'])
  })

  it('auto-resumes get_snapshot with a fresh capture as the tool result', async () => {
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'get_snapshot', id: 'toolu_snap_1' },
          { type: 'history', messages: [{ turn: 'first' }] },
          { type: 'done', suspended: true },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'say_delta', text: 'you are on the listings page' },
          { type: 'history', messages: [{ turn: 'first' }, { turn: 'second' }] },
          { type: 'done', suspended: false },
        ]),
      )
    const { engine } = createEngineHarness()
    await engine.ask('where am i?')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodyOfCall(1)).toEqual({
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_snap_1', result: 'snapshot-2' }],
      snapshot: 'snapshot-3',
      url: window.location.href,
      history: [{ turn: 'first' }],
      clientTools: [],
    })
  })

  it('runs a registered client tool on tool_call and resumes with its return value', async () => {
    const toolFn = vi.fn(async () => 'modal is open')
    const tools = createToolRegistry()
    tools.register('open_billing_modal', 'opens the billing dialog', toolFn)
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'tool_call', id: 'toolu_tool_1', name: 'open_billing_modal', input: {} },
          { type: 'history', messages: [{ turn: 'first' }] },
          { type: 'done', suspended: true },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'say_delta', text: 'opened it for you' },
          { type: 'history', messages: [{ turn: 'first' }, { turn: 'second' }] },
          { type: 'done', suspended: false },
        ]),
      )
    const { engine } = createEngineHarness({ tools })
    await engine.ask('open billing')
    expect(toolFn).toHaveBeenCalledTimes(1)
    expect(requestBodyOfCall(1)).toEqual({
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_tool_1', result: 'modal is open' }],
      snapshot: 'snapshot-2',
      url: window.location.href,
      history: [{ turn: 'first' }],
      clientTools: [{ name: 'open_billing_modal', description: 'opens the billing dialog' }],
    })
  })

  it('a second ask aborts the in-flight turn, cancels the active waiter, and swallows the AbortError', async () => {
    const { factory, created } = createControllableWaiterFactory()
    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'say_delta', text: 'first turn' },
          { type: 'wait_for', id: 'toolu_wait_1', condition: { kind: 'click' } },
          { type: 'history', messages: [{ turn: 'first' }] },
          { type: 'done', suspended: true },
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { type: 'say_delta', text: 'second turn' },
          { type: 'history', messages: [{ turn: 'second' }] },
          { type: 'done', suspended: false },
        ]),
      )
    const { engine, recorded } = createEngineHarness({ waiterFactory: factory })
    const firstAskPromise = engine.ask('first question')
    await vi.waitFor(() => {
      expect(created).toHaveLength(1)
    })
    const sayDeltaCountBeforeSecondAsk = recorded.sayDeltas.length
    await engine.ask('second question')
    // Resolves without throwing: the engine swallows the AbortError internally.
    await firstAskPromise
    expect(created[0].wasCancelled).toBe(true)
    const firstFetchInit = fetchMock.mock.calls[0][1] as RequestInit
    expect((firstFetchInit.signal as AbortSignal).aborted).toBe(true)
    // The aborted first turn never POSTed a resume: only the two ask requests exist.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBodyOfCall(1).kind).toBe('ask')
    expect(requestBodyOfCall(1).history).toEqual([])
    // The aborted turn produced no further binding calls after the second ask began.
    expect(recorded.sayDeltas.slice(sayDeltaCountBeforeSecondAsk)).toEqual(['second turn'])
    expect(recorded.errors).toEqual([])
    expect(recorded.bubbleResetCount()).toBe(2)
  })
})

// ---------- sessionStorage round-trip ----------

describe('GlimEngine history persistence', () => {
  it('persists history events to sessionStorage under glim:history', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { type: 'history', messages: [{ role: 'user', content: 'hi' }] },
        { type: 'done', suspended: false },
      ]),
    )
    const { engine } = createEngineHarness()
    await engine.ask('hi')
    expect(window.sessionStorage.getItem('glim:history')).toBe(JSON.stringify([{ role: 'user', content: 'hi' }]))
  })

  it('loads persisted history in the constructor and sends it on the next ask', async () => {
    window.sessionStorage.setItem('glim:history', JSON.stringify([{ role: 'user', content: 'earlier' }]))
    fetchMock.mockResolvedValueOnce(sseResponse([{ type: 'done', suspended: false }]))
    const { engine } = createEngineHarness()
    await engine.ask('want to pick back up?')
    expect(requestBodyOfCall(0).history).toEqual([{ role: 'user', content: 'earlier' }])
  })
})
