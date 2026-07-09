'use client'

import { useContext } from 'react'
import { GlimContext } from './GlimProvider'
import type { GlimStatus } from './engine'

export interface GlimApi {
  ask(question: string): void
  open(): void
  close(): void
  startGuide(guideId: string): void
  status: GlimStatus
}

export function useGlim(): GlimApi {
  const context = useContext(GlimContext)
  if (context === null) {
    throw new Error(
      'useGlim must be used within a <GlimProvider>. Mount <GlimProvider> in your root layout.',
    )
  }
  return {
    ask: context.ask,
    open: context.open,
    close: context.close,
    startGuide: context.startGuide,
    status: context.status,
  }
}
