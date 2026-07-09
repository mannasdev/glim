import Anthropic from '@anthropic-ai/sdk'
import { compilePlaybooks } from '../guides/playbook'
import type { GlimGuide } from '../guides/defineGuide'
import { encodeSSE } from '../protocol/sse'
import type { GlimServerEvent } from '../protocol/events'
import type { GlimTurnRequest } from '../protocol/messages'
import { loadKnowledge, searchDocs } from './knowledge'
import { buildSystemPrompt } from './prompt'
import { checkOrigin, MAX_BODY_BYTES } from './security'
import { runAgentLoop, type AnthropicStreamClient } from './loop'

export interface GlimHandlerConfig {
  apiKey?: string
  model?: string
  persona?: string
  knowledge?: string
  guides?: GlimGuide[]
  allowedOrigins?: string[]
  client?: AnthropicStreamClient
}

const DEFAULT_MODEL = 'claude-sonnet-5'
const START_GUIDE_MARKER_PATTERN = /^\[start-guide:(.+)\]$/

// The content used to close a tool_use the user never actually completed (they
// moved on, or the browser resolved only some of a turn's tool_uses). The model
// reads this and continues in words instead of the whole request 400ing on a
// dangling tool_use.
const SYNTHETIC_ABANDONED_TOOL_RESULT = 'the user moved on without completing this'

function messageContentBlocks(message: unknown): Record<string, unknown>[] {
  if (typeof message !== 'object' || message === null) return []
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return []
  return content as Record<string, unknown>[]
}

function collectContentBlocks(message: unknown): Record<string, unknown>[] {
  return messageContentBlocks(message)
}

function collectToolResultIds(message: unknown): string[] {
  return messageContentBlocks(message)
    .filter((block) => block.type === 'tool_result')
    .map((block) => String(block.tool_use_id))
}

// Returns the ids of every tool_use in the LAST assistant message of the history
// that is not already answered by a tool_result in the message immediately after
// it. When the last history message IS that assistant message, all of its tool_use
// ids are unanswered. When a trailing tool_result user message already answered
// some, only the remaining ids are returned.
function findUnansweredToolUseIds(history: unknown[]): string[] {
  for (let historyIndex = history.length - 1; historyIndex >= 0; historyIndex--) {
    const message = history[historyIndex] as { role?: unknown }
    if (message.role !== 'assistant') continue

    const toolUseIds = messageContentBlocks(message)
      .filter((block) => block.type === 'tool_use')
      .map((block) => String(block.id))
    if (toolUseIds.length === 0) return []

    const followingMessage = history[historyIndex + 1]
    const answeredIds = new Set(
      followingMessage === undefined ? [] : collectToolResultIds(followingMessage),
    )
    return toolUseIds.filter((toolUseId) => !answeredIds.has(toolUseId))
  }
  return []
}

// The synthetic tool_result blocks (one per unanswered tool_use id) used to lead a
// fresh-ask user message when the previous assistant turn's tools were abandoned.
function buildSyntheticToolResultsForUnansweredToolUses(history: unknown[]): Record<string, unknown>[] {
  return findUnansweredToolUseIds(history).map((toolUseId) => ({
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: SYNTHETIC_ABANDONED_TOOL_RESULT,
  }))
}

// If the last history message is a user message that consists only of tool_result
// blocks (loop.ts's pre-suspension point/search_docs results), return it so the
// resume can merge into it instead of appending a second consecutive user message.
function getTrailingToolResultUserMessage(history: unknown[]): Record<string, unknown> | null {
  const lastMessage = history[history.length - 1]
  if (typeof lastMessage !== 'object' || lastMessage === null) return null
  const candidate = lastMessage as Record<string, unknown>
  if (candidate.role !== 'user') return null
  const contentBlocks = messageContentBlocks(candidate)
  if (contentBlocks.length === 0) return null
  const isAllToolResults = contentBlocks.every((block) => block.type === 'tool_result')
  return isAllToolResults ? candidate : null
}

