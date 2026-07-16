import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../src/server/prompt'

describe('buildSystemPrompt', () => {
  it('uses the default persona when opts.persona is omitted', () => {
    const systemPrompt = buildSystemPrompt({ playbooks: '', hasKnowledge: false })
    expect(systemPrompt).toContain('you are glim')
    expect(systemPrompt).toContain('err on the side of pointing')
    expect(systemPrompt).toContain('never end your turn on a dead-end yes/no question')
    expect(systemPrompt).toContain('never say "simply" or "just"')
  })

  it('uses opts.persona verbatim instead of the default persona when provided', () => {
    const customPersona = 'You are Harbor Helper. Speak formally and in full sentences.'
    const systemPrompt = buildSystemPrompt({ persona: customPersona, playbooks: '', hasKnowledge: false })
    expect(systemPrompt).toContain(customPersona)
    expect(systemPrompt).not.toContain('you are glim')
  })

  it('always includes the small-bubble answer-format rules, even under a custom persona', () => {
    const withDefault = buildSystemPrompt({ playbooks: '', hasKnowledge: false })
    const withCustom = buildSystemPrompt({
      persona: 'You are Formal Bot. Speak in full paragraphs.',
      playbooks: '',
      hasKnowledge: false,
    })
    for (const systemPrompt of [withDefault, withCustom]) {
      expect(systemPrompt).toContain('# Answer format')
      expect(systemPrompt).toContain('never a wall of text')
      expect(systemPrompt).toContain('no markdown')
    }
  })

  it('always includes the ref-grounding rules', () => {
    const systemPrompt = buildSystemPrompt({ playbooks: '', hasKnowledge: false })
    expect(systemPrompt).toContain('DOM outline')
    expect(systemPrompt).toContain('e14')
    expect(systemPrompt).toContain('never invent refs')
    expect(systemPrompt).toContain('get_snapshot')
  })

  it('always includes the tool usage rules with wait_for pacing guidance', () => {
    const systemPrompt = buildSystemPrompt({ playbooks: '', hasKnowledge: false })
    expect(systemPrompt).toContain('wait_for')
    expect(systemPrompt).toContain('point at one step, wait_for the user to complete it')
  })

  it('includes a Playbooks section when playbooks is non-empty', () => {
    const compiledPlaybooks =
      '## Playbook: publish-listing\nWhen: user asks how to publish or make a listing live\n1. point at the Publish button and say "hit publish right here"'
    const systemPrompt = buildSystemPrompt({ playbooks: compiledPlaybooks, hasKnowledge: false })
    expect(systemPrompt).toContain('# Playbooks')
    expect(systemPrompt).toContain(compiledPlaybooks)
    expect(systemPrompt).toContain('follow that playbook’s steps in order')
    expect(systemPrompt).toContain('improvise a recovery')
  })

  it('omits the Playbooks section when playbooks is empty', () => {
    const systemPrompt = buildSystemPrompt({ playbooks: '', hasKnowledge: false })
    expect(systemPrompt).not.toContain('# Playbooks')
  })

  it('includes the search_docs line only when hasKnowledge is true', () => {
    const withKnowledge = buildSystemPrompt({ playbooks: '', hasKnowledge: true })
    const withoutKnowledge = buildSystemPrompt({ playbooks: '', hasKnowledge: false })
    expect(withKnowledge).toContain('use search_docs before answering product questions')
    expect(withoutKnowledge).not.toContain('search_docs')
  })
})
