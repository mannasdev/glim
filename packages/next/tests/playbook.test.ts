import { describe, expect, it } from 'vitest'
import { defineGuide, point, say, waitFor } from '../src/guides/defineGuide'
import { compilePlaybooks } from '../src/guides/playbook'

describe('compilePlaybooks', () => {
  it('compiles two guides into exact playbook blocks separated by a blank line', () => {
    const publishListingGuide = defineGuide({
      id: 'publish-listing',
      when: 'user asks how to publish or make a listing live',
      steps: [
        point('the Publish button on the draft listing', 'hit publish right here'),
        waitFor({ click: true }),
        say('nice — your place is live!'),
      ],
    })

    const inviteTeammateGuide = defineGuide({
      id: 'invite-teammate',
      when: 'user asks how to add or invite a team member',
      steps: [
        say("let's head to the team page"),
        waitFor({ route: '/team' }),
        point('the Invite button', 'click invite here'),
        waitFor({ elementText: 'Invite teammate' }),
        say('fill in their email and send it off'),
      ],
    })

    const expectedPlaybookText = [
      '## Playbook: publish-listing',
      'When: user asks how to publish or make a listing live',
      'Steps:',
      '1. fly to and point at "the Publish button on the draft listing", saying: "hit publish right here"',
      '2. wait for the user to click it themselves — do not proceed until they do',
      '3. say: "nice — your place is live!"',
      '',
      '## Playbook: invite-teammate',
      'When: user asks how to add or invite a team member',
      'Steps:',
      '1. say: "let\'s head to the team page"',
      '2. wait until the user navigates to /team',
      '3. fly to and point at "the Invite button", saying: "click invite here"',
      '4. wait until "Invite teammate" appears on the page',
      '5. say: "fill in their email and send it off"',
    ].join('\n')

    expect(compilePlaybooks([publishListingGuide, inviteTeammateGuide])).toBe(expectedPlaybookText)
  })

  it('returns an empty string for an empty guide array', () => {
    expect(compilePlaybooks([])).toBe('')
  })
})
