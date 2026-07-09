import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadKnowledge, searchDocs } from '../src/server/knowledge'
import type { DocChunk } from '../src/server/knowledge'

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

describe('searchDocs', () => {
  const titleMatchChunk: DocChunk = {
    path: 'a.md',
    title: 'invoices and billing',
    text: 'unrelated words entirely',
  }
  const bodyMatchChunk: DocChunk = {
    path: 'b.md',
    title: 'other topic',
    text: 'your invoices arrive monthly',
  }
  const noMatchChunk: DocChunk = {
    path: 'c.md',
    title: 'team',
    text: 'add members from the team page',
  }

  it('ranks a title match above a body match and filters out non-matches', () => {
    // titleMatchChunk scores 2 (one title hit x2); bodyMatchChunk scores 1 (one body hit).
    const results = searchDocs([noMatchChunk, bodyMatchChunk, titleMatchChunk], 'invoices')
    expect(results).toEqual([titleMatchChunk, bodyMatchChunk])
  })

  it('matches case-insensitively', () => {
    const results = searchDocs([bodyMatchChunk], 'INVOICES')
    expect(results).toEqual([bodyMatchChunk])
  })

  it('returns at most 3 results by default and honors an explicit limit', () => {
    const rankedChunks: DocChunk[] = [1, 2, 3, 4, 5].map((termFrequency) => ({
      path: `${termFrequency}.md`,
      title: 'note',
      text: Array(termFrequency).fill('publish').join(' '),
    }))
    const defaultLimitResults = searchDocs(rankedChunks, 'publish')
    expect(defaultLimitResults.map((chunk) => chunk.path)).toEqual(['5.md', '4.md', '3.md'])
    const explicitLimitResults = searchDocs(rankedChunks, 'publish', 2)
    expect(explicitLimitResults.map((chunk) => chunk.path)).toEqual(['5.md', '4.md'])
  })

  it('returns an empty array for an empty or punctuation-only query', () => {
    expect(searchDocs([titleMatchChunk, bodyMatchChunk], '')).toEqual([])
    expect(searchDocs([titleMatchChunk, bodyMatchChunk], '?!')).toEqual([])
  })
})
