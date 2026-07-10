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
  /** True when Glim is actually live on this page (enabled AND route-allowed). */
  active: boolean
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
    active: context.active,
  }
}
