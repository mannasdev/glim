// Wire-level event vocabulary for the Glim SSE protocol.
// These are the ONLY event shapes the server may emit and the client may consume.

export type WaitForCondition =
  | { kind: 'click'; ref?: string }
  | { kind: 'route'; pattern: string }
  | { kind: 'element'; text: string }

export type GlimServerEvent =
  | { type: 'say_delta'; text: string }
  | { type: 'point'; ref: string; description: string }
  | { type: 'wait_for'; id: string; condition: WaitForCondition }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'get_snapshot'; id: string }
  | { type: 'guide_started'; guideId: string }
  | { type: 'history'; messages: unknown[] } // Anthropic MessageParam[], opaque to the client
  | { type: 'error'; message: string; retryable: boolean }
  | { type: 'done'; suspended: boolean }