export function createGlimHandler(config: GlimHandlerConfig): (request: Request) => Promise<Response> {
  const playbooks = compilePlaybooks(config.guides ?? [])
  const knowledgeChunks = config.knowledge !== undefined ? loadKnowledge(config.knowledge) : []
  const systemPrompt = buildSystemPrompt({
    persona: config.persona,
    playbooks,
    hasKnowledge: config.knowledge !== undefined,
  })

  const serverTools: { searchDocs?: (query: string) => string } = {}
  if (config.knowledge !== undefined) {
    serverTools.searchDocs = (query: string): string => {
      const matchingChunks = searchDocs(knowledgeChunks, query)
      if (matchingChunks.length === 0) {
        return 'no matching docs found'
      }
      return matchingChunks.map((docChunk) => `# ${docChunk.title}\n${docChunk.text}`).join('\n\n')
    }
  }

  const anthropicStreamClient = config.client ?? createDefaultAnthropicClient(config.apiKey)
  const model = config.model ?? DEFAULT_MODEL

  return async (request: Request): Promise<Response> => {
    if (!checkOrigin(request, config.allowedOrigins)) {
      return new Response('forbidden', { status: 403 })
    }

    const bodyText = await request.text()
    if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
      return new Response('payload too large', { status: 413 })
    }

    const turnRequest = parseTurnRequest(bodyText)
    if (turnRequest === null) {
      return new Response('invalid request body', { status: 400 })
    }

    // A question that is exactly '[start-guide:<id>]' is the useGlim().startGuide
    // marker: emit guide_started first and rewrite the question for the model.
    let guideIdFromMarker: string | null = null
    let question = turnRequest.question
    if (turnRequest.kind === 'ask' && question !== undefined) {
      const markerMatch = START_GUIDE_MARKER_PATTERN.exec(question)
      if (markerMatch !== null) {
        guideIdFromMarker = markerMatch[1]
        question = `Start the "${guideIdFromMarker}" guide now, beginning at step 1.`
      }
    }

    const messages: unknown[] = [...turnRequest.history]
    if (turnRequest.kind === 'ask') {
      // If the user abandoned a suspended turn and asked something new, the last
      // history message is an assistant turn whose tool_use blocks were never
      // answered. The Anthropic API 400s on any tool_use that is not immediately
      // followed by a matching tool_result, so close every unanswered id with a
      // synthetic result. These MUST lead the new user message's content array.
      const syntheticToolResultBlocks = buildSyntheticToolResultsForUnansweredToolUses(turnRequest.history)
      messages.push({
        role: 'user',
        content: [
          ...syntheticToolResultBlocks,
          {
            type: 'text',
            text: `${question}\n\ncurrent url: ${turnRequest.url}\n\npage snapshot:\n${turnRequest.snapshot}`,
          },
        ],
      })
    } else {
      const providedToolResultBlocks = (turnRequest.toolResults ?? []).map((toolResultPayload) => ({
        type: 'tool_result' as const,
        tool_use_id: toolResultPayload.toolUseId,
        content: toolResultPayload.result,
      }))
      const providedToolResultIds = new Set(
        providedToolResultBlocks.map((toolResultBlock) => toolResultBlock.tool_use_id),
      )

      // loop.ts already pushes point / search_docs results as their own user
      // message before it suspends on a later tool_use. When that trailing user
      // message exists, the resume must MERGE its incoming tool_results into it
      // rather than append a second consecutive user message (two consecutive user
      // messages are rejected by the API and were the "split tool_results" finding).
      const trailingToolResultUserMessage = getTrailingToolResultUserMessage(turnRequest.history)
      const alreadyAnsweredIds = trailingToolResultUserMessage === null
        ? new Set<string>()
        : new Set(collectToolResultIds(trailingToolResultUserMessage))

      // Close any OTHER tool_use id from the suspending assistant turn that neither
      // the browser resolved (providedToolResultIds) nor loop.ts pre-answered
      // (alreadyAnsweredIds) — otherwise it would dangle and 400 the request.
      const unansweredToolUseIds = findUnansweredToolUseIds(turnRequest.history).filter(
        (toolUseId) => !providedToolResultIds.has(toolUseId) && !alreadyAnsweredIds.has(toolUseId),
      )
      const syntheticToolResultBlocks = unansweredToolUseIds.map((toolUseId) => ({
        type: 'tool_result' as const,
        tool_use_id: toolUseId,
        content: SYNTHETIC_ABANDONED_TOOL_RESULT,
      }))

      const freshSnapshotTextBlock = {
        type: 'text',
        text: `current url: ${turnRequest.url}\n\nfresh page snapshot:\n${turnRequest.snapshot}`,
      }

      if (trailingToolResultUserMessage !== null) {
        // Merge into the existing trailing tool_result user message in place of
        // appending a new one, keeping every tool_result grouped in one message.
        const mergedContent = [
          ...collectContentBlocks(trailingToolResultUserMessage),
          ...providedToolResultBlocks,
          ...syntheticToolResultBlocks,
          freshSnapshotTextBlock,
        ]
        messages[messages.length - 1] = { role: 'user', content: mergedContent }
      } else {
        messages.push({
          role: 'user',
          content: [...providedToolResultBlocks, ...syntheticToolResultBlocks, freshSnapshotTextBlock],
        })
      }
    }

    const agentLoopStream = runAgentLoop({
      client: anthropicStreamClient,
      model,
      system: systemPrompt,
      messages,
      serverTools,
      clientTools: turnRequest.clientTools,
    })

    const responseStream =
      guideIdFromMarker === null
        ? agentLoopStream
        : prependEvent({ type: 'guide_started', guideId: guideIdFromMarker }, agentLoopStream)

    return new Response(responseStream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    })
  }
}

