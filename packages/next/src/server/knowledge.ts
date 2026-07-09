import * as fs from 'node:fs'
import * as path from 'node:path'

export interface DocChunk {
  path: string
  title: string
  text: string
}

/**
 * Loads every .md file under `dir` (recursively) and splits each file into
 * searchable chunks on '## ' headings. Content before the first '## ' heading
 * becomes one chunk titled by the file's '# ' heading (or the filename when the
 * file has no '# ' heading); that preamble chunk is skipped when it has no text.
 * Chunk paths are relative to `dir` and use '/' separators.
 */
export function loadKnowledge(dir: string): DocChunk[] {
  const markdownFilePaths = collectMarkdownFilePaths(dir)
  const chunks: DocChunk[] = []
  for (const markdownFilePath of markdownFilePaths) {
    const relativePath = path.relative(dir, markdownFilePath).split(path.sep).join('/')
    const fileContent = fs.readFileSync(markdownFilePath, 'utf8')
    chunks.push(...splitMarkdownIntoChunks(relativePath, fileContent))
  }
  return chunks
}

/**
 * Case-insensitive keyword search. Score per chunk = sum of query-term
 * frequencies in the chunk text, plus double weight for matches in the title.
 * Chunks with a zero score are dropped; results are sorted by score descending
 * and capped at `limit` (default 3). An empty query returns no results.
 */
export function searchDocs(chunks: DocChunk[], query: string, limit: number = 3): DocChunk[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) {
    return []
  }
  const scoredChunks = chunks.map((chunk) => {
    const titleTokens = tokenize(chunk.title)
    const textTokens = tokenize(chunk.text)
    let score = 0
    for (const queryTerm of queryTerms) {
      score += countOccurrences(textTokens, queryTerm) + 2 * countOccurrences(titleTokens, queryTerm)
    }
    return { chunk, score }
  })
  return scoredChunks
    .filter((scoredChunk) => scoredChunk.score > 0)
    .sort((firstScoredChunk, secondScoredChunk) => secondScoredChunk.score - firstScoredChunk.score)
    .slice(0, limit)
    .map((scoredChunk) => scoredChunk.chunk)
}

function tokenize(rawText: string): string[] {
  return rawText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
}

function countOccurrences(tokens: string[], term: string): number {
  let occurrenceCount = 0
  for (const token of tokens) {
    if (token === term) {
      occurrenceCount += 1
    }
  }
  return occurrenceCount
}

// Recursive directory walk. Entries are sorted by name at each level so the
// chunk order returned by loadKnowledge is deterministic across platforms.
function collectMarkdownFilePaths(dir: string): string[] {
  const markdownFilePaths: string[] = []
  const directoryEntries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((firstEntry, secondEntry) => firstEntry.name.localeCompare(secondEntry.name))
  for (const directoryEntry of directoryEntries) {
    const entryPath = path.join(dir, directoryEntry.name)
    if (directoryEntry.isDirectory()) {
      markdownFilePaths.push(...collectMarkdownFilePaths(entryPath))
    } else if (directoryEntry.isFile() && directoryEntry.name.endsWith('.md')) {
      markdownFilePaths.push(entryPath)
    }
  }
  return markdownFilePaths
}

function splitMarkdownIntoChunks(relativePath: string, fileContent: string): DocChunk[] {
  const fileName = relativePath.split('/').pop() ?? relativePath
  const lines = fileContent.split(/\r?\n/)
  const chunks: DocChunk[] = []

  let preambleTitleFromHeading: string | null = null
  const preambleLines: string[] = []
  let currentSectionTitle: string | null = null
  let currentSectionLines: string[] = []
  let hasSeenSectionHeading = false

  const flushPreambleChunk = () => {
    const preambleText = preambleLines.join('\n').trim()
    if (preambleText.length > 0) {
      chunks.push({
        path: relativePath,
        title: preambleTitleFromHeading ?? fileName,
        text: preambleText,
      })
    }
  }

  const flushSectionChunk = () => {
    if (currentSectionTitle !== null) {
      chunks.push({
        path: relativePath,
        title: currentSectionTitle,
        text: currentSectionLines.join('\n').trim(),
      })
    }
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (hasSeenSectionHeading) {
        flushSectionChunk()
      } else {
        flushPreambleChunk()
        hasSeenSectionHeading = true
      }
      currentSectionTitle = line.slice('## '.length).trim()
      currentSectionLines = []
    } else if (hasSeenSectionHeading) {
      currentSectionLines.push(line)
    } else if (preambleTitleFromHeading === null && line.startsWith('# ')) {
      // The first '# ' heading names the preamble chunk and is excluded from its text.
      preambleTitleFromHeading = line.slice('# '.length).trim()
    } else {
      preambleLines.push(line)
    }
  }

  if (hasSeenSectionHeading) {
    flushSectionChunk()
  } else {
    flushPreambleChunk()
  }

  return chunks
}
