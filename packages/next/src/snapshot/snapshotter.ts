import { RefRegistry } from './registry'

export interface Snapshotter {
  capture(): string
  resolve(ref: string): Element | null
}

const LANDMARK_TAG_NAMES = new Set(['nav', 'main', 'aside', 'header', 'footer'])
const HEADING_TAG_NAMES = new Set(['h1', 'h2', 'h3'])
const INTERACTIVE_TAG_NAMES = new Set(['button', 'input', 'select', 'textarea', 'summary'])
const INTERACTIVE_ROLE_NAMES = new Set(['button', 'link', 'tab', 'menuitem'])
const ACCESSIBLE_LABEL_MAX_CHARS = 60
const TRUNCATION_MARKER_LINE = '…[truncated]'
const DEFAULT_BUDGET_CHARS = 8000

export function createSnapshotter(opts?: {
  root?: Element
  exclude?: (el: Element) => boolean
  budgetChars?: number
}): Snapshotter {
  // One registry per snapshotter: refs are assigned once per element and stay
  // stable across every capture() this snapshotter performs.
  const refRegistry = new RefRegistry()
  const budgetChars = opts?.budgetChars ?? DEFAULT_BUDGET_CHARS

  function capture(): string {
    const rootElement = opts?.root ?? document.body
    const outlineLines: string[] = []
    let usedChars = 0
    let budgetExceeded = false

    // Returns false (and flags truncation) when appending this line would exceed the budget.
    function tryAppendLine(line: string): boolean {
      const newlineCost = outlineLines.length > 0 ? 1 : 0
      if (usedChars + newlineCost + line.length > budgetChars) {
        budgetExceeded = true
        return false
      }
      outlineLines.push(line)
      usedChars += newlineCost + line.length
      return true
    }

    function walkElement(element: Element, indentDepth: number): void {
      if (budgetExceeded) return
      // Never serialize Glim's own UI, regardless of what root/exclude the caller passed.
      if (element.closest('[data-glim-root]') !== null) return
      if (opts?.exclude !== undefined && opts.exclude(element)) return
      if (isSubtreeHidden(element)) return

      const tagName = element.tagName.toLowerCase()
      const indent = '  '.repeat(indentDepth)

      if (LANDMARK_TAG_NAMES.has(tagName)) {
        if (!tryAppendLine(`${indent}[${tagName}]`)) return
        for (const childElement of Array.from(element.children)) {
          walkElement(childElement, indentDepth + 1)
        }
        return
      }

      if (HEADING_TAG_NAMES.has(tagName)) {
        const headingText = collapseWhitespace(element.textContent ?? '')
        if (headingText !== '') {
          tryAppendLine(`${indent}"${truncateLabel(headingText)}"`)
        }
        return
      }

      if (isInteractiveElement(element, tagName)) {
        const ref = refRegistry.getRef(element)
        const roleAttribute = element.getAttribute('role')
        const tagOrRole =
          roleAttribute !== null && INTERACTIVE_ROLE_NAMES.has(roleAttribute)
            ? roleAttribute
            : tagName
        const accessibleLabel = extractAccessibleLabel(element)
        const labelPart = accessibleLabel !== '' ? ` ${accessibleLabel}` : ''
        const offscreenSuffix = isOffscreen(element) ? ' (offscreen)' : ''
        tryAppendLine(`${indent}[${tagOrRole}#${ref}]${labelPart}${offscreenSuffix}`)
        return
      }

      // Non-landmark containers do not add indentation; only landmarks nest.
      for (const childElement of Array.from(element.children)) {
        walkElement(childElement, indentDepth)
      }
    }

    walkElement(rootElement, 0)

    if (budgetExceeded) {
      outlineLines.push(TRUNCATION_MARKER_LINE)
    }
    return outlineLines.join('\n')
  }

  function resolve(ref: string): Element | null {
    return refRegistry.resolve(ref)
  }

  return { capture, resolve }
}

function isSubtreeHidden(element: Element): boolean {
  if (element.getAttribute('aria-hidden') === 'true') return true
  if (element.hasAttribute('hidden')) return true
  // jsdom computes no layout, so only inline styles are trustworthy here.
  const inlineStyle = (element as HTMLElement).style as CSSStyleDeclaration | undefined
  if (inlineStyle !== undefined) {
    if (inlineStyle.display === 'none') return true
    if (inlineStyle.visibility === 'hidden') return true
  }
  return false
}

function isInteractiveElement(element: Element, tagName: string): boolean {
  if (INTERACTIVE_TAG_NAMES.has(tagName)) return true
  if (tagName === 'a' && element.hasAttribute('href')) return true
  const roleAttribute = element.getAttribute('role')
  if (roleAttribute !== null && INTERACTIVE_ROLE_NAMES.has(roleAttribute)) return true
  return false
}

function extractAccessibleLabel(element: Element): string {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel !== null && ariaLabel.trim() !== '') {
    return truncateLabel(ariaLabel.trim())
  }
  const visibleText = collapseWhitespace(element.textContent ?? '')
  if (visibleText !== '') {
    return truncateLabel(visibleText)
  }
  const placeholder = element.getAttribute('placeholder')
  if (placeholder !== null && placeholder.trim() !== '') {
    return truncateLabel(placeholder.trim())
  }
  const nameAttribute = element.getAttribute('name')
  if (nameAttribute !== null && nameAttribute.trim() !== '') {
    return truncateLabel(nameAttribute.trim())
  }
  return ''
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function truncateLabel(text: string): string {
  return text.length <= ACCESSIBLE_LABEL_MAX_CHARS
    ? text
    : text.slice(0, ACCESSIBLE_LABEL_MAX_CHARS)
}

function isOffscreen(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  // jsdom has no layout engine: every rect is all zeros, so treat those as on-screen.
  const rectHasSize = rect.width > 0 || rect.height > 0
  if (!rectHasSize) return false
  if (rect.bottom < 0 || rect.right < 0) return true
  if (rect.top > window.innerHeight || rect.left > window.innerWidth) return true
  return false
}
