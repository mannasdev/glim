// Matches a pathname against an allowlist of route prefixes. A route matches
// its own exact pathname, or any pathname nested under it — '/automations'
// matches '/automations' and '/automations/new', but not '/automations-old'
// (a plain startsWith would false-positive on that). '/' only ever matches
// the exact root, since every pathname "starts with" '/'.
//
// A trailing slash on either side is normalized away first, so a natural-looking
// allowlist entry like '/settings/' still matches '/settings' (and a
// `trailingSlash: true` pathname like '/settings/' matches a clean '/settings'
// entry). The root '/' is left intact so it keeps matching only the exact root.
function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

export function isPathnameAllowed(pathname: string, allowedRoutes: string[]): boolean {
  const normalizedPathname = stripTrailingSlash(pathname)
  return allowedRoutes.some((route) => {
    const normalizedRoute = stripTrailingSlash(route)
    return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`)
  })
}