function parseTurnRequest(bodyText: string): GlimTurnRequest | null {
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(bodyText)
  } catch {
    return null
  }
  if (typeof parsedBody !== 'object' || parsedBody === null) {
    return null
  }
  const candidate = parsedBody as Record<string, unknown>
  if (candidate.kind !== 'ask' && candidate.kind !== 'resume') {
    return null
  }
  if (typeof candidate.snapshot !== 'string') {
    return null
  }
  if (typeof candidate.url !== 'string') {
    return null
  }
  if (!Array.isArray(candidate.history)) {
    return null
  }
  if (!Array.isArray(candidate.clientTools)) {
    return null
  }
  if (candidate.kind === 'ask' && typeof candidate.question !== 'string') {
    return null
  }
  if (candidate.kind === 'resume' && !Array.isArray(candidate.toolResults)) {
    return null
  }
  return candidate as unknown as GlimTurnRequest
}

// Default client adapter: wraps the official Anthropic SDK's streaming Messages API.
// Only constructed when no injectable client is provided (tests always inject one).
function createDefaultAnthropicClient(apiKey?: string): AnthropicStreamClient {
  const anthropicClient = new Anthropic({ apiKey })
  return {
    async *streamMessage(params: {
      model: string
      system: string
      messages: unknown[]
      tools: unknown[]
      maxTokens: number
    }) {
      const rawAnthropicEventStream = await anthropicClient.messages.create({
        model: params.model,
        system: params.system,
        messages: params.messages as Anthropic.MessageParam[],
        tools: params.tools as Anthropic.Tool[],
        max_tokens: params.maxTokens,
        stream: true,
      })
      for await (const rawAnthropicEvent of rawAnthropicEventStream) {
        yield rawAnthropicEvent as unknown as Record<string, unknown>
      }
    },
  }
}

// Emits one SSE-encoded event before piping the downstream loop stream through.
function prependEvent(
  eventToPrepend: GlimServerEvent,
  downstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const textEncoder = new TextEncoder()
  const downstreamReader = downstream.getReader()
  let prependedEventSent = false
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!prependedEventSent) {
        prependedEventSent = true
        controller.enqueue(textEncoder.encode(encodeSSE(eventToPrepend)))
        return
      }
      const { done, value } = await downstreamReader.read()
      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
    cancel(reason) {
      return downstreamReader.cancel(reason)
    },
  })
}
