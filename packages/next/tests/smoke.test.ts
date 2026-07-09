import { describe, expect, it } from 'vitest'
import { GLIM_VERSION } from '../src/index'
import { GLIM_VERSION as SERVER_GLIM_VERSION } from '../src/server'

describe('package scaffold', () => {
  it('exports GLIM_VERSION from the client entry', () => {
    expect(GLIM_VERSION).toBe('0.0.1')
  })

  it('exports GLIM_VERSION from the server entry', () => {
    expect(SERVER_GLIM_VERSION).toBe('0.0.1')
  })
})
