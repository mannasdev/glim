export interface GlimGuide {
  id: string
  when: string
  steps: GuideStep[]
}

export type GuideStep =
  | { kind: 'point'; target: string; say: string }
  | { kind: 'waitFor'; condition: { click?: true; route?: string; elementText?: string } }
  | { kind: 'say'; text: string }

/**
 * Validates and returns a guide unchanged. Guides are compiled into playbook
 * blocks in the system prompt by compilePlaybooks (guides/playbook.ts), so an
 * empty id, empty when-matcher, or empty step list would produce a playbook
 * the model can never match or follow — we reject those at definition time.
 */
export function defineGuide(guide: GlimGuide): GlimGuide {
  if (guide.id.trim() === '') {
    throw new Error(`guide ${guide.id} must have a non-empty id`)
  }
  if (guide.when.trim() === '') {
    throw new Error(`guide ${guide.id} must have a non-empty when`)
  }
  if (guide.steps.length === 0) {
    throw new Error(`guide ${guide.id} must have at least one step`)
  }
  return guide
}

export function point(target: string, say: string): GuideStep {
  return { kind: 'point', target, say }
}

export function waitFor(condition: { click?: true; route?: string; elementText?: string }): GuideStep {
  return { kind: 'waitFor', condition }
}

export function say(text: string): GuideStep {
  return { kind: 'say', text }
}
