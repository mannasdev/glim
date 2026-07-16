import {
  createGlimHandler,
  defineGuide,
  point,
  waitFor,
  say,
} from '@glim-sdk/next/server'

const createTestGuide = defineGuide({
  id: 'create-test',
  when: 'user asks how to create, add, or write a new test',
  steps: [
    point('the "New test" button in the left sidebar', 'start a new test right here'),
    waitFor({ click: true }),
    point(
      'the plain-English description box in the New test dialog',
      "describe the flow the way you'd tell a teammate",
    ),
    say(
      'add the URL, then hit Create test — recce will drive your real site and grab the receipts.',
    ),
  ],
})

const inviteMemberGuide = defineGuide({
  id: 'invite-member',
  when: 'user asks how to invite a teammate or add a member',
  steps: [
    point('the Invite button on the Members page', 'open the invite dialog here'),
    waitFor({ click: true }),
    point(
      'the email input in the invite dialog',
      "drop your teammate's email in here",
    ),
    say(
      'pick a role and hit Send invite — they get a link to join the Acme workspace.',
    ),
  ],
})

const scheduleRunGuide = defineGuide({
  id: 'schedule-run',
  when: 'user asks how to run a test automatically or on a schedule',
  steps: [
    point('the Schedules item in the left sidebar', 'schedules live in here'),
    waitFor({ route: '/schedules' }),
    point('the "New schedule" button', 'create a schedule to run a test on a cadence'),
    say(
      'pick a test and a cadence like every 15 minutes — recce watches it around the clock.',
    ),
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
        guides: [createTestGuide, inviteMemberGuide, scheduleRunGuide],
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
