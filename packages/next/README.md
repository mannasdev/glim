# Glim

Glim is a drop-in guidance companion for Next.js apps: a small glowing character that lives in your product, answers end-user questions in a streamed speech bubble, and flies to and points at the exact UI elements it references. Install one npm package, mount one provider and one route handler, and your product can teach itself to users — grounding is a live DOM snapshot, so guidance survives redesigns. Optional guides make key journeys deterministic, and client tools let the model call into your app code.

## Requirements

- Node >= 20
- pnpm
- An Anthropic API key

## Quickstart

**1. Install**

```bash
pnpm add @glim-sdk/next
```

**2. Mount the provider once in your root layout**

```tsx
// app/layout.tsx
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

**3. Add the route handler**

```ts
// app/api/glim/route.ts
import { createGlimHandler } from '@glim-sdk/next/server'
import { publishListingGuide } from './guides'

export const POST = createGlimHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-5',          // default
  persona: 'warm, brief, lowercase', // optional brand voice override
  knowledge: './docs',               // optional markdown folder
  guides: [publishListingGuide],
})
```

## Security

- **Origin.** The handler compares the request's `Origin` header host against its own host (a missing `Origin` is treated as same-origin). Set `allowedOrigins: ['https://app.example.com']` explicitly in production — especially behind a TLS-terminating proxy or CDN, where the request URL host can differ from the public origin.
- **The endpoint drives your API key.** Any same-origin end user can send questions through this route and spend against the configured Anthropic key. That spend is bounded by the built-in `maxTokens`, `maxLoops`, and request-body size caps, but the route is not authenticated — add your own auth/rate limiting if you need per-user limits.

**4. (Optional) Define a guide**

Guides are playbooks, not selector recordings — the model follows the steps semantically and improvises when the user deviates.

```ts
// app/api/glim/guides.ts
import { defineGuide, point, waitFor, say } from '@glim-sdk/next/server'

export const publishListingGuide = defineGuide({
  id: 'publish-listing',
  when: 'user asks how to publish or make a listing live',
  steps: [
    point('the Publish button on the draft listing', 'hit publish right here'),
    waitFor({ click: true }),
    say('nice — your place is live!'),
  ],
})
```

## Running the demo

The repo ships with "Harbor", a fake vacation-rental dashboard, in `examples/demo`.

```bash
pnpm install
pnpm --filter harbor-demo dev
```

Open http://localhost:3000 and ask the glim "how do i publish?". Set `GLIM_FIXTURE=1` to run against a canned fixture model instead of the live Anthropic API:

```bash
GLIM_FIXTURE=1 pnpm --filter harbor-demo dev
```

## Running tests

**Unit and integration tests** (vitest, jsdom):

```bash
pnpm --filter @glim-sdk/next test
```

**End-to-end tests** (Playwright drives Harbor against the fixture model — no API key needed):

```bash
npx playwright install chromium
pnpm e2e
```
