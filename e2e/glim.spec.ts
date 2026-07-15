import { test, expect, type Page } from '@playwright/test'

interface Center {
  x: number
  y: number
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

// The glim character is the layered radial-gradient orb inside the open shadow
// root under <div data-glim-root>. We locate it by computed background-image so
// the test does not depend on private class names.
async function getGlimCenter(page: Page): Promise<Center | null> {
  return page.evaluate(() => {
    const glimRootHost = document.querySelector('div[data-glim-root]')
    const shadowRoot = glimRootHost?.shadowRoot
    if (!shadowRoot) return null
    const radialGradientElements = Array.from(shadowRoot.querySelectorAll<HTMLElement>('*')).filter(
      (element) => getComputedStyle(element).backgroundImage.includes('radial-gradient'),
    )
    if (radialGradientElements.length === 0) return null
    const orbRect = radialGradientElements[0].getBoundingClientRect()
    return { x: orbRect.left + orbRect.width / 2, y: orbRect.top + orbRect.height / 2 }
  })
}

// Distance from a point to the nearest edge of a rectangle (0 if inside it).
function distanceToRect(center: Center, box: Box): number {
  const nearestX = Math.min(Math.max(center.x, box.x), box.x + box.width)
  const nearestY = Math.min(Math.max(center.y, box.y), box.y + box.height)
  return Math.hypot(center.x - nearestX, center.y - nearestY)
}

async function askGlim(page: Page, question: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'ask glim' }).click()
  const questionInput = page.locator('div[data-glim-root] input')
  await questionInput.fill(question)
  await questionInput.press('Enter')
}

async function pollUntilGlimLandsNear(page: Page, targetBox: Box): Promise<void> {
  await expect
    .poll(
      async () => {
        const glimCenter = await getGlimCenter(page)
        if (glimCenter === null) return Number.POSITIVE_INFINITY
        return distanceToRect(glimCenter, targetBox)
      },
      { timeout: 15_000, intervals: [100] },
    )
    .toBeLessThan(60)
}

test('streams guidance into the bubble when asked how to create a test', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'default-motion project only')
  await askGlim(page, 'how do i create a test?')
  await expect(page.getByText("let's spin up a new test").first()).toBeVisible({ timeout: 15_000 })
})

test('flies the glim to land beside the New test button', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'default-motion project only')
  await askGlim(page, 'how do i create a test?')
  await expect(page.getByText("let's spin up a new test").first()).toBeVisible({ timeout: 15_000 })

  const newTestButtonBox = await page.getByRole('button', { name: 'New test' }).boundingBox()
  expect(newTestButtonBox).not.toBeNull()
  await pollUntilGlimLandsNear(page, newTestButtonBox!)
})

test('resumes the turn after the user clicks New test', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'default-motion project only')
  await askGlim(page, 'how do i create a test?')
  await expect(page.getByText("let's spin up a new test").first()).toBeVisible({ timeout: 15_000 })

  const newTestButton = page.getByRole('button', { name: 'New test' })
  const newTestButtonBox = await newTestButton.boundingBox()
  expect(newTestButtonBox).not.toBeNull()
  // Waiting for landing guarantees the wait_for suspension (click waiter) is active.
  await pollUntilGlimLandsNear(page, newTestButtonBox!)

  await newTestButton.click()
  await expect(page.getByText('recce is on it!').first()).toBeVisible({ timeout: 15_000 })
})

test('asking about settings after a completed create-test flow does not replay the resume scenario', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'default-motion project only')

  // First, complete the entire create-test flow so the conversation history carries
  // a tool_result block from the wait_for resume (this is the state that used to
  // poison every later ask — see fixtureClient's old whole-history 'tool_result' check).
  await askGlim(page, 'how do i create a test?')
  await expect(page.getByText("let's spin up a new test").first()).toBeVisible({ timeout: 15_000 })

  const newTestButton = page.getByRole('button', { name: 'New test' })
  const newTestButtonBox = await newTestButton.boundingBox()
  expect(newTestButtonBox).not.toBeNull()
  await pollUntilGlimLandsNear(page, newTestButtonBox!)

  await newTestButton.click()
  await expect(page.getByText('recce is on it!').first()).toBeVisible({ timeout: 15_000 })

  // Now ask an unrelated fresh question in the SAME session. The old fixture
  // keyed off the entire serialized history, so the leftover tool_result from
  // the create-test resume would forever win and replay "recce is on it!".
  await askGlim(page, 'how do i get to settings?')
  await expect(page.getByText('settings page is right up here').first()).toBeVisible({ timeout: 15_000 })

  // The bubble must have moved on, not merely gained new text alongside the old.
  await expect(page.getByText('recce is on it!')).toHaveCount(0)

  const settingsLink = page.getByRole('link', { name: 'Org settings' })
  const settingsLinkBox = await settingsLink.boundingBox()
  expect(settingsLinkBox).not.toBeNull()
  await pollUntilGlimLandsNear(page, settingsLinkBox!)
})

test('reduced motion lands without an intermediate flight', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'reduced-motion project only')
  await page.goto('/')
  await page.getByRole('button', { name: 'ask glim' }).click()
  const questionInput = page.locator('div[data-glim-root] input')
  const initialCenter = await getGlimCenter(page)
  expect(initialCenter).not.toBeNull()

  await questionInput.fill('how do i create a test?')
  await questionInput.press('Enter')
  await expect(page.getByText("let's spin up a new test").first()).toBeVisible({ timeout: 15_000 })

  const newTestButtonBox = await page.getByRole('button', { name: 'New test' }).boundingBox()
  expect(newTestButtonBox).not.toBeNull()

  // Sample the glim position every 50ms. With reduced motion the position must
  // JUMP: the first sample that shows movement away from the idle position must
  // already be (or be within 200ms of) the landed position. A rAF flight would
  // take >= 600ms between those two moments and fail this assertion.
  let movementStartedAt: number | null = null
  let landedAt: number | null = null
  const samplingDeadline = Date.now() + 15_000
  while (Date.now() < samplingDeadline) {
    const glimCenter = await getGlimCenter(page)
    const sampleTime = Date.now()
    if (glimCenter !== null && movementStartedAt === null) {
      const movedDistance = Math.hypot(glimCenter.x - initialCenter!.x, glimCenter.y - initialCenter!.y)
      if (movedDistance > 5) movementStartedAt = sampleTime
    }
    if (glimCenter !== null && distanceToRect(glimCenter, newTestButtonBox!) < 60) {
      landedAt = sampleTime
      break
    }
    await page.waitForTimeout(50)
  }

  expect(landedAt, 'glim never reached the landing position beside New test').not.toBeNull()
  expect(movementStartedAt, 'glim never moved from its idle position').not.toBeNull()
  expect(landedAt! - movementStartedAt!).toBeLessThanOrEqual(200)
})
