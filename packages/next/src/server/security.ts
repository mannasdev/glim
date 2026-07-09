// Request-level security defaults for the Glim route handler. Lesson from the
// Clicky Cloudflare Worker: an unprotected proxy means drainable API keys, so
// same-origin checking and body-size caps are on by default.

export const MAX_BODY_BYTES = 262144

export function checkOrigin(request: Request, allowedOrigins?: string[]): boolean {
  const originHeader = request.headers.get('origin')

  // Same-origin browser requests and non-browser clients may omit the Origin
  // header entirely; treat its absence as same-origin.
  if (originHeader === null) {
    return true
  }

  if (allowedOrigins !== undefined && allowedOrigins.length > 0) {
    return allowedOrigins.includes(originHeader)
  }

  try {
    const originHost = new URL(originHeader).host
    const requestUrlHost = new URL(request.url).host
    return originHost === requestUrlHost
  } catch {
    // An Origin header that is not a parseable URL is never same-origin.
    return false
  }
}
