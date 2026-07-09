import type { GlimServerEvent } from './events'

const DATA_PREFIX = 'data: '
const RECORD_SEPARATOR = '\n\n'

export function encodeSSE(event: GlimServerEvent): string {
  return DATA_PREFIX + JSON.stringify(event) + RECORD_SEPARATOR
}

export async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<GlimServerEvent> {
  // { stream: true } keeps partial multi-byte characters buffered inside the
  // decoder instead of emitting replacement characters at chunk boundaries.
  const streamingTextDecoder = new TextDecoder()
  const bodyReader = body.getReader()
  // Decoded text accumulated across chunks. A record can be split anywhere —
  // including mid-JSON — so only text before a double newline is parseable.
  let bufferedText = ''
  try {
    while (true) {
      const { done, value } = await bodyReader.read()
      if (done) {
        break
      }
      bufferedText += streamingTextDecoder.decode(value, { stream: true })
      const splitRecords = bufferedText.split(RECORD_SEPARATOR)
      // The final piece has no trailing separator yet; keep buffering it
      // until the next chunk (or end of stream) completes it.
      bufferedText = splitRecords.pop() ?? ''
      for (const completedRecord of splitRecords) {
        const parsedEvent = parseRecord(completedRecord)
        if (parsedEvent !== null) {
          yield parsedEvent
        }
      }
    }
    // Flush any bytes still held inside the decoder, then parse whatever
    // remains buffered in case the stream ended without a trailing separator.
    bufferedText += streamingTextDecoder.decode()
    for (const remainingRecord of bufferedText.split(RECORD_SEPARATOR)) {
      const parsedEvent = parseRecord(remainingRecord)
      if (parsedEvent !== null) {
        yield parsedEvent
      }
    }
  } finally {
    bodyReader.releaseLock()
  }
}

// Returns the decoded event, or null for records that must be skipped
// silently: missing 'data: ' prefix, malformed JSON, or non-object payloads.
function parseRecord(record: string): GlimServerEvent | null {
  if (!record.startsWith(DATA_PREFIX)) {
    return null
  }
  try {
    const parsedPayload: unknown = JSON.parse(record.slice(DATA_PREFIX.length))
    if (
      typeof parsedPayload !== 'object' ||
      parsedPayload === null ||
      Array.isArray(parsedPayload)
    ) {
      return null
    }
    return parsedPayload as GlimServerEvent
  } catch {
    return null
  }
}
