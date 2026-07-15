// Matches a pathname against an allowlist of route prefixes. A route matches
// its own exact pathname, or any pathname nested under it — '/automations'
// matches '/automations' and '/automations/new', but not '/automations-old'
// (a plain startsWith would false-positive on that). '/' only ever matches
// the exact root, since every pathname "starts with" '/'.
export function isPathnameAllowed(pathname: string, allowedRoutes: string[]): boolean {
  return allowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}
