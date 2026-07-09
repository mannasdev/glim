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
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${question}\n\ncurrent url: ${turnRequest.url}\n\npage snapshot:\n${turnRequest.snapshot}`,
          },
        ],
      })
    } else {
      const toolResultBlocks = (turnRequest.toolResults ?? []).map((toolResultPayload) => ({
        type: 'tool_result',
        tool_use_id: toolResultPayload.toolUseId,
        content: toolResultPayload.result,
      }))
      messages.push({
        role: 'user',
        content: [
          ...toolResultBlocks,
          {
            type: 'text',
            text: `current url: ${turnRequest.url}\n\nfresh page snapshot:\n${turnRequest.snapshot}`,
          },
        ],
      })
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
