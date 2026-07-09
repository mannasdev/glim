import { describe, expect, it } from 'vitest'
import { createGlimHandler } from '../src/server/handler'
import type { AnthropicStreamClient } from '../src/server/loop'
import { MAX_BODY_BYTES } from '../src/server/security'
import { parseSSE } from '../src/protocol/sse'
import type { GlimServerEvent } from '../src/protocol/events'
import type { GlimTurnRequest } from '../src/protocol/messages'

interface StreamMessageParams {
  model: string
  system: string
  messages: unknown[]
  tools: unknown[]
  maxTokens: number
}

// Minimal scripted client: every streamMessage call answers with one text block
// ('hey there') and end_turn, and records the params it was called with.
class ScriptedClient implements AnthropicStreamClient {
  calls: StreamMessageParams[] = []

  streamMessage(params: StreamMessageParams): AsyncIterable<Record<string, unknown>> {
    this.calls.push(params)
    return (async function* () {
      yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hey there' } }
      yield { type: 'content_block_stop', index: 0 }
      yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }
      yield { type: 'message_stop' }
    })()
  }
}

function askRequestBody(overrides: Partial<GlimTurnRequest> = {}): string {
  return JSON.stringify({
    kind: 'ask',
    question: 'how do i publish?',
    snapshot: '[main] "Your listings"\n  [button#e14] Publish',
    url: 'https://myapp.example/listings',
    history: [],
    clientTools: [],
    ...overrides,
  })
}

function postRequest(body: string, origin?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (origin !== undefined) {
    headers.set('origin', origin)
  }
  return new Request('https://myapp.example/api/glim', { method: 'POST', headers, body })
}

async function collectEvents(response: Response): Promise<GlimServerEvent[]> {
  const collectedEvents: GlimServerEvent[] = []
  for await (const event of parseSSE(response.body as ReadableStream<Uint8Array>)) {
    collectedEvents.push(event)
  }
  return collectedEvents
}

describe('createGlimHandler', () => {
  it('returns 403 when the Origin header host does not match the request host', async () => {
    const handler = createGlimHandler({ client: new ScriptedClient() })

    const response = await handler(postRequest(askRequestBody(), 'https://evil.example'))

    expect(response.status).toBe(403)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const handler = createGlimHandler({ client: new ScriptedClient() })

    const response = await handler(postRequest('this is not json'))

    expect(response.status).toBe(400)
  })

  it('returns 400 when an ask request is missing the question field', async () => {
    const handler = createGlimHandler({ client: new ScriptedClient() })
    const invalidBody = JSON.stringify({
      kind: 'ask',
      snapshot: '[main]',
      url: 'https://myapp.example/',
      history: [],
      clientTools: [],
    })

    const response = await handler(postRequest(invalidBody))

    expect(response.status).toBe(400)
  })

  it('returns 413 when the body exceeds MAX_BODY_BYTES', async () => {
    const handler = createGlimHandler({ client: new ScriptedClient() })
    const oversizedBody = askRequestBody({ snapshot: 'x'.repeat(MAX_BODY_BYTES) })

    const response = await handler(postRequest(oversizedBody))

    expect(response.status).toBe(413)
  })

  it('streams SSE with the right headers on a valid ask request using the default model', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })

    const response = await handler(postRequest(askRequestBody()))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('cache-control')).toBe('no-cache')

    const events = await collectEvents(response)
    expect(events[0]).toEqual({ type: 'say_delta', text: 'hey there' })
    expect(events[events.length - 1]).toEqual({ type: 'done', suspended: false })

    expect(client.calls).toHaveLength(1)
    expect(client.calls[0].model).toBe('claude-sonnet-5')
    expect(client.calls[0].system.length).toBeGreaterThan(0)
    const firstUserMessage = client.calls[0].messages[0] as {
      role: string
      content: Array<{ type: string; text: string }>
    }
    expect(firstUserMessage.role).toBe('user')
    expect(firstUserMessage.content[0].text).toContain('how do i publish?')
    expect(firstUserMessage.content[0].text).toContain('current url: https://myapp.example/listings')
    expect(firstUserMessage.content[0].text).toContain('[button#e14] Publish')
  })

  it('emits guide_started first and rewrites the question for a [start-guide:id] marker', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })

    const response = await handler(
      postRequest(askRequestBody({ question: '[start-guide:publish-listing]' }), 'https://myapp.example'),
    )

    expect(response.status).toBe(200)
    const events = await collectEvents(response)
    expect(events[0]).toEqual({ type: 'guide_started', guideId: 'publish-listing' })
    expect(events[1]).toEqual({ type: 'say_delta', text: 'hey there' })

    const firstUserMessage = client.calls[0].messages[0] as {
      role: string
      content: Array<{ type: string; text: string }>
    }
    expect(firstUserMessage.content[0].text).toContain(
      'Start the "publish-listing" guide now, beginning at step 1.',
    )
    expect(firstUserMessage.content[0].text).not.toContain('[start-guide:')
  })

  it('builds tool_result blocks plus a fresh snapshot note for a resume request', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })
    const priorHistory = [
      { role: 'user', content: [{ type: 'text', text: 'earlier question' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_wait', name: 'wait_for', input: { condition: { kind: 'click' } } }],
      },
    ]
    const resumeBody = JSON.stringify({
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_wait', result: 'the user clicked it' }],
      snapshot: '[main] live!',
      url: 'https://myapp.example/listings',
      history: priorHistory,
      clientTools: [],
    })

    const response = await handler(postRequest(resumeBody))

    expect(response.status).toBe(200)
    await collectEvents(response)

    expect(client.calls[0].messages).toHaveLength(3)
    const resumeUserMessage = client.calls[0].messages[2] as {
      role: string
      content: Array<Record<string, unknown>>
    }
    expect(resumeUserMessage.role).toBe('user')
    expect(resumeUserMessage.content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_wait',
      content: 'the user clicked it',
    })
    expect(String((resumeUserMessage.content[1] as { text: string }).text)).toContain('fresh page snapshot')
    expect(String((resumeUserMessage.content[1] as { text: string }).text)).toContain('[main] live!')
  })
})
