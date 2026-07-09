import { beforeEach, describe, expect, it } from 'vitest'
import { createSnapshotter } from '../src/snapshot/snapshotter'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('outline format', () => {
  it('renders landmarks, headings, and interactive elements with two-space indentation under landmarks', () => {
    document.body.innerHTML = [
      '<main>',
      '<h1>Your listings</h1>',
      '<button>+ New listing</button>',
      '</main>',
    ].join('')
    const snapshotter = createSnapshotter()
    const outline = snapshotter.capture()
    expect(outline).toBe('[main]\n  "Your listings"\n  [button#e1] + New listing')
  })

  it('uses the role instead of the tag for role-based interactive elements', () => {
    document.body.innerHTML = '<div role="tab">Pricing</div>'
    const outline = createSnapshotter().capture()
    expect(outline).toBe('[tab#e1] Pricing')
  })

  it('includes anchors with href and skips anchors without href', () => {
    document.body.innerHTML = '<a href="/team">Team</a><a>No link</a>'
    const outline = createSnapshotter().capture()
    expect(outline).toContain('[a#e1] Team')
    expect(outline).not.toContain('No link')
  })
})

describe('visibility and exclusion', () => {
  it('skips subtrees hidden by inline style, aria-hidden, or the hidden attribute', () => {
    document.body.innerHTML = [
      '<div style="display:none"><button>Display none child</button></div>',
      '<div style="visibility:hidden"><button>Visibility hidden child</button></div>',
      '<div aria-hidden="true"><button>Aria hidden child</button></div>',
      '<div hidden><button>Hidden attr child</button></div>',
      '<button>Visible</button>',
    ].join('')
    const outline = createSnapshotter().capture()
    expect(outline).toBe('[button#e1] Visible')
  })

  it('always excludes [data-glim-root] subtrees', () => {
    document.body.innerHTML = [
      '<div data-glim-root><button>Glim launcher</button></div>',
      '<button>Host button</button>',
    ].join('')
    const outline = createSnapshotter().capture()
    expect(outline).toBe('[button#e1] Host button')
  })

  it('honors opts.exclude in addition to the built-in exclusions', () => {
    document.body.innerHTML = [
      '<div class="secret"><button>Secret button</button></div>',
      '<button>Public button</button>',
    ].join('')
    const snapshotter = createSnapshotter({
      exclude: (element) => element.classList.contains('secret'),
    })
    expect(snapshotter.capture()).toBe('[button#e1] Public button')
  })
})

describe('accessible labels', () => {
  it('prefers aria-label over text content', () => {
    document.body.innerHTML = '<button aria-label="Close dialog">X</button>'
    expect(createSnapshotter().capture()).toBe('[button#e1] Close dialog')
  })

  it('falls back to placeholder, then name attribute, for elements with no text', () => {
    document.body.innerHTML = '<input placeholder="Search listings"><input name="email">'
    const outline = createSnapshotter().capture()
    expect(outline).toBe('[input#e1] Search listings\n[input#e2] email')
  })

  it('truncates labels to 60 characters', () => {
    const eightyCharacterLabel = 'A'.repeat(80)
    document.body.innerHTML = `<button>${eightyCharacterLabel}</button>`
    const outline = createSnapshotter().capture()
    expect(outline).toBe(`[button#e1] ${'A'.repeat(60)}`)
  })
})

describe('ref stability across captures', () => {
  it('keeps the same ref for a surviving element after a sibling re-renders', () => {
    document.body.innerHTML =
      '<button id="keep">Keep me</button><button id="swap">Swap me</button>'
    const snapshotter = createSnapshotter()
    const firstOutline = snapshotter.capture()
    expect(firstOutline).toContain('[button#e1] Keep me')
    expect(firstOutline).toContain('[button#e2] Swap me')

    // Re-render the sibling the way a framework would: replace it with a fresh node.
    const oldSwapButton = document.getElementById('swap')!
    const newSwapButton = document.createElement('button')
    newSwapButton.id = 'swap'
    newSwapButton.textContent = 'Swap me v2'
    oldSwapButton.replaceWith(newSwapButton)

    const secondOutline = snapshotter.capture()
    expect(secondOutline).toContain('[button#e1] Keep me')
    expect(secondOutline).toContain('[button#e3] Swap me v2')
  })
})

describe('resolve', () => {
  it('returns the live element for a captured ref', () => {
    document.body.innerHTML = '<button>Publish</button>'
    const snapshotter = createSnapshotter()
    snapshotter.capture()
    expect(snapshotter.resolve('e1')).toBe(document.querySelector('button'))
  })

  it('returns null for a ref that was never assigned', () => {
    document.body.innerHTML = '<button>Publish</button>'
    const snapshotter = createSnapshotter()
    snapshotter.capture()
    expect(snapshotter.resolve('e42')).toBeNull()
  })
})

describe('offscreen suffix', () => {
  function fakeRect(top: number, left: number, width: number, height: number): DOMRect {
    return {
      x: left,
      y: top,
      top,
      left,
      bottom: top + height,
      right: left + width,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect
  }

  it('marks interactive elements with nonzero rects outside the viewport as offscreen', () => {
    document.body.innerHTML =
      '<button id="below">Below fold</button><button id="visible">On screen</button>'
    // jsdom viewport defaults: innerWidth 1024, innerHeight 768.
    document.getElementById('below')!.getBoundingClientRect = () => fakeRect(2000, 0, 120, 32)
    document.getElementById('visible')!.getBoundingClientRect = () => fakeRect(100, 0, 120, 32)
    const outline = createSnapshotter().capture()
    expect(outline).toContain('[button#e1] Below fold (offscreen)')
    expect(outline).toContain('[button#e2] On screen')
    expect(outline).not.toContain('On screen (offscreen)')
  })

  it('treats all-zero rects (jsdom has no layout) as on-screen', () => {
    document.body.innerHTML = '<button>Zero rect</button>'
    expect(createSnapshotter().capture()).toBe('[button#e1] Zero rect')
  })
})

describe('budget', () => {
  it('stops emitting and appends the truncation marker when budgetChars is exceeded', () => {
    document.body.innerHTML = Array.from(
      { length: 20 },
      (_, index) => `<button>Button number ${index}</button>`,
    ).join('')
    const snapshotter = createSnapshotter({ budgetChars: 100 })
    const outline = snapshotter.capture()
    const outlineLines = outline.split('\n')
    expect(outlineLines[outlineLines.length - 1]).toBe('…[truncated]')
    // Everything before the marker fits inside the budget.
    const bodyBeforeMarker = outlineLines.slice(0, -1).join('\n')
    expect(bodyBeforeMarker.length).toBeLessThanOrEqual(100)
  })

  it('does not truncate when the outline fits the budget', () => {
    document.body.innerHTML = '<button>Ok</button>'
    const outline = createSnapshotter({ budgetChars: 8000 }).capture()
    expect(outline).not.toContain('…[truncated]')
  })
})
