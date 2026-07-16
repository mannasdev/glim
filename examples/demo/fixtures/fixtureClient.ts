// Deterministic stand-in for the Anthropic API used by the Playwright e2e suite.
// app/api/glim/route.ts injects this client into createGlimHandler when the dev
// server runs with GLIM_FIXTURE=1, so e2e runs never touch the network.
//
// streamMessage keys its scenario table off the LAST message in params.messages
// only — never the whole serialized history. Keying off the whole history was the
// original bug: once a create-test flow completed, the history contained tool_result
// blocks forever, so every later ask (regardless of question) matched the resume
// scenario and replayed "recce is on it!". See handler.ts: the handler always
// appends either a fresh-ask text message or a resume tool_result(+text) message as
// the LAST message, so looking only at the last message reflects "what just
// happened" instead of "what has ever happened in this conversation".

import type { AnthropicStreamClient } from '@glim-sdk/next/server'

type RawAnthropicEvent = Record<string, unknown>

// Finds the snapshot ref for the interactive element labeled `label`, tagged with
// `tagOrRole` (the snapshotter's outline token — the element's ARIA role if it's one
// of the recognized interactive roles, otherwise its lowercase tag name), inside the
// serialized messages, e.g. '[button#e14] New test' -> 'e14', '[a#e7] Org settings' -> 'e7'.
function findRef(messages: unknown[], tagOrRole: string, label: string): string {
  const serializedMessages = JSON.stringify(messages)
  const refPattern = new RegExp(`\\[${tagOrRole}#(e\\d+)\\] ${label}`)
  const refMatch = serializedMessages.match(refPattern)
  if (refMatch === null) {
    throw new Error(`FixtureClient could not find a "[${tagOrRole}#eN] ${label}" ref in the snapshot`)
  }
  return refMatch[1]
}

function* textBlockEvents(blockIndex: number, text: string): Generator<RawAnthropicEvent> {
  yield { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } }
  // Split on word boundaries (keeping trailing spaces) so the bubble visibly streams.
  for (const textChunk of text.split(/(?<= )/)) {
    yield { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: textChunk } }
  }
  yield { type: 'content_block_stop', index: blockIndex }
}

