import type { GuideStep, GlimGuide } from './defineGuide'

/**
 * Compiles developer-defined guides into prose playbook blocks for the system
 * prompt. The model matches a user question against each 'When:' line and then
 * follows that playbook's numbered steps in order, improvising when the user
 * deviates. Returns '' when there are no guides.
 */
export function compilePlaybooks(guides: GlimGuide[]): string {
  return guides.map(compileSinglePlaybookBlock).join('\n\n')
}

function compileSinglePlaybookBlock(guide: GlimGuide): string {
  // Tracks the target of the most recent 'point' step so a 'waitFor(click)'
  // right after it can tell the model to scope the wait to that same
  // element, instead of leaving it to default to "any click, anywhere".
  let lastPointedTarget: string | null = null
  const numberedStepLines = guide.steps.map((guideStep, stepIndex) => {
    const line = compileStepLine(guideStep, stepIndex + 1, lastPointedTarget)
    lastPointedTarget = guideStep.kind === 'point' ? guideStep.target : null
    return line
  })
  return [`## Playbook: ${guide.id}`, `When: ${guide.when}`, 'Steps:', ...numberedStepLines].join('\n')
}

function compileStepLine(guideStep: GuideStep, stepNumber: number, lastPointedTarget: string | null): string {
  switch (guideStep.kind) {
    case 'point':
      return `${stepNumber}. fly to and point at "${guideStep.target}", saying: "${guideStep.say}"`
    case 'waitFor': {
      if (guideStep.condition.click) {
        if (lastPointedTarget !== null) {
          return `${stepNumber}. wait for the user to click "${lastPointedTarget}" themselves — call wait_for with that same element's ref so a click elsewhere does not complete this step early. do not proceed until they do`
        }
        return `${stepNumber}. wait for the user to click it themselves — do not proceed until they do`
      }
      if (guideStep.condition.route !== undefined) {
        return `${stepNumber}. wait until the user navigates to ${guideStep.condition.route}`
      }
      return `${stepNumber}. wait until "${guideStep.condition.elementText ?? ''}" appears on the page`
    }
    case 'say':
      return `${stepNumber}. say: "${guideStep.text}"`
  }
}
