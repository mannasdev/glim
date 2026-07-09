'use client'

import { useContext, useEffect, useRef } from 'react'
import { GlimContext } from './GlimProvider'

export function useGlimTool(
  name: string,
  description: string,
  fn: () => Promise<string> | string,
): void {
  const context = useContext(GlimContext)
  if (context === null) {
    throw new Error(
      'useGlimTool must be used within a <GlimProvider>. Mount <GlimProvider> in your root layout.',
    )
  }

  // Keep the latest fn without re-registering the tool on every render.
  const fnRef = useRef(fn)
  fnRef.current = fn

  const registry = context.registry
  useEffect(() => {
    const unregister = registry.register(name, description, () => fnRef.current())
    return unregister
  }, [registry, name, description])
}
