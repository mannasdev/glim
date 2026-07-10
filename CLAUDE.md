# Glim (`@glim-sdk/next`) — AI Agent Integration Guide

This file teaches AI coding agents (Claude Code, Cursor, etc.) how to integrate Glim into a user's Next.js app correctly on the first attempt. If you are an agent adding Glim to a project: follow this exactly — every export, prop, and behavior below matches the published package.

**Copy this file into your project** (or reference it) when asking an AI agent to add Glim:
`https://raw.githubusercontent.com/mannasdev/glim/main/CLAUDE.md`

## What Glim is

A drop-in guidance companion for Next.js apps: a small animated character that answers end-users' questions in a streamed speech bubble and flies to point at the exact live DOM elements it references. Claude reads a text snapshot of the live page (no screenshots, no hardcoded selectors), so guidance keeps working when the UI changes. Guides are optional playbooks the model follows step-by-step — pointing, then *waiting for the user's own click* before continuing.

## Requirements

- Next.js >= 14 (App Router), React >= 18, react-dom >= 18
- An Anthropic API key (server-side only — never expose it to the client)

## Integration — exactly three steps

### 1. Install

```bash
pnpm add @glim-sdk/next   # or npm i / yarn add
```

### 2. Mount the provider (app/layout.tsx)

`GlimProvider` is a client component but may be imported in a server layout; it MUST WRAP `{children}` — mounting it as a sibling makes `useGlim`/`useGlimTool` throw at runtime.

```tsx
import { GlimProvider } from '@glim-sdk/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlimProvider>{children}</GlimProvider>
      </body>
    </html>
  )
}
```

Provider props (all optional): `endpoint` (default `/api/glim`), `theme` (CSS custom properties, e.g. `{ '--glim-hue': '45' }`), `enabled` (default true — master switch; when false Glim shows no UI on any route, but `useGlim`/`useGlimTool` still work, they just no-op), `allowedRoutes` (restrict Glim to specific pages, e.g. `['/', '/dashboard', '/settings']` — a route matches its own pathname or anything nested under it; omit to allow every route), `character` (see Characters below).

