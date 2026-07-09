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
  const numberedStepLines = guide.steps.map((guideStep, stepIndex) =>
    compileStepLine(guideStep, stepIndex + 1)
  )
  return [`## Playbook: ${guide.id}`, `When: ${guide.when}`, 'Steps:', ...numberedStepLines].join('\n')
}

function compileStepLine(guideStep: GuideStep, stepNumber: number): string {
  switch (guideStep.kind) {
    case 'point':
      return `${stepNumber}. fly to and point at "${guideStep.target}", saying: "${guideStep.say}"`
    case 'waitFor': {
      if (guideStep.condition.click) {
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
