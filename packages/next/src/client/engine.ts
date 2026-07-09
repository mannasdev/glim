import type { GlimServerEvent } from '../protocol/events.js'
import type { ClientToolSpec, ToolResultPayload, GlimTurnRequest } from '../protocol/messages.js'
import { parseSSE } from '../protocol/sse.js'
import type { Snapshotter } from '../snapshot/snapshotter.js'
import type { WaiterFactory } from './waiters.js'

export type GlimStatus = 'idle' | 'thinking' | 'speaking' | 'pointing' | 'waiting' | 'error'

export interface EngineBindings {
  onSayDelta(text: string): void
  onBubbleReset(): void
  onPoint(ref: string, description: string): void
  onStatus(status: GlimStatus): void
  onError(message: string): void
}

export interface ClientToolRegistry {
  register(name: string, description: string, fn: () => Promise<string> | string): () => void
  specs(): ClientToolSpec[]
  run(name: string): Promise<string>
}

export function createToolRegistry(): ClientToolRegistry {
  const registeredTools = new Map<string, { description: string; fn: () => Promise<string> | string }>()
  return {
    register(name: string, description: string, fn: () => Promise<string> | string): () => void {
      registeredTools.set(name, { description, fn })
      return () => {
        registeredTools.delete(name)
      }
    },
    specs(): ClientToolSpec[] {
      return Array.from(registeredTools.entries()).map(([name, registeredTool]) => ({
        name,
        description: registeredTool.description,
      }))
    },
    async run(name: string): Promise<string> {
      const registeredTool = registeredTools.get(name)
      if (registeredTool === undefined) {
        // Returned to the model as a tool_result so it can recover in words
        // instead of the whole turn failing on a missing registration.
        return `no client tool named "${name}" is registered`
      }
      return await registeredTool.fn()
    },
  }
}

const HISTORY_STORAGE_KEY = 'glim:history'

// POSTs one loop segment to the glim route handler and yields the typed SSE
// events from the response body as they arrive.
async function* postTurn(
  endpoint: string,
  request: GlimTurnRequest,
  signal: AbortSignal,
): AsyncGenerator<GlimServerEvent> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) {
    throw new Error(`glim request failed with status ${response.status}`)
  }
  if (response.body === null) {
    throw new Error('glim request returned no response body')
  }
  yield* parseSSE(response.body)
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  )
}

export class GlimEngine {
  private readonly endpoint: string
  private readonly snapshotter: Snapshotter
  private readonly tools: ClientToolRegistry
  private readonly bindings: EngineBindings
  private readonly waiters: WaiterFactory

  private history: unknown[]
  private currentStatus: GlimStatus = 'idle'
  private inFlightAbortController: AbortController | null = null
  private activeWaiter: { promise: Promise<string>; cancel(): void } | null = null
  private restoredHistory = false
  private idleNudgeTimer: ReturnType<typeof setTimeout> | null = null
  private retriedThisPost = false

  constructor(opts: {
    endpoint: string
    snapshotter: Snapshotter
    tools: ClientToolRegistry
    bindings: EngineBindings
    waiters: WaiterFactory
  }) {
    this.endpoint = opts.endpoint
    this.snapshotter = opts.snapshotter
    this.tools = opts.tools
    this.bindings = opts.bindings
    this.waiters = opts.waiters
    this.history = this.loadPersistedHistory()
  }

  hasRestoredHistory(): boolean {
    return this.restoredHistory
  }

  // A new question interrupts everything from the previous turn instantly:
  // abort the in-flight request, cancel any active waiter, reset the bubble.
  async ask(question: string): Promise<void> {
    // cancel() already clears any pending idle-nudge timer from a prior
    // suspended wait, satisfying the "clear at the start of a new ask()"
    // requirement without a redundant second clear here.
    this.cancel()
    this.bindings.onBubbleReset()
    const turnAbortController = new AbortController()
    this.inFlightAbortController = turnAbortController
    this.setStatus('thinking')
    const askRequest: GlimTurnRequest = {
      kind: 'ask',
      question,
      snapshot: this.snapshotter.capture(),
      url: window.location.href,
      history: this.history,
      clientTools: this.tools.specs(),
    }
    await this.runTurn(askRequest, turnAbortController)
  }

  cancel(): void {
    if (this.inFlightAbortController !== null) {
      this.inFlightAbortController.abort()
      this.inFlightAbortController = null
    }
    if (this.activeWaiter !== null) {
      this.activeWaiter.cancel()
      this.activeWaiter = null
    }
    this.clearIdleNudge()
  }

  // Runs loop segments until the turn completes: each suspended segment
  // (wait_for / get_snapshot / tool_call) produces the resume request for the next.
  private async runTurn(initialRequest: GlimTurnRequest, turnAbortController: AbortController): Promise<void> {
    try {
      let nextRequest: GlimTurnRequest | null = initialRequest
      while (nextRequest !== null) {
        nextRequest = await this.runSegment(nextRequest, turnAbortController)
      }
    } catch (error) {
      if (isAbortError(error) || turnAbortController.signal.aborted) {
        // A newer ask() aborted this turn on purpose — swallow silently so the
        // stale turn produces no further binding calls.
        return
      }
      this.bindings.onError(error instanceof Error ? error.message : String(error))
      this.setStatus('error')
    }
  }

