/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import { createWaiter, notifyRouteChange } from '../src/client/waiters'
import type { WaitForCondition } from '../src/protocol/events'

const NOT_RESOLVED = Symbol('not-resolved')

// Races the waiter promise against a short timeout so tests can assert
// "this promise did NOT resolve" without hanging forever.
function outcomeWithin(
  waiterPromise: Promise<string>,
  milliseconds: number,
): Promise<string | typeof NOT_RESOLVED> {
  return Promise.race([
    waiterPromise,
    new Promise<typeof NOT_RESOLVED>((resolveTimeout) => {
      setTimeout(() => resolveTimeout(NOT_RESOLVED), milliseconds)
    }),
  ])
}

const resolveRefToNull = (_ref: string): Element | null => null

describe('createWaiter: click', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('resolves on any click when no ref is given', async () => {
    const clickTarget = document.createElement('button')
    document.body.appendChild(clickTarget)
    const condition: WaitForCondition = { kind: 'click' }
    const waiter = createWaiter(condition, resolveRefToNull)
    clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await expect(waiter.promise).resolves.toBe('the user clicked it')
  })

  it('resolves when the click lands inside the resolved ref element', async () => {
    const refElement = document.createElement('div')
    const childButton = document.createElement('button')
    refElement.appendChild(childButton)
    document.body.appendChild(refElement)
    const condition: WaitForCondition = { kind: 'click', ref: 'e14' }
    const waiter = createWaiter(condition, (ref) => (ref === 'e14' ? refElement : null))
    childButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await expect(waiter.promise).resolves.toBe('the user clicked it')
  })

  it('does not resolve when the click lands outside the resolved ref element', async () => {
    const refElement = document.createElement('div')
    const outsideButton = document.createElement('button')
    document.body.appendChild(refElement)
    document.body.appendChild(outsideButton)
    const condition: WaitForCondition = { kind: 'click', ref: 'e14' }
    const waiter = createWaiter(condition, (ref) => (ref === 'e14' ? refElement : null))
    outsideButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
    waiter.cancel()
  })

  it('does not resolve when resolveRef returns null for the ref', async () => {
    const someButton = document.createElement('button')
    document.body.appendChild(someButton)
    const condition: WaitForCondition = { kind: 'click', ref: 'e99' }
    const waiter = createWaiter(condition, resolveRefToNull)
    someButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
    waiter.cancel()
  })

  it('cancel removes the click listener so a later click never resolves', async () => {
    const clickTarget = document.createElement('button')
    document.body.appendChild(clickTarget)
    const condition: WaitForCondition = { kind: 'click' }
    const waiter = createWaiter(condition, resolveRefToNull)
    waiter.cancel()
    clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
  })
})

describe('createWaiter: route', () => {
  it('resolves on an exact pathname match', async () => {
    const condition: WaitForCondition = { kind: 'route', pattern: '/team' }
    const waiter = createWaiter(condition, resolveRefToNull)
    notifyRouteChange('/team')
    await expect(waiter.promise).resolves.toBe('they are now on /team')
  })

  it('resolves on a substring pathname match', async () => {
    const condition: WaitForCondition = { kind: 'route', pattern: 'team' }
    const waiter = createWaiter(condition, resolveRefToNull)
    notifyRouteChange('/team/members')
    await expect(waiter.promise).resolves.toBe('they are now on /team/members')
  })

  it('ignores a non-matching pathname and resolves on a later match', async () => {
    const condition: WaitForCondition = { kind: 'route', pattern: '/settings' }
    const waiter = createWaiter(condition, resolveRefToNull)
    notifyRouteChange('/team')
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
    notifyRouteChange('/settings')
    await expect(waiter.promise).resolves.toBe('they are now on /settings')
  })

  it('cancel removes the route listener so a later match never resolves', async () => {
    const condition: WaitForCondition = { kind: 'route', pattern: '/settings' }
    const waiter = createWaiter(condition, resolveRefToNull)
    waiter.cancel()
    notifyRouteChange('/settings')
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
  })
})

describe('createWaiter: element', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('resolves immediately when the text is already in the document (case-insensitive)', async () => {
    const existingHeading = document.createElement('h2')
    existingHeading.textContent = 'Invite Teammate'
    document.body.appendChild(existingHeading)
    const condition: WaitForCondition = { kind: 'element', text: 'invite teammate' }
    const waiter = createWaiter(condition, resolveRefToNull)
    await expect(waiter.promise).resolves.toBe('it appeared')
  })

  it('resolves when matching text is appended to the DOM later', async () => {
    const condition: WaitForCondition = { kind: 'element', text: 'Casa Azul' }
    const waiter = createWaiter(condition, resolveRefToNull)
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
    const appendedRow = document.createElement('div')
    appendedRow.textContent = 'casa azul — draft'
    document.body.appendChild(appendedRow)
    await expect(waiter.promise).resolves.toBe('it appeared')
  })

  it('cancel disconnects the observer so later matching text never resolves', async () => {
    const condition: WaitForCondition = { kind: 'element', text: 'Casa Azul' }
    const waiter = createWaiter(condition, resolveRefToNull)
    waiter.cancel()
    const appendedRow = document.createElement('div')
    appendedRow.textContent = 'Casa Azul'
    document.body.appendChild(appendedRow)
    expect(await outcomeWithin(waiter.promise, 25)).toBe(NOT_RESOLVED)
  })
})
