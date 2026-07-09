import { describe, expect, it } from 'vitest'
import { runAgentLoop, type AnthropicStreamClient } from '../src/server/loop'
import { parseSSE } from '../src/protocol/sse'
import type { GlimServerEvent } from '../src/protocol/events'

type RawAnthropicEvent = Record<string, unknown>

interface StreamMessageParams {
  model: string
  system: string
  messages: unknown[]
  tools: unknown[]
  maxTokens: number
}

// Scripted mock: each entry in `scripts` is the raw Anthropic event sequence for one
// streamMessage call (or an Error to throw when that call's stream is consumed).
class ScriptedClient implements AnthropicStreamClient {
  calls: StreamMessageParams[] = []
  private readonly scripts: Array<RawAnthropicEvent[] | Error>

  constructor(scripts: Array<RawAnthropicEvent[] | Error>) {
    this.scripts = scripts
  }

  streamMessage(params: StreamMessageParams): AsyncIterable<RawAnthropicEvent> {
    this.calls.push(params)
    const script = this.scripts[this.calls.length - 1]
    return (async function* () {
      if (script === undefined) {
        throw new Error('ScriptedClient: unexpected extra streamMessage call')
      }
      if (script instanceof Error) {
        throw script
      }
      for (const rawAnthropicEvent of script) {
        yield rawAnthropicEvent
      }
    })()
  }
}

function textBlockEvents(textChunks: string[]): RawAnthropicEvent[] {
  return [
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...textChunks.map((textChunk) => ({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: textChunk },
    })),
    { type: 'content_block_stop', index: 0 },
  ]
}

function toolUseBlockEvents(toolUseId: string, toolName: string, inputJson: string): RawAnthropicEvent[] {
  return [
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: toolUseId, name: toolName, input: {} } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: inputJson } },
    { type: 'content_block_stop', index: 1 },
  ]
}

function endTurnEvents(): RawAnthropicEvent[] {
  return [
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ]
}

function toolUseStopEvents(): RawAnthropicEvent[] {
  return [
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ]
}

async function collectEvents(stream: ReadableStream<Uint8Array>): Promise<GlimServerEvent[]> {
  const collectedEvents: GlimServerEvent[] = []
  for await (const event of parseSSE(stream)) {
    collectedEvents.push(event)
  }
  return collectedEvents
}

function toolNames(call: StreamMessageParams): string[] {
  return (call.tools as Array<{ name: string }>).map((toolDefinition) => toolDefinition.name)
}

const initialMessages = [
  {
    role: 'user',
    content: [{ type: 'text', text: 'how do i publish?\n\ncurrent url: /\n\npage snapshot:\n[main]' }],
  },
]

function loopOptions(
  client: ScriptedClient,
  overrides: Partial<Parameters<typeof runAgentLoop>[0]> = {},
): Parameters<typeof runAgentLoop>[0] {
  return {
    client,
    model: 'claude-sonnet-5',
    system: 'you are glim',
    messages: initialMessages,
    serverTools: {},
    clientTools: [],
    ...overrides,
  }
}

