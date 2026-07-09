// Deterministic stand-in for the Anthropic API used by the Playwright e2e suite.
// app/api/glim/route.ts injects this client into createGlimHandler when the dev
// server runs with GLIM_FIXTURE=1, so e2e runs never touch the network.
// streamMessage inspects JSON.stringify(params.messages) and replays canned RAW
// Anthropic streaming events for a small scenario table.

import type { AnthropicStreamClient } from '@glim-sdk/next/server'

type RawAnthropicEvent = Record<string, unknown>

// Finds the snapshot ref for the interactive element labeled `label` inside the
// serialized messages, e.g. '[button#e14] Publish' -> 'e14'.
function findRef(messages: unknown[], label: string): string {
  const serializedMessages = JSON.stringify(messages)
  const refPattern = new RegExp(`\\[button#(e\\d+)\\] ${label}`)
  const refMatch = serializedMessages.match(refPattern)
  if (refMatch === null) {
    throw new Error(`FixtureClient could not find a "[button#eN] ${label}" ref in the snapshot`)
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

export class FixtureClient implements AnthropicStreamClient {
  async *streamMessage(params: {
    model: string
    system: string
    messages: unknown[]
    tools: unknown[]
    maxTokens: number
  }): AsyncGenerator<Record<string, unknown>> {
    const serializedMessages = JSON.stringify(params.messages)

    // Scenario: forced API error (exercised by on-demand smoke tests).
    if (serializedMessages.includes('error-test')) {
      throw Object.assign(new Error('overloaded'), { status: 529 })
    }

    // Scenario: resume — the messages now carry a tool_result block (the user
    // clicked Publish and the client resumed the suspended turn).
    if (serializedMessages.includes('tool_result')) {
      yield* textBlockEvents(0, 'nice — your place is live!')
      yield* messageEndEvents('end_turn')
      return
    }

    // Scenario: the user asked about publishing. The lowercase 'publish' check
    // keys on the question text, not the capitalized 'Publish' button label in
    // the snapshot outline.
    if (serializedMessages.includes('publish')) {
      yield* textBlockEvents(0, 'head to your draft listing…')
      yield* toolUseBlockEvents(1, 'toolu_fixture_point_1', 'point', {
        ref: findRef(params.messages, 'Publish'),
        description: 'the publish button',
      })
      yield* toolUseBlockEvents(2, 'toolu_fixture_wait_1', 'wait_for', {
        condition: { kind: 'click' },
      })
      yield* messageEndEvents('tool_use')
      return
    }

    // Default scenario.
    yield* textBlockEvents(0, 'hi! ask me about publishing.')
    yield* messageEndEvents('end_turn')
  }
}
