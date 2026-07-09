import { describe, expect, it } from 'vitest'
import type { GlimServerEvent } from '../src/protocol/events'
import type { GlimTurnRequest } from '../src/protocol/messages'
import { encodeSSE, parseSSE } from '../src/protocol/sse'

const textEncoder = new TextEncoder()

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

async function collectParsedEvents(body: ReadableStream<Uint8Array>): Promise<GlimServerEvent[]> {
  const parsedEvents: GlimServerEvent[] = []
  for await (const parsedEvent of parseSSE(body)) {
    parsedEvents.push(parsedEvent)
  }
  return parsedEvents
}

// One instance of every member of the GlimServerEvent union.
const oneEventOfEveryType: GlimServerEvent[] = [
  { type: 'say_delta', text: 'head to your listing' },
  { type: 'point', ref: 'e14', description: 'the Publish button on the draft listing' },
  { type: 'wait_for', id: 'toolu_wait_01', condition: { kind: 'click', ref: 'e14' } },
  { type: 'tool_call', id: 'toolu_call_02', name: 'open_billing_modal', input: { plan: 'pro' } },
  { type: 'get_snapshot', id: 'toolu_snap_03' },
  { type: 'guide_started', guideId: 'publish-listing' },
  { type: 'history', messages: [{ role: 'user', content: 'how do i publish?' }] },
  { type: 'error', message: 'anthropic returned 529', retryable: true },
  { type: 'done', suspended: false },
]

describe('encodeSSE', () => {
  it("encodes as 'data: ' + JSON + two newlines", () => {
    const encoded = encodeSSE({ type: 'say_delta', text: 'hi there' })
    expect(encoded).toBe('data: {"type":"say_delta","text":"hi there"}\n\n')
  })
})

describe('parseSSE', () => {
  it('round-trips every event type', async () => {
    const oneChunkPerEvent = oneEventOfEveryType.map((serverEvent) =>
      textEncoder.encode(encodeSSE(serverEvent)),
    )
    const parsedEvents = await collectParsedEvents(streamFromChunks(oneChunkPerEvent))
    expect(parsedEvents).toEqual(oneEventOfEveryType)
    expect(parsedEvents).toHaveLength(9)
  })

  it('parses multiple events arriving in a single chunk', async () => {
    const wireText =
      encodeSSE({ type: 'say_delta', text: 'nice — ' }) +
      encodeSSE({ type: 'say_delta', text: "you're live!" }) +
      encodeSSE({ type: 'done', suspended: false })
    const parsedEvents = await collectParsedEvents(
      streamFromChunks([textEncoder.encode(wireText)]),
    )
    expect(parsedEvents).toEqual([
      { type: 'say_delta', text: 'nice — ' },
      { type: 'say_delta', text: "you're live!" },
      { type: 'done', suspended: false },
    ])
  })

  it('survives an event split mid-JSON across two chunks', async () => {
    const pointEvent: GlimServerEvent = {
      type: 'point',
      ref: 'e7',
      description: 'the Invite button in the team header',
    }
    const encoded = encodeSSE(pointEvent)
    // Split in the middle of the JSON payload, inside the "description" key.
    const splitIndex = encoded.indexOf('"description"') + 6
    const parsedEvents = await collectParsedEvents(
      streamFromChunks([
        textEncoder.encode(encoded.slice(0, splitIndex)),
        textEncoder.encode(encoded.slice(splitIndex)),
      ]),
    )
    expect(parsedEvents).toEqual([pointEvent])
  })

  it('skips malformed and non-object records silently, keeping surrounding events', async () => {
    const wireText =
      encodeSSE({ type: 'say_delta', text: 'first' }) +
      'data: {"type": "say_delta", "text": broken\n\n' + // malformed JSON
      'data: 42\n\n' + // valid JSON but not an object
      'this line has no data prefix\n\n' + // not an SSE data record
      encodeSSE({ type: 'done', suspended: true })
    const parsedEvents = await collectParsedEvents(
      streamFromChunks([textEncoder.encode(wireText)]),
    )
    expect(parsedEvents).toEqual([
      { type: 'say_delta', text: 'first' },
      { type: 'done', suspended: true },
    ])
  })
})

describe('GlimTurnRequest', () => {
  it('compiles for both ask and resume turns', () => {
    const askTurnRequest: GlimTurnRequest = {
      kind: 'ask',
      question: 'how do i publish?',
      snapshot: '[main] "Your listings"\n  [button#e14] Publish',
      url: 'https://harbor.example/listings',
      history: [],
      clientTools: [
        { name: 'open_billing_modal', description: 'opens the upgrade/billing dialog' },
      ],
    }
    const resumeTurnRequest: GlimTurnRequest = {
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_wait_01', result: 'the user clicked it' }],
      snapshot: '[main] "Your listings"\n  [button#e14] Publish',
      url: 'https://harbor.example/listings',
      history: [{ role: 'user', content: 'how do i publish?' }],
      clientTools: [],
    }
    expect(askTurnRequest.kind).toBe('ask')
    expect(resumeTurnRequest.kind).toBe('resume')
  })
})