describe('runAgentLoop', () => {
  it('streams a plain text answer as say_delta events then history then done not suspended', async () => {
    const client = new ScriptedClient([[...textBlockEvents(['hey ', 'there']), ...endTurnEvents()]])

    const events = await collectEvents(runAgentLoop(loopOptions(client)))

    expect(events).toEqual([
      { type: 'say_delta', text: 'hey ' },
      { type: 'say_delta', text: 'there' },
      {
        type: 'history',
        messages: [
          initialMessages[0],
          { role: 'assistant', content: [{ type: 'text', text: 'hey there' }] },
        ],
      },
      { type: 'done', suspended: false },
    ])
    expect(client.calls).toHaveLength(1)
    expect(toolNames(client.calls[0])).toEqual(['point', 'wait_for', 'get_snapshot'])
    expect(client.calls[0].model).toBe('claude-sonnet-5')
    expect(client.calls[0].system).toBe('you are glim')
  })

  it('emits a point event then continues the same request with a tool_result and a second stream call', async () => {
    const client = new ScriptedClient([
      [
        ...textBlockEvents(['right here — ']),
        ...toolUseBlockEvents('toolu_1', 'point', '{"ref":"e14","description":"the Publish button"}'),
        ...toolUseStopEvents(),
      ],
      [...textBlockEvents(['hit it when ready']), ...endTurnEvents()],
    ])

    const events = await collectEvents(runAgentLoop(loopOptions(client)))

    expect(events).toEqual([
      { type: 'say_delta', text: 'right here — ' },
      { type: 'point', ref: 'e14', description: 'the Publish button' },
      { type: 'say_delta', text: 'hit it when ready' },
      {
        type: 'history',
        messages: [
          initialMessages[0],
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'right here — ' },
              { type: 'tool_use', id: 'toolu_1', name: 'point', input: { ref: 'e14', description: 'the Publish button' } },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'pointed at the element' }],
          },
          { role: 'assistant', content: [{ type: 'text', text: 'hit it when ready' }] },
        ],
      },
      { type: 'done', suspended: false },
    ])
    expect(client.calls).toHaveLength(2)
    expect(client.calls[1].messages).toHaveLength(3)
  })

  it('suspends on wait_for with a wait_for event then history then done suspended', async () => {
    const client = new ScriptedClient([
      [
        ...toolUseBlockEvents('toolu_wait', 'wait_for', '{"condition":{"kind":"click","ref":"e14"}}'),
        ...toolUseStopEvents(),
      ],
    ])

    const events = await collectEvents(runAgentLoop(loopOptions(client)))

    expect(events).toEqual([
      { type: 'wait_for', id: 'toolu_wait', condition: { kind: 'click', ref: 'e14' } },
      {
        type: 'history',
        messages: [
          initialMessages[0],
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'toolu_wait', name: 'wait_for', input: { condition: { kind: 'click', ref: 'e14' } } },
            ],
          },
        ],
      },
      { type: 'done', suspended: true },
    ])
    expect(client.calls).toHaveLength(1)
  })

  it('suspends on get_snapshot with a get_snapshot event carrying the tool_use id', async () => {
    const client = new ScriptedClient([
      [...toolUseBlockEvents('toolu_snap', 'get_snapshot', ''), ...toolUseStopEvents()],
    ])

    const events = await collectEvents(runAgentLoop(loopOptions(client)))

    expect(events[0]).toEqual({ type: 'get_snapshot', id: 'toolu_snap' })
    expect(events[1].type).toBe('history')
    expect(events[events.length - 1]).toEqual({ type: 'done', suspended: true })
    expect(client.calls).toHaveLength(1)
  })

  it('suspends on a client tool with a tool_call event and includes it in the tool definitions', async () => {
    const client = new ScriptedClient([
      [...toolUseBlockEvents('toolu_ct', 'open_billing_modal', ''), ...toolUseStopEvents()],
    ])

    const events = await collectEvents(
      runAgentLoop(
        loopOptions(client, {
          clientTools: [{ name: 'open_billing_modal', description: 'opens the billing dialog' }],
        }),
      ),
    )

    expect(toolNames(client.calls[0])).toEqual(['point', 'wait_for', 'get_snapshot', 'open_billing_modal'])
    expect(events[0]).toEqual({ type: 'tool_call', id: 'toolu_ct', name: 'open_billing_modal', input: {} })
    expect(events[events.length - 1]).toEqual({ type: 'done', suspended: true })
  })

  it('executes search_docs inline and only advertises it when serverTools.searchDocs is present', async () => {
    const receivedSearchQueries: string[] = []
    const client = new ScriptedClient([
      [...toolUseBlockEvents('toolu_docs', 'search_docs', '{"query":"publishing"}'), ...toolUseStopEvents()],
      [...textBlockEvents(['from the docs: hit Publish']), ...endTurnEvents()],
    ])

    const events = await collectEvents(
      runAgentLoop(
        loopOptions(client, {
          serverTools: {
            searchDocs: (query: string) => {
              receivedSearchQueries.push(query)
              return `docs about ${query}`
            },
          },
        }),
      ),
    )

    expect(receivedSearchQueries).toEqual(['publishing'])
    expect(toolNames(client.calls[0])).toEqual(['point', 'wait_for', 'get_snapshot', 'search_docs'])
    expect(client.calls).toHaveLength(2)
    const secondCallMessages = client.calls[1].messages
    expect(secondCallMessages[secondCallMessages.length - 1]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_docs', content: 'docs about publishing' }],
    })
    expect(events[0]).toEqual({ type: 'say_delta', text: 'from the docs: hit Publish' })
    expect(events[events.length - 1]).toEqual({ type: 'done', suspended: false })
    expect(
      events.filter(
        (event) => event.type === 'tool_call' || event.type === 'wait_for' || event.type === 'get_snapshot',
      ),
    ).toEqual([])
  })

  it('emits a non-retryable stuck-in-a-loop error then done after maxLoops server-side turns', async () => {
    const pointOnlyScript = [
      ...toolUseBlockEvents('toolu_p', 'point', '{"ref":"e1","description":"a button"}'),
      ...toolUseStopEvents(),
    ]
    const client = new ScriptedClient([pointOnlyScript, pointOnlyScript])

    const events = await collectEvents(runAgentLoop(loopOptions(client, { maxLoops: 2 })))

    expect(client.calls).toHaveLength(2)
    expect(events[events.length - 2]).toEqual({
      type: 'error',
      message: 'glim got stuck in a loop',
      retryable: false,
    })
    expect(events[events.length - 1]).toEqual({ type: 'done', suspended: false })
  })

  it('maps a 529 API error to a retryable error event followed by done not suspended', async () => {
    const overloadedError = Object.assign(new Error('overloaded'), { status: 529 })
    const client = new ScriptedClient([overloadedError])

    const events = await collectEvents(runAgentLoop(loopOptions(client)))

    expect(events).toEqual([
      { type: 'error', message: 'overloaded', retryable: true },
      { type: 'done', suspended: false },
    ])
  })

  it('maps a 400 API error to a non-retryable error event followed by done', async () => {
    const badRequestError = Object.assign(new Error('bad request'), { status: 400 })
    const client = new ScriptedClient([badRequestError])

    const events = await collectEvents(runAgentLoop(loopOptions(client)))

    expect(events).toEqual([
      { type: 'error', message: 'bad request', retryable: false },
      { type: 'done', suspended: false },
    ])
  })
})
