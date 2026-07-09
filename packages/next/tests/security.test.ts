import { describe, it, expect } from 'vitest'
import { checkOrigin, MAX_BODY_BYTES } from '../src/server/security'

describe('checkOrigin', () => {
  it('allows requests with no Origin header', () => {
    const request = new Request('https://app.example.com/api/glim', { method: 'POST' })
    expect(checkOrigin(request)).toBe(true)
  })

  it('allows requests whose Origin host matches the request URL host', () => {
    const request = new Request('https://app.example.com/api/glim', {
      method: 'POST',
      headers: { origin: 'https://app.example.com' },
    })
    expect(checkOrigin(request)).toBe(true)
  })

  it('rejects requests whose Origin host does not match the request URL host', () => {
    const request = new Request('https://app.example.com/api/glim', {
      method: 'POST',
      headers: { origin: 'https://evil.example.net' },
    })
    expect(checkOrigin(request)).toBe(false)
  })

  it('allows an Origin that is in the allowedOrigins list even when hosts differ', () => {
    const request = new Request('https://app.example.com/api/glim', {
      method: 'POST',
      headers: { origin: 'https://marketing.example.net' },
    })
    expect(checkOrigin(request, ['https://marketing.example.net'])).toBe(true)
  })

  it('rejects an Origin that is not in the allowedOrigins list', () => {
    const request = new Request('https://app.example.com/api/glim', {
      method: 'POST',
      headers: { origin: 'https://evil.example.net' },
    })
    expect(checkOrigin(request, ['https://marketing.example.net'])).toBe(false)
  })

  it('rejects a malformed Origin header', () => {
    const request = new Request('https://app.example.com/api/glim', {
      method: 'POST',
      headers: { origin: 'not-a-url' },
    })
    expect(checkOrigin(request)).toBe(false)
  })
})

describe('MAX_BODY_BYTES', () => {
  it('is 262144 bytes (256 KiB)', () => {
    expect(MAX_BODY_BYTES).toBe(262144)
  })
})