  private async runSegment(
    request: GlimTurnRequest,
    turnAbortController: AbortController,
  ): Promise<GlimTurnRequest | null> {
    let resumePayload: ToolResultPayload | null = null
    let turnCompletedWithoutSuspend = false
    // Each POST (the initial ask or a resume) gets exactly one automatic
    // retry on a retryable error — reset here so every segment starts fresh,
    // then consumed within the loop below rather than by re-entering
    // runSegment (which would otherwise reset the flag and retry forever).
    this.retriedThisPost = false

    let shouldRetryWithIdenticalBody = true
    while (shouldRetryWithIdenticalBody) {
      shouldRetryWithIdenticalBody = false

      for await (const event of postTurn(this.endpoint, request, turnAbortController.signal)) {
        switch (event.type) {
          case 'say_delta':
            this.setStatus('speaking')
            this.bindings.onSayDelta(event.text)
            break
          case 'point':
            this.setStatus('pointing')
            this.bindings.onPoint(event.ref, event.description)
            break
          case 'wait_for': {
            this.setStatus('waiting')
            const waiter = this.waiters(event.condition, (ref) => this.snapshotter.resolve(ref))
            this.activeWaiter = waiter
            this.clearIdleNudge()
            this.idleNudgeTimer = setTimeout(() => {
              this.bindings.onSayDelta(' still with me?')
            }, 60000)
            const waiterResult = await this.resolveUnlessAborted(waiter.promise, turnAbortController.signal)
            this.clearIdleNudge()
            if (this.activeWaiter === waiter) {
              this.activeWaiter = null
            }
            resumePayload = { toolUseId: event.id, result: waiterResult }
            break
          }
          case 'get_snapshot':
            resumePayload = { toolUseId: event.id, result: this.snapshotter.capture() }
            break
          case 'tool_call': {
            const toolResult = await this.tools.run(event.name)
            resumePayload = { toolUseId: event.id, result: toolResult }
            break
          }
          case 'history':
            this.history = event.messages
            this.persistHistory()
            break
          case 'guide_started':
            // Informational only; the provider layer may surface it later.
            break
          case 'error':
            if (event.retryable && !this.retriedThisPost) {
              // Stop consuming this stream now — the retry re-sends the same
              // request body from scratch, so any partial deltas already
              // delivered from this failed attempt are superseded below. Reset
              // the bubble first so those partial deltas don't prepend the
              // retry's text (e.g. 'nice —nice — your place is live!').
              this.retriedThisPost = true
              shouldRetryWithIdenticalBody = true
              this.bindings.onBubbleReset()
            } else {
              this.bindings.onError(event.message)
              this.setStatus('error')
            }
            break
          case 'done':
            if (!event.suspended) {
              turnCompletedWithoutSuspend = true
            }
            break
        }
        if (shouldRetryWithIdenticalBody) {
          break
        }
      }

      if (turnAbortController.signal.aborted) {
        return null
      }

      if (shouldRetryWithIdenticalBody) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1500))
        if (turnAbortController.signal.aborted) {
          return null
        }
        // Loop back and re-POST the identical request body — the one
        // automatic retry for this segment.
      }
    }

    if (resumePayload !== null) {
      return {
        kind: 'resume',
        toolResults: [resumePayload],
        snapshot: this.snapshotter.capture(),
        url: window.location.href,
        history: this.history,
        clientTools: this.tools.specs(),
      }
    }

    if (turnCompletedWithoutSuspend) {
      if (this.inFlightAbortController === turnAbortController) {
        this.inFlightAbortController = null
      }
      // done{suspended:false} directly follows an error event on API failures;
      // keep 'error' visible instead of clobbering it with 'idle'.
      if (this.currentStatus !== 'error') {
        this.setStatus('idle')
      }
    }
    return null
  }

  // Awaits a waiter promise but rejects with an AbortError the moment the turn
  // is aborted, so a superseded turn never continues past its waiter.
  private resolveUnlessAborted(waiterPromise: Promise<string>, signal: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const rejectAsAborted = (): void => {
        reject(new DOMException('the glim turn was aborted', 'AbortError'))
      }
      if (signal.aborted) {
        rejectAsAborted()
        return
      }
      signal.addEventListener('abort', rejectAsAborted, { once: true })
      waiterPromise.then(
        (result) => {
          signal.removeEventListener('abort', rejectAsAborted)
          resolve(result)
        },
        (error: unknown) => {
          signal.removeEventListener('abort', rejectAsAborted)
          reject(error instanceof Error ? error : new Error(String(error)))
        },
      )
    })
  }

  private setStatus(status: GlimStatus): void {
    if (this.currentStatus === status) {
      return
    }
    this.currentStatus = status
    this.bindings.onStatus(status)
  }

  private loadPersistedHistory(): unknown[] {
    try {
      const storedHistory = window.sessionStorage.getItem(HISTORY_STORAGE_KEY)
      if (storedHistory === null) {
        return []
      }
      const parsedHistory: unknown = JSON.parse(storedHistory)
      const restoredMessages = Array.isArray(parsedHistory) ? parsedHistory : []
      // Reload greeting only makes sense when there is actually prior
      // conversation to pick back up — an empty array is not a restore.
      this.restoredHistory = restoredMessages.length > 0
      return restoredMessages
    } catch {
      // sessionStorage unavailable or corrupted JSON — start with empty history.
      return []
    }
  }

  private clearIdleNudge(): void {
    if (this.idleNudgeTimer !== null) {
      clearTimeout(this.idleNudgeTimer)
      this.idleNudgeTimer = null
    }
  }

  private persistHistory(): void {
    try {
      window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history))
    } catch {
      // Quota exceeded or storage unavailable — history still lives in memory.
    }
  }
}