Most apps don't need every page instrumented — a dashboard needs guidance, a bare marketing footer usually doesn't. Reach for `allowedRoutes` instead of conditionally rendering `<GlimProvider>` yourself or hand-rolling route-matching in a wrapper component; both were previously-real gotchas here (`useGlim()` used to throw when Glim wasn't active on a route, and a naive route-check often false-positives on prefix collisions like `/settings` vs `/settings-legacy`). `allowedRoutes` handles both correctly:

```tsx
<GlimProvider allowedRoutes={['/', '/dashboard', '/settings']}>{children}</GlimProvider>
```

**When to check `active`:** only for a component that lives OUTSIDE the route scoping — something global like a header, shared layout, or nav bar that renders on every page regardless of `allowedRoutes`. That component has no built-in awareness of which routes are allowed, so without checking `active` it would render fully visible (and clickable) on a route Glim doesn't cover, and calling `ask()`/`startGuide()` there just silently no-ops (no crash, but nothing happens — a dead button).

A component that's already page-local (e.g. only rendered inside `app/dashboard/page.tsx`, and `/dashboard` is in `allowedRoutes`) needs no check at all — its own placement already guarantees it only renders where Glim is active.

```tsx
// Lives in a global header, rendered on every route:
function ShowMeHowButton() {
  const { active, startGuide } = useGlim()
  if (!active) return null // only needed because this button is global
  return <button onClick={() => startGuide('publish-listing')}>✨ Show me how</button>
}
```

### 3. Add the route handler (app/api/glim/route.ts)

```ts
import { createGlimHandler, defineGuide, point, waitFor, say } from '@glim-sdk/next/server'

export const POST = createGlimHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // model: 'claude-sonnet-5',          // default
  // persona: 'warm, concise, upbeat',  // optional brand-voice override
  // knowledge: process.cwd() + '/knowledge', // optional folder of .md help docs
  // guides: [/* see Guides below */],
  // allowedOrigins: ['https://app.example.com'], // set explicitly in production
})
```

And the key in `.env.local` (gitignored — NEVER `NEXT_PUBLIC_`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

That's a working integration. The launcher appears bottom-right; users ask anything; the character points at real elements.

## Guides (optional playbooks)

```ts
const weeklyTaskGuide = defineGuide({
  id: 'weekly-recurring-task',
  when: 'user asks how to set up a recurring or repeating task',
  steps: [
    point('the Website Launch list card on the dashboard', 'open your list first'),
    waitFor({ click: true }),
    point('the "+ Add task" input', 'type your task here and add it'),
    waitFor({ elementText: 'Task details' }),
    point('the Advanced section toggle', 'the repeat options hide in here'),
    waitFor({ click: true }),
    say('now set Repeat to Weekly and pick a teammate — then hit Save!'),
  ],
})
```

Authoring rules for agents:
- `point(target, say)` — describe the target **semantically, as a human would** ("the Publish button on the draft card"), never as a CSS selector. The model grounds it against the live DOM snapshot.
- `waitFor({ click: true })` — the user must click before the guide continues (Glim coaches; it never clicks for the user). The model scopes this to whatever it just pointed at automatically, so a stray click elsewhere on the page (or a misclick on an unrelated overlay) won't falsely complete the step. Also: `waitFor({ route: '/settings' })` (pathname match — only resolves on a *future* navigation, so don't use it as the very first step of a guide that might already be running on that page) and `waitFor({ elementText: 'some text' })` (text appears on page — pick text unique to the thing you're waiting for; if it's already present elsewhere on the page before the step happens, e.g. matching a trigger button's own label, the wait resolves instantly and incorrectly).
- `say(text)` — spoken step without pointing.
- `when` matters: it's how the model decides a guide applies. Write it like the user's question, not like documentation.
- Guides are playbooks, not scripts — the model improvises recovery if the user wanders off-path. Write step intent, not pixel-perfect procedure.

## Programmatic control (client components)

```tsx
'use client'
import { useGlim, useGlimTool } from '@glim-sdk/next'

function ShowMeHowButton() {
  const glim = useGlim() // { ask, open, close, startGuide, status, active }
  // Only needed because THIS button is global (rendered in a shared header
  // on every route) and GlimProvider uses allowedRoutes — without this check
  // it would render fine (no crash) but silently no-op on pages Glim isn't
  // covering, which reads as a dead button. Skip this check entirely for a
  // button already scoped to an allowed page (e.g. one that only renders
  // inside app/dashboard/page.tsx when '/dashboard' is in allowedRoutes) —
  // its placement alone already guarantees it.
  if (!glim.active) return null
  return <button onClick={() => glim.startGuide('weekly-recurring-task')}>✨ Show me how</button>
}

function InviteArea() {
  // Registers a client-side function the MODEL can call mid-conversation:
  useGlimTool('open_invite_modal', 'opens the invite-teammate dialog', async () => {
    openInviteModal()
    return 'modal is open'
  })
  return /* ... */
}
```

Both hooks throw if used outside `<GlimProvider>` entirely (no ancestor provider in the tree at all) — that error means the provider isn't wrapping this component's tree. They do NOT throw just because Glim is inactive (`enabled={false}` or the current route isn't in `allowedRoutes`) — check `active` for that instead.

## Characters

Default is a glowing orb. Built-in alternative and full customization:

```tsx
import { GlimProvider, CloudCharacter } from '@glim-sdk/next'

<GlimProvider character={<CloudCharacter />}>{children}</GlimProvider>

// Or any React node / state-aware render function:
<GlimProvider character={({ status, flying }) => <MyMascot excited={flying} />}>
```

Custom characters ride Glim's flight/position/scale automatically (deliberately NOT its rotation — asymmetric characters shouldn't tumble).

## Knowledge folder (optional)

Point `knowledge:` at a folder of Markdown files (split by `##` headings). The model calls a search tool over it before answering product questions. Write files like help-center articles.

## Behaviors agents should know (do not "fix" these)

- All Glim UI renders in a shadow-DOM portal under `<div data-glim-root>` — isolated from app CSS, excluded from its own page snapshots.
- Conversation history persists in `sessionStorage['glim:history']` (per-tab). Clearing it resets the conversation. Abandoned guide steps are self-healed server-side — safe.
- `prefers-reduced-motion` is honored automatically (fades instead of flights).
- Retryable API errors retry once automatically; users see a friendly error bubble otherwise.
- Mount exactly ONE `GlimProvider` per app.

## Security notes for production

- The API key lives only in the route handler (server). Same-origin requests are accepted by default; set `allowedOrigins` (full origin strings incl. scheme) explicitly in production, especially behind TLS-terminating proxies.
- Any signed-in user of the host app can drive the configured key through this endpoint — bounded by max 1024 output tokens/call, max 6 model calls/turn, 256KB request cap. Deploy with eyes open; add your own rate limiting if needed.

## Verify the integration (agents: run these checks)

1. `pnpm build` succeeds (no `NEXT_PUBLIC_` key leaked; route compiles as `ƒ /api/glim`).
2. Run dev, open the app: launcher visible bottom-right.
3. Ask "what can you help with?" — text streams into the bubble.
4. Ask about something visible on screen — the character should fly to and point at it.
5. If you registered guides: trigger via `startGuide(id)` and complete one step by clicking yourself.

## Links

- Repo & README: https://github.com/mannasdev/glim
- npm: https://www.npmjs.com/package/@glim-sdk/next
- Demo app (reference integration): `examples/demo` in the repo — a complete working example of every feature above.
