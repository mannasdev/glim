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

  // Helper: every tool_use id that appears in an assistant message anywhere in the
  // built message array must be answered by a tool_result block in the immediately
  // following message. This is exactly the invariant the real Anthropic API enforces
  // (a dangling tool_use with no tool_result immediately after 400s the request).
  function assertEveryToolUseIsImmediatelyAnswered(messages: unknown[]): void {
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const message = messages[messageIndex] as { role: string; content: unknown }
      if (message.role !== 'assistant' || !Array.isArray(message.content)) continue
      const toolUseIds = (message.content as Array<Record<string, unknown>>)
        .filter((block) => block.type === 'tool_use')
        .map((block) => String(block.id))
      if (toolUseIds.length === 0) continue

      const followingMessage = messages[messageIndex + 1] as { role: string; content: unknown } | undefined
      expect(followingMessage, 'a message must follow an assistant turn with tool_use').not.toBeUndefined()
      expect(followingMessage!.role).toBe('user')
      expect(Array.isArray(followingMessage!.content)).toBe(true)
      const answeredIds = new Set(
        (followingMessage!.content as Array<Record<string, unknown>>)
          .filter((block) => block.type === 'tool_result')
          .map((block) => String(block.tool_use_id)),
      )
      for (const toolUseId of toolUseIds) {
        expect(answeredIds.has(toolUseId), `tool_use ${toolUseId} must be answered immediately after`).toBe(true)
      }
    }
  }

  function assertNoConsecutiveUserMessages(messages: unknown[]): void {
    for (let messageIndex = 1; messageIndex < messages.length; messageIndex++) {
      const previous = messages[messageIndex - 1] as { role: string }
      const current = messages[messageIndex] as { role: string }
      expect(
        previous.role === 'user' && current.role === 'user',
        `messages ${messageIndex - 1} and ${messageIndex} must not both be user messages`,
      ).toBe(false)
    }
  }

  it('closes a dangling tool_use with a synthetic tool_result before the new ask text (Fix 1a)', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })
    // History ends in an assistant message with an UNANSWERED wait_for tool_use —
    // the user abandoned the suspension and asked something new. This is the live
    // repro that 400s the real API today.
    const abandonedSuspensionHistory = [
      { role: 'user', content: [{ type: 'text', text: 'how do i publish?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'hit publish right here' },
          { type: 'tool_use', id: 'toolu_wait_abandoned', name: 'wait_for', input: { condition: { kind: 'click' } } },
        ],
      },
    ]

    const response = await handler(postRequest(askRequestBody({ history: abandonedSuspensionHistory })))
    expect(response.status).toBe(200)
    await collectEvents(response)

    const sentMessages = client.calls[0].messages
    assertEveryToolUseIsImmediatelyAnswered(sentMessages)

    // The synthetic tool_result must LEAD the new user message, ahead of the ask text.
    const newUserMessage = sentMessages[sentMessages.length - 1] as {
      role: string
      content: Array<Record<string, unknown>>
    }
    expect(newUserMessage.role).toBe('user')
    expect(newUserMessage.content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_wait_abandoned',
      content: 'the user moved on without completing this',
    })
    const trailingText = newUserMessage.content[newUserMessage.content.length - 1] as { type: string; text: string }
    expect(trailingText.type).toBe('text')
    expect(trailingText.text).toContain('how do i publish?')
  })

  it('closes multiple dangling tool_use ids from the same assistant message on ask (Fix 1a)', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })
    const historyWithTwoDanglingToolUses = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_a', name: 'point', input: { ref: 'e1', description: 'x' } },
          { type: 'tool_use', id: 'toolu_b', name: 'wait_for', input: { condition: { kind: 'click' } } },
        ],
      },
    ]

    const response = await handler(postRequest(askRequestBody({ history: historyWithTwoDanglingToolUses })))
    await collectEvents(response)

    const sentMessages = client.calls[0].messages
    assertEveryToolUseIsImmediatelyAnswered(sentMessages)
  })

  it('merges resume tool_results into a single user message when history ends in a tool_result user message (Fix 1b + Fix 5)', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })
    // loop.ts emits point results in their own user message before suspending on a
    // second tool_use. History therefore ends: assistant[point, wait_for] then
    // user[tool_result for point]. The resume must NOT append a second user message;
    // it must merge the incoming wait_for result into that trailing user message and
    // also close the still-unanswered point tool_use is already answered there.
    const suspendedHistory = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'hit publish right here' },
          { type: 'tool_use', id: 'toolu_point', name: 'point', input: { ref: 'e14', description: 'the publish button' } },
          { type: 'tool_use', id: 'toolu_wait', name: 'wait_for', input: { condition: { kind: 'click' } } },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_point', content: 'pointed at the element' }] },
    ]
    const resumeBody = JSON.stringify({
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_wait', result: 'the user clicked it' }],
      snapshot: '[main] live!',
      url: 'https://myapp.example/listings',
      history: suspendedHistory,
      clientTools: [],
    })

    const response = await handler(postRequest(resumeBody))
    expect(response.status).toBe(200)
    await collectEvents(response)

    const sentMessages = client.calls[0].messages
    assertNoConsecutiveUserMessages(sentMessages)
    assertEveryToolUseIsImmediatelyAnswered(sentMessages)

    // The single trailing user message must answer BOTH tool_use ids.
    const mergedUserMessage = sentMessages[sentMessages.length - 1] as {
      role: string
      content: Array<Record<string, unknown>>
    }
    const answeredIds = mergedUserMessage.content
      .filter((block) => block.type === 'tool_result')
      .map((block) => String(block.tool_use_id))
    expect(answeredIds).toContain('toolu_point')
    expect(answeredIds).toContain('toolu_wait')
    expect(mergedUserMessage.content.find((block) => block.tool_use_id === 'toolu_wait')!.content).toBe(
      'the user clicked it',
    )
  })

  it('closes an unanswered tool_use from the assistant turn on resume even when not in toolResults (Fix 1b)', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })
    // Assistant emitted two tool_use ids but the browser only resolved one; the other
    // must still be closed with the synthetic result so the message array stays valid.
    const historyWithUnresolvedSibling = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_resolved', name: 'wait_for', input: { condition: { kind: 'click' } } },
          { type: 'tool_use', id: 'toolu_orphan', name: 'wait_for', input: { condition: { kind: 'route' } } },
        ],
      },
    ]
    const resumeBody = JSON.stringify({
      kind: 'resume',
      toolResults: [{ toolUseId: 'toolu_resolved', result: 'the user clicked it' }],
      snapshot: '[main] live!',
      url: 'https://myapp.example/listings',
      history: historyWithUnresolvedSibling,
      clientTools: [],
    })

    const response = await handler(postRequest(resumeBody))
    await collectEvents(response)

    const sentMessages = client.calls[0].messages
    assertNoConsecutiveUserMessages(sentMessages)
    assertEveryToolUseIsImmediatelyAnswered(sentMessages)
    const resumeUserMessage = sentMessages[sentMessages.length - 1] as {
      role: string
      content: Array<Record<string, unknown>>
    }
    const orphanResult = resumeUserMessage.content.find((block) => block.tool_use_id === 'toolu_orphan')
    expect(orphanResult).toBeDefined()
    expect(orphanResult!.content).toBe('the user moved on without completing this')
  })

  it('leaves a clean history byte-identical (Fix 1c)', async () => {
    const client = new ScriptedClient()
    const handler = createGlimHandler({ client })
    // A well-formed history where every tool_use is already answered: nothing to fix.
    const cleanHistory = [
      { role: 'user', content: [{ type: 'text', text: 'earlier question' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_done', name: 'point', input: { ref: 'e1', description: 'x' } }],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_done', content: 'pointed at the element' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'all set!' }] },
    ]

    const response = await handler(postRequest(askRequestBody({ history: cleanHistory })))
    await collectEvents(response)

    const sentMessages = client.calls[0].messages
    // The leading messages (everything except the freshly appended ask) must be an
    // exact, unmodified copy of the provided history.
    const passedThroughHistory = sentMessages.slice(0, cleanHistory.length)
    expect(JSON.stringify(passedThroughHistory)).toBe(JSON.stringify(cleanHistory))
    assertEveryToolUseIsImmediatelyAnswered(sentMessages)
  })
})
