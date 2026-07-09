import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadKnowledge } from '../src/server/knowledge'

let knowledgeDir: string

beforeAll(() => {
  knowledgeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glim-knowledge-'))
  fs.writeFileSync(
    path.join(knowledgeDir, 'publishing.md'),
    [
      '# Publishing',
      '',
      'Publishing makes your listing visible to guests.',
      '',
      '## Draft listings',
      '',
      'A draft listing stays hidden until you publish it.',
      '',
      '## Going live',
      '',
      'Hit the Publish button and the listing goes live immediately.',
      '',
    ].join('\n'),
  )
  fs.mkdirSync(path.join(knowledgeDir, 'guides'))
  fs.writeFileSync(
    path.join(knowledgeDir, 'guides', 'billing.md'),
    'Billing is handled monthly. Invoices arrive by email.\n',
  )
})

afterAll(() => {
  fs.rmSync(knowledgeDir, { recursive: true, force: true })
})

describe('loadKnowledge', () => {
  it('splits a file into a preamble chunk plus one chunk per ## section, titled by headings', () => {
    const chunks = loadKnowledge(knowledgeDir)
    const publishingChunks = chunks.filter((chunk) => chunk.path === 'publishing.md')
    expect(publishingChunks).toEqual([
      {
        path: 'publishing.md',
        title: 'Publishing',
        text: 'Publishing makes your listing visible to guests.',
      },
      {
        path: 'publishing.md',
        title: 'Draft listings',
        text: 'A draft listing stays hidden until you publish it.',
      },
      {
        path: 'publishing.md',
        title: 'Going live',
        text: 'Hit the Publish button and the listing goes live immediately.',
      },
    ])
  })

  it('titles a headingless file by its filename and records subdirectory-relative paths', () => {
    const chunks = loadKnowledge(knowledgeDir)
    const billingChunks = chunks.filter((chunk) => chunk.path === 'guides/billing.md')
    expect(billingChunks).toEqual([
      {
        path: 'guides/billing.md',
        title: 'billing.md',
        text: 'Billing is handled monthly. Invoices arrive by email.',
      },
    ])
  })
})
