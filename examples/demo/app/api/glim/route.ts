import {
  createGlimHandler,
  defineGuide,
  point,
  waitFor,
  say,
} from '@glim-sdk/next/server'

const publishListingGuide = defineGuide({
  id: 'publish-listing',
  when: 'user asks how to publish a listing or make a draft listing live',
  steps: [
    point('the Publish button on the draft listing', 'hit publish right here'),
    waitFor({ click: true }),
    say('nice — your place is live!'),
  ],
})

const inviteTeammateGuide = defineGuide({
  id: 'invite-teammate',
  when: 'user asks how to invite a teammate or add someone to the team',
  steps: [
    point('the Invite button on the team page', 'tap invite to open the dialog'),
    waitFor({ click: true }),
    point(
      'the email input in the invite dialog',
      "pop your teammate's email in here",
    ),
    say('hit send invite and they get a link to join.'),
  ],
})

type GlimAnthropicClient = NonNullable<
  Parameters<typeof createGlimHandler>[0]['client']
>

async function resolveFixtureClient(): Promise<GlimAnthropicClient | undefined> {
  if (!process.env.GLIM_FIXTURE) {
    return undefined
  }
  // A literal specifier so the bundler compiles fixtures/fixtureClient.ts into
  // the route bundle. (The earlier webpackIgnore + variable-specifier form
  // deferred resolution to runtime, where Node looked for the module relative
  // to the compiled chunk inside .next/server and cannot import .ts anyway.)
  const fixtureModule = await import('../../../fixtures/fixtureClient')
  return new fixtureModule.FixtureClient()
}

type GlimRequestHandler = (request: Request) => Promise<Response>

let cachedHandlerPromise: Promise<GlimRequestHandler> | null = null

function getGlimHandler(): Promise<GlimRequestHandler> {
  if (cachedHandlerPromise === null) {
    cachedHandlerPromise = resolveFixtureClient().then((fixtureClient) =>
      createGlimHandler({
        apiKey: process.env.ANTHROPIC_API_KEY,
        knowledge: process.cwd() + '/knowledge',
        guides: [publishListingGuide, inviteTeammateGuide],
        client: fixtureClient,
      }),
    )
  }
  return cachedHandlerPromise
}

export async function POST(request: Request): Promise<Response> {
  const glimHandler = await getGlimHandler()
  return glimHandler(request)
}
