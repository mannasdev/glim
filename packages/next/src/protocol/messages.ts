// Request-body shapes for POSTs from the Glim client to the route handler.

export interface ClientToolSpec {
  name: string
  description: string
}

export interface ToolResultPayload {
  toolUseId: string
  result: string
}

export interface GlimTurnRequest {
  kind: 'ask' | 'resume'
  question?: string // ask only
  toolResults?: ToolResultPayload[] // resume only
  snapshot: string
  url: string
  history: unknown[]
  clientTools: ClientToolSpec[]
}
