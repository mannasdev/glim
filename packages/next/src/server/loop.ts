import { encodeSSE } from '../protocol/sse'
import type { WaitForCondition, GlimServerEvent } from '../protocol/events'
import type { ClientToolSpec } from '../protocol/messages'

export interface AnthropicStreamClient {
  streamMessage(params: {
    model: string
    system: string
    messages: unknown[]
    tools: unknown[]
    maxTokens: number
  }): AsyncIterable<Record<string, unknown>>
}

const DEFAULT_MAX_LOOPS = 6
const MAX_TOKENS_PER_REQUEST = 1024

interface PendingToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

export function runAgentLoop(opts: {
  client: AnthropicStreamClient
  model: string
  system: string
  messages: unknown[]
  serverTools: { searchDocs?: (query: string) => string }
  clientTools: ClientToolSpec[]
  maxLoops?: number
}): ReadableStream<Uint8Array> {
  const textEncoder = new TextEncoder()
  const maxLoops = opts.maxLoops ?? DEFAULT_MAX_LOOPS
  const toolDefinitions = buildToolDefinitions(opts.serverTools, opts.clientTools)
  const clientToolNames = new Set(opts.clientTools.map((clientToolSpec) => clientToolSpec.name))

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: GlimServerEvent): void => {
        controller.enqueue(textEncoder.encode(encodeSSE(event)))
      }
      // Running Anthropic message array; grows with each assistant turn and each
      // appended tool_result batch. Emitted verbatim in the history event.
      const messages: unknown[] = [...opts.messages]

      try {
        for (let loopIndex = 0; loopIndex < maxLoops; loopIndex++) {
          const { assistantContentBlocks, pendingToolUses } = await streamOneAssistantTurn({
            client: opts.client,
            model: opts.model,
            system: opts.system,
            messages,
            toolDefinitions,
            emit,
          })
          messages.push({ role: 'assistant', content: assistantContentBlocks })

          if (pendingToolUses.length === 0) {
            // end_turn with no pending tools -> the conversation turn is complete.
            emit({ type: 'history', messages })
            emit({ type: 'done', suspended: false })
            controller.close()
            return
          }

          const toolResultBlocks: Record<string, unknown>[] = []
          let suspensionEventEmitted = false

          for (const pendingToolUse of pendingToolUses) {
            if (pendingToolUse.name === 'point') {
              emit({
                type: 'point',
                ref: String(pendingToolUse.input.ref),
                description: String(pendingToolUse.input.description),
              })
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: pendingToolUse.id,
                content: 'pointed at the element',
              })
            } else if (pendingToolUse.name === 'search_docs' && opts.serverTools.searchDocs) {
              const searchResultText = opts.serverTools.searchDocs(String(pendingToolUse.input.query))
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: pendingToolUse.id,
                content: searchResultText,
              })
            } else if (pendingToolUse.name === 'wait_for') {
              emit({
                type: 'wait_for',
                id: pendingToolUse.id,
                condition: pendingToolUse.input.condition as WaitForCondition,
              })
              suspensionEventEmitted = true
              break
            } else if (pendingToolUse.name === 'get_snapshot') {
              emit({ type: 'get_snapshot', id: pendingToolUse.id })
              suspensionEventEmitted = true
              break
            } else if (clientToolNames.has(pendingToolUse.name)) {
              emit({
                type: 'tool_call',
                id: pendingToolUse.id,
                name: pendingToolUse.name,
                input: pendingToolUse.input,
              })
              suspensionEventEmitted = true
              break
            } else {
              // A tool name outside the dispatch table; answer it with an error
              // tool_result so the message history stays valid for the next request.
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: pendingToolUse.id,
                content: `unknown tool: ${pendingToolUse.name}`,
                is_error: true,
              })
            }
          }

          if (toolResultBlocks.length > 0) {
            messages.push({ role: 'user', content: toolResultBlocks })
          }

          if (suspensionEventEmitted) {
            // The browser fulfils the tool and resumes the loop with a fresh POST.
            emit({ type: 'history', messages })
            emit({ type: 'done', suspended: true })
            controller.close()
            return
          }
          // All pending tools were fulfilled server-side; run another model turn.
        }

        emit({ type: 'error', message: 'glim got stuck in a loop', retryable: false })
        emit({ type: 'done', suspended: false })
        controller.close()
      } catch (thrownError) {
        const errorStatus = (thrownError as { status?: unknown }).status
        const retryable =
          typeof errorStatus === 'number' &&
          (errorStatus === 429 || errorStatus === 529 || errorStatus >= 500)
        const errorMessage = thrownError instanceof Error ? thrownError.message : 'anthropic api error'
        emit({ type: 'error', message: errorMessage, retryable })
        emit({ type: 'done', suspended: false })
        controller.close()
      }
    },
  })
}

