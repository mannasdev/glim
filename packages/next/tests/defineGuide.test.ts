import { describe, expect, it } from 'vitest'
import { defineGuide, point, say, waitFor } from '../src/guides/defineGuide'

describe('point', () => {
  it('builds a point step carrying target and say text', () => {
    expect(point('the Publish button on the draft listing', 'hit publish right here')).toEqual({
      kind: 'point',
      target: 'the Publish button on the draft listing',
      say: 'hit publish right here',
    })
  })
})

describe('waitFor', () => {
  it('builds a click wait step', () => {
    expect(waitFor({ click: true })).toEqual({ kind: 'waitFor', condition: { click: true } })
  })

  it('builds a route wait step', () => {
    expect(waitFor({ route: '/team' })).toEqual({ kind: 'waitFor', condition: { route: '/team' } })
  })

  it('builds an elementText wait step', () => {
    expect(waitFor({ elementText: 'Invite teammate' })).toEqual({
      kind: 'waitFor',
      condition: { elementText: 'Invite teammate' },
    })
  })
})

describe('say', () => {
  it('builds a say step', () => {
    expect(say('nice — your place is live!')).toEqual({ kind: 'say', text: 'nice — your place is live!' })
  })
})

describe('defineGuide', () => {
  it('returns the exact same guide object when valid', () => {
    const validGuide = {
      id: 'publish-listing',
      when: 'user asks how to publish or make a listing live',
      steps: [say('hello')],
    }
    expect(defineGuide(validGuide)).toBe(validGuide)
  })

  it('throws when id is empty', () => {
    expect(() =>
      defineGuide({ id: '', when: 'user asks something', steps: [say('hello')] })
    ).toThrowError('guide  must have a non-empty id')
  })

  it('throws when id is only whitespace', () => {
    expect(() =>
      defineGuide({ id: '   ', when: 'user asks something', steps: [say('hello')] })
    ).toThrowError('guide     must have a non-empty id')
  })

  it('throws when when is empty', () => {
    expect(() =>
      defineGuide({ id: 'publish-listing', when: '', steps: [say('hello')] })
    ).toThrowError('guide publish-listing must have a non-empty when')
  })

  it('throws when steps is empty', () => {
    expect(() =>
      defineGuide({ id: 'publish-listing', when: 'user asks something', steps: [] })
    ).toThrowError('guide publish-listing must have at least one step')
  })
})
