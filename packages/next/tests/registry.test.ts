import { describe, expect, it } from 'vitest'
import { RefRegistry } from '../src/snapshot/registry'

describe('RefRegistry', () => {
  it('assigns sequential refs e1, e2, ... to new elements', () => {
    const registry = new RefRegistry()
    const firstElement = document.createElement('button')
    const secondElement = document.createElement('a')
    expect(registry.getRef(firstElement)).toBe('e1')
    expect(registry.getRef(secondElement)).toBe('e2')
  })

  it('returns the same ref for the same element on repeated calls', () => {
    const registry = new RefRegistry()
    const buttonElement = document.createElement('button')
    const firstRef = registry.getRef(buttonElement)
    const secondRef = registry.getRef(buttonElement)
    expect(secondRef).toBe(firstRef)
  })

  it('resolve returns the live element for a known ref', () => {
    const registry = new RefRegistry()
    const buttonElement = document.createElement('button')
    const ref = registry.getRef(buttonElement)
    expect(registry.resolve(ref)).toBe(buttonElement)
  })

  it('resolve returns null for an unknown ref', () => {
    const registry = new RefRegistry()
    expect(registry.resolve('e999')).toBeNull()
  })
})
