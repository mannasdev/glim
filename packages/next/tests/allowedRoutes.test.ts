import { describe, expect, it } from 'vitest'
import { isPathnameAllowed } from '../src/client/allowedRoutes'

describe('isPathnameAllowed', () => {
  it('matches an exact pathname', () => {
    expect(isPathnameAllowed('/automations', ['/automations'])).toBe(true)
  })

  it('matches a nested pathname under an allowed route', () => {
    expect(isPathnameAllowed('/list/website-launch', ['/list'])).toBe(true)
  })

  it('does not match a different route that merely shares a prefix', () => {
    expect(isPathnameAllowed('/automations-old', ['/automations'])).toBe(false)
  })

  it('does not match a pathname outside every allowed route', () => {
    expect(isPathnameAllowed('/team', ['/', '/automations', '/integrations', '/settings'])).toBe(false)
  })

  it('only matches the exact root for "/"', () => {
    expect(isPathnameAllowed('/', ['/'])).toBe(true)
    expect(isPathnameAllowed('/anything', ['/'])).toBe(false)
  })

  it('returns false for an empty allowlist', () => {
    expect(isPathnameAllowed('/', [])).toBe(false)
  })
})