// Consumes one raw Anthropic event stream: forwards text deltas as say_delta events
// and accumulates the assistant content blocks plus any complete tool_use requests.
async function streamOneAssistantTurn(args: {
  client: AnthropicStreamClient
  model: string
  system: string
  messages: unknown[]
  toolDefinitions: unknown[]
  emit: (event: GlimServerEvent) => void
}): Promise<{ assistantContentBlocks: Record<string, unknown>[]; pendingToolUses: PendingToolUse[] }> {
  const assistantContentBlocks: Record<string, unknown>[] = []
  const pendingToolUses: PendingToolUse[] = []
  let openTextBlock: { text: string } | null = null
  let openToolUseBlock: { id: string; name: string; partialJson: string } | null = null

  const rawAnthropicEventStream = args.client.streamMessage({
    model: args.model,
    system: args.system,
    // Copy so later mutations of the running array don't retroactively change
    // what this call received (matters for test assertions and for clarity).
    messages: [...args.messages],
    tools: args.toolDefinitions,
    maxTokens: MAX_TOKENS_PER_REQUEST,
  })

  for await (const rawAnthropicEvent of rawAnthropicEventStream) {
    const rawAnthropicEventType = rawAnthropicEvent.type as string
    if (rawAnthropicEventType === 'content_block_start') {
      const contentBlock = rawAnthropicEvent.content_block as Record<string, unknown>
      if (contentBlock.type === 'text') {
        openTextBlock = { text: '' }
      } else if (contentBlock.type === 'tool_use') {
        openToolUseBlock = { id: String(contentBlock.id), name: String(contentBlock.name), partialJson: '' }
      }
    } else if (rawAnthropicEventType === 'content_block_delta') {
      const delta = rawAnthropicEvent.delta as Record<string, unknown>
      if (delta.type === 'text_delta' && openTextBlock !== null) {
        const deltaText = String(delta.text)
        openTextBlock.text += deltaText
        args.emit({ type: 'say_delta', text: deltaText })
      } else if (delta.type === 'input_json_delta' && openToolUseBlock !== null) {
        openToolUseBlock.partialJson += String(delta.partial_json)
      }
    } else if (rawAnthropicEventType === 'content_block_stop') {
      if (openTextBlock !== null) {
        assistantContentBlocks.push({ type: 'text', text: openTextBlock.text })
        openTextBlock = null
      } else if (openToolUseBlock !== null) {
        const parsedToolInput: Record<string, unknown> =
          openToolUseBlock.partialJson.trim() === '' ? {} : JSON.parse(openToolUseBlock.partialJson)
        assistantContentBlocks.push({
          type: 'tool_use',
          id: openToolUseBlock.id,
          name: openToolUseBlock.name,
          input: parsedToolInput,
        })
        pendingToolUses.push({ id: openToolUseBlock.id, name: openToolUseBlock.name, input: parsedToolInput })
        openToolUseBlock = null
      }
    }
    // message_delta (stop_reason) and message_stop need no handling: termination is
    // inferred from whether any tool_use blocks are pending after the stream ends.
  }

  return { assistantContentBlocks, pendingToolUses }
}

function buildToolDefinitions(
  serverTools: { searchDocs?: (query: string) => string },
  clientTools: ClientToolSpec[],
): unknown[] {
  const toolDefinitions: unknown[] = [
    {
      name: 'point',
      description:
        'fly to a UI element from the page snapshot and point at it. use this whenever you reference something the user can see or click.',
      input_schema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: "the element ref from the snapshot, e.g. 'e14'" },
          description: { type: 'string', description: 'a short human description of the element' },
        },
        required: ['ref', 'description'],
      },
    },
    {
      name: 'wait_for',
      description:
        "suspend the turn and wait for the user's own action before continuing. condition shapes: {kind:'click',ref?}, {kind:'route',pattern}, {kind:'element',text}.",
      input_schema: {
        type: 'object',
        properties: {
          condition: { type: 'object', description: 'the condition to wait for' },
        },
        required: ['condition'],
      },
    },
    {
      name: 'get_snapshot',
      description: 'get a fresh outline of the current page, e.g. after a navigation.',
      input_schema: { type: 'object', properties: {} },
    },
  ]
  if (serverTools.searchDocs) {
    toolDefinitions.push({
      name: 'search_docs',
      description: 'search the product documentation for relevant passages.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    })
  }
  for (const clientToolSpec of clientTools) {
    toolDefinitions.push({
      name: clientToolSpec.name,
      description: clientToolSpec.description,
      input_schema: { type: 'object', properties: {} },
    })
  }
  return toolDefinitions
}