function* toolUseBlockEvents(
  blockIndex: number,
  toolUseId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Generator<RawAnthropicEvent> {
  yield {
    type: 'content_block_start',
    index: blockIndex,
    content_block: { type: 'tool_use', id: toolUseId, name: toolName },
  }
  yield {
    type: 'content_block_delta',
    index: blockIndex,
    delta: { type: 'input_json_delta', partial_json: JSON.stringify(toolInput) },
  }
  yield { type: 'content_block_stop', index: blockIndex }
}

function* messageEndEvents(stopReason: 'tool_use' | 'end_turn'): Generator<RawAnthropicEvent> {
  yield { type: 'message_delta', delta: { stop_reason: stopReason } }
  yield { type: 'message_stop' }
}

// A user message's `content` is either a plain string or an array of content
// blocks (text / tool_result). Both shapes are possible on the wire, so handle
// both rather than assuming the array form the demo handler happens to send.
function lastMessageIsUser(messages: unknown[]): Record<string, unknown> | null {
  const lastMessage = messages[messages.length - 1]
  if (typeof lastMessage !== 'object' || lastMessage === null) return null
  const candidate = lastMessage as Record<string, unknown>
  if (candidate.role !== 'user') return null
  return candidate
}

function lastUserMessageContentBlocks(lastUserMessage: Record<string, unknown>): Record<string, unknown>[] {
  const content = lastUserMessage.content
  if (!Array.isArray(content)) return []
  return content as Record<string, unknown>[]
}

// True only when the last message is the RESUME message the handler builds after
// a wait_for/get_snapshot/tool_call round trip leaves the browser (handler.ts's
// `kind: 'resume'` branch) — i.e. it carries a tool_result whose content is a real
// user-driven waiter result ('the user clicked it', 'it appeared', 'they are now on
// ...'), not the fixture's own internal auto-acknowledgment of a `point` tool_use
// ('pointed at the element', set by packages/next/src/server/loop.ts). `point`
// never suspends the loop, so after a point-only assistant turn the SAME request
// immediately re-invokes streamMessage with that auto tool_result as the last
// message — that in-process loopback must NOT be mistaken for a genuine resume.
function lastMessageIsGenuineResume(messages: unknown[]): boolean {
  const lastUserMessage = lastMessageIsUser(messages)
  if (lastUserMessage === null) return false
  const contentBlocks = lastUserMessageContentBlocks(lastUserMessage)
  return contentBlocks.some(
    (block) => block.type === 'tool_result' && block.content !== 'pointed at the element',
  )
}

// The fresh-ask text, when the last message is a normal ask (handler.ts formats it
// as `${question}\n\ncurrent url: ...\n\npage snapshot:\n...` in one text block).
function lastUserMessageText(messages: unknown[]): string {
  const lastUserMessage = lastMessageIsUser(messages)
  if (lastUserMessage === null) return ''
  const contentBlocks = lastUserMessageContentBlocks(lastUserMessage)
  return contentBlocks
    .filter((block) => block.type === 'text')
    .map((block) => String(block.text ?? ''))
    .join('\n')
}

export class FixtureClient implements AnthropicStreamClient {
  async *streamMessage(params: {
    model: string
    system: string
    messages: unknown[]
    tools: unknown[]
    maxTokens: number
  }): AsyncGenerator<Record<string, unknown>> {
    // Scenario: resume — the LAST message carries a genuine tool_result (the user
    // clicked the New test button and the client resumed the suspended turn).
    if (lastMessageIsGenuineResume(params.messages)) {
      yield* textBlockEvents(0, 'nice — recce is on it!')
      yield* messageEndEvents('end_turn')
      return
    }

    // Every other scenario keys off the LAST message's fresh-ask text (the
    // question the user just typed), not the whole conversation history.
    const lastAskText = lastUserMessageText(params.messages)

    // Scenario: forced API error (exercised by on-demand smoke tests).
    if (lastAskText.includes('error-test')) {
      throw Object.assign(new Error('overloaded'), { status: 529 })
    }

    // Scenario: the user asked about creating a test. The lowercase 'create' check
    // keys on the question text, not the capitalized 'New test' button label in
    // the snapshot outline.
    if (lastAskText.includes('create')) {
      yield* textBlockEvents(0, "let's spin up a new test…")
      yield* toolUseBlockEvents(1, 'toolu_fixture_point_1', 'point', {
        ref: findRef(params.messages, 'button', 'New test'),
        description: 'the New test button',
      })
      yield* toolUseBlockEvents(2, 'toolu_fixture_wait_1', 'wait_for', {
        condition: { kind: 'click' },
      })
      yield* messageEndEvents('tool_use')
      return
    }

    // Scenario: the user asked about settings. Point at the Settings nav link and
    // stop — a point-and-done answer with no wait_for suspension. `point` resolves
    // server-side and immediately loops the fixture again in the same request (see
    // lastMessageIsGenuineResume's comment); that follow-up call falls through to
    // the default scenario below, which — because the last message is that
    // point-only tool_result rather than a fresh ask — must reply with silence
    // (no text, no tool_use) so the bubble is left showing only this scenario's
    // text instead of appending an unrelated greeting after it.
    if (lastAskText.includes('settings')) {
      yield* textBlockEvents(0, 'the settings page is right up here')
      yield* toolUseBlockEvents(1, 'toolu_fixture_point_2', 'point', {
        ref: findRef(params.messages, 'a', 'Org settings'),
        description: 'the org settings nav link',
      })
      yield* messageEndEvents('end_turn')
      return
    }

    // The in-process loopback after a point-only turn's auto tool_result (see
    // lastMessageIsGenuineResume): the last message is a tool_result, not a fresh
    // ask, so lastAskText is empty here and this is NOT the true default-greeting
    // scenario. Emit an empty end_turn so the loop closes without adding more text.
    if (lastAskText === '') {
      yield* messageEndEvents('end_turn')
      return
    }

    // Default scenario.
    yield* textBlockEvents(0, 'hi! ask me how to create a test.')
    yield* messageEndEvents('end_turn')
  }
}
