/**
 * Pure-logic tests for the fold: header detection, group membership, the
 * nav-finding fallback chain, and alignment coercion.
 *
 * Run: `npm test` (node --test with type stripping; no DOM library involved —
 * the seams under test take plain objects).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canMoveToMore,
  findPanelNav,
  foldTarget,
  isFixedLabel,
  isHidden,
  isKept,
  normalizeAlign,
  pruneHidden,
  recordsTouchRows,
  splitRows,
  stateOf,
  type RowLike,
} from '../src/client/fold.ts'

/** A row stub carrying only what the fold reads. */
function row(label: string, options: { haspopup?: string; title?: string } = {}): RowLike {
  const attributes = new Map<string, string>()
  if (label !== '') attributes.set('aria-label', label)
  if (options.haspopup !== undefined) attributes.set('aria-haspopup', options.haspopup)
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    // Rows are never listened on by the pure seams; declared so the stub is a
    // truthful RowLike rather than a structurally-tolerated lie.
    addEventListener: () => {},
    textContent: options.title ?? '',
    isConnected: true,
  }
}

describe('isKept', () => {
  it('matches the keep list case- and whitespace-insensitively', () => {
    assert.equal(isKept(' 插件 ', ['插件', 'Plugins']), true)
    assert.equal(isKept('plugins', ['Plugins']), true)
    assert.equal(isKept('自动化任务', ['插件', 'Plugins']), false)
  })
  it('treats an unnamed row as kept (never fold what you cannot name)', () => {
    assert.equal(isKept('', []), true)
  })
})

describe('isHidden / stateOf', () => {
  it('never hides an unnamed row: the pin control is addressed by name', () => {
    assert.equal(isHidden('', ['插件']), false)
  })

  it('resolves the three states from the two lists', () => {
    assert.equal(stateOf('插件', ['插件'], []), 'always')
    assert.equal(stateOf('自动化任务', ['插件'], []), 'foldable')
    assert.equal(stateOf('插件市场', ['插件'], ['插件市场']), 'more')
  })

  it('lets the hide list win when a label sits in both', () => {
    assert.equal(stateOf('自动化任务', ['自动化任务'], ['自动化任务']), 'more')
  })
})

describe('fixed row / third-state capability', () => {
  it('recognises the host fixed panel in both shipped languages', () => {
    assert.equal(isFixedLabel('插件'), true)
    assert.equal(isFixedLabel(' plugins '), true)
    assert.equal(isFixedLabel('自动化任务'), false)
    assert.equal(isFixedLabel(''), false)
  })

  it('offers the third state only where the host can actually move the row', () => {
    assert.equal(canMoveToMore('自动化任务', true), true)
    assert.equal(canMoveToMore('自动化任务', false), false)
    assert.equal(canMoveToMore('插件', true), false)
  })

  it('drops the fixed row from a stale hide list', () => {
    assert.deepEqual(pruneHidden(['插件', '自动化任务', 'Plugins']), ['自动化任务'])
  })

  // The host never unpins its fixed row, so a config that lists it must read back
  // as “not hidden” instead of leaving the control pointing at a refused move.
  it('never reports the fixed row as hidden', () => {
    assert.equal(isHidden('插件', ['插件']), false)
    assert.equal(stateOf('插件', [], ['插件']), 'foldable')
  })
})

describe('recordsTouchRows', () => {
  const rowNode = { nodeType: 1, matches: (sel: string) => sel.includes('_panelRow'), querySelector: () => null }
  const wrapper = { nodeType: 1, matches: () => false, querySelector: () => ({}) }
  const textNode = { nodeType: 3 }

  it('ignores batches that cannot touch the sidebar', () => {
    assert.equal(recordsTouchRows([{ type: 'childList', addedNodes: [textNode] }]), false)
    assert.equal(recordsTouchRows([{ type: 'attributes' }]), false)
  })

  it('notices an added row and a wrapper that holds one', () => {
    assert.equal(recordsTouchRows([{ type: 'childList', addedNodes: [rowNode] }]), true)
    assert.equal(recordsTouchRows([{ type: 'childList', removedNodes: [wrapper] }]), true)
  })
})

describe('splitRows', () => {
  const plugins = row('插件')
  const schedules = row('自动化任务')
  const teams = row('agent团队')
  const more = row('更多', { haspopup: 'menu' })

  it('takes the haspopup row as the header, wherever it sits', () => {
    const split = splitRows([plugins, more, schedules, teams], ['插件'])
    assert.ok(split !== null)
    assert.equal(split.header, more)
    assert.deepEqual(split.group, [schedules, teams])
  })

  it('falls back to the last row when the host drops aria-haspopup', () => {
    const noPopup = [plugins, schedules, row('更多')]
    const split = splitRows(noPopup, ['插件'])
    assert.ok(split !== null)
    assert.equal(split.header, noPopup[2])
    assert.deepEqual(split.group, [schedules])
  })

  it('keeps listed labels visible and folds the rest', () => {
    const split = splitRows([plugins, schedules, teams, more], ['插件', 'agent团队'])
    assert.ok(split !== null)
    assert.deepEqual(split.group, [schedules])
  })

  it('refuses to mount a single-row nav', () => {
    assert.equal(splitRows([more], []), null)
    assert.equal(splitRows([], []), null)
  })

  it('returns an empty group when every sibling is kept', () => {
    const split = splitRows([plugins, more], ['插件'])
    assert.ok(split !== null)
    assert.deepEqual(split.group, [])
  })

  it('excludes rows that belong to the host "More" list', () => {
    const split = splitRows([plugins, schedules, teams, more], ['插件'], ['agent团队'])
    assert.ok(split !== null)
    assert.deepEqual(split.group, [schedules])
  })
})

describe('findPanelNav', () => {
  /** A nav stub whose only job is to answer the two queries the fallback makes. */
  function navStub(options: { ariaLabel?: string; fragment?: boolean; hasRow?: boolean }) {
    const rows = options.hasRow === true ? [row('插件')] : []
    return {
      querySelector: (selector: string) => {
        if (selector.startsWith('nav[aria-label=')) return null
        return rows[0] ?? null
      },
      querySelectorAll: () => rows,
      matches: (fragment: string) => options.fragment === true && fragment.includes('_panelList'),
      addEventListener: () => {},
    }
  }

  /** A document stub: `byLabel` is what `nav[aria-label="…"]` resolves to. */
  function docStub(byLabel: unknown, panelList: unknown = null, navs: unknown[] = []) {
    return {
      querySelector: (selector: string) => (selector.startsWith('nav[aria-label=') ? byLabel : null),
      querySelectorAll: (selector: string) => {
        if (selector.includes('_panelList')) return panelList === null ? [] : [panelList]
        if (selector === 'nav') return navs
        return []
      },
    }
  }

  it('prefers the semantic anchor (the nav’s own accessible name, zh then en)', () => {
    const zh = navStub({ ariaLabel: '全局面板', hasRow: true })
    assert.equal(findPanelNav(docStub(zh)), zh)
    const en = navStub({ ariaLabel: 'Global panels', hasRow: true })
    assert.equal(findPanelNav(docStub(en)), en)
  })

  it('falls back to the CSS-module fragment anchor', () => {
    const byFragment = navStub({ fragment: true, hasRow: true })
    assert.equal(findPanelNav(docStub(null, byFragment)), byFragment)
  })

  it('falls back to any nav that holds a panel row', () => {
    const loose = navStub({ hasRow: true })
    assert.equal(findPanelNav(docStub(null, null, [loose])), loose)
  })

  it('returns null instead of guessing at an unrelated nav', () => {
    assert.equal(findPanelNav(docStub(null, null, [])), null)
  })
})

describe('normalizeAlign', () => {
  it('passes through the three modes the stylesheet has rules for', () => {
    assert.equal(normalizeAlign('start'), 'start')
    assert.equal(normalizeAlign('center'), 'center')
    assert.equal(normalizeAlign('end'), 'end')
  })

  it('falls back to the shipped layout for anything else', () => {
    // The served value is an untyped string; an unknown mode must not leave the
    // nav carrying an attribute no rule matches.
    assert.equal(normalizeAlign('middle'), 'start')
    assert.equal(normalizeAlign(''), 'start')
    assert.equal(normalizeAlign(undefined), 'start')
    assert.equal(normalizeAlign(42), 'start')
  })
})

describe('foldTarget：折叠标记落在谁身上（issue #2）', () => {
  /**
   * A row stub that answers `closest('div[class*="_panelEntry"]')` the way the
   * host does from the 0.2.2 line on: the button's parent is the entry wrapper.
   * The wrapper is what `.panelList { display:flex; gap:2px }` counts as an item,
   * so hiding the button alone leaves an empty entry behind — that empty entry
   * was the reported ~10px gap (5 folded rows × 2px).
   */
  function wrappedRow(label: string) {
    const entry = row('')
    const button = row(label)
    // `closest` is typed as returning a real `Element`; the seam only ever calls
    // `getAttribute`/`setAttribute` on it, so a RowLike stub is the honest double.
    const stub = button as RowLike
    stub.closest = ((sel: string) => (sel.includes('_panelEntry') ? entry : null)) as unknown as (
      selector: string,
    ) => Element | null
    return { entry, button: stub }
  }

  it('marks the panelEntry wrapper when the host ships one', () => {
    const { entry, button } = wrappedRow('自动化任务')
    assert.equal(foldTarget(button), entry, '标记必须落在 div._panelEntry 上，而不是里面的 button')
  })

  it('falls back to the row itself on hosts without the wrapper', () => {
    const bare = row('自动化任务')
    assert.equal(foldTarget(bare), bare, '没有 panelEntry 的宿主上必须退回按钮本身')
  })

  it('survives a stub that has no closest at all', () => {
    // Older test doubles only implement the attribute faces; the seam must not throw.
    const bare = row('上下文洞察')
    assert.equal(foldTarget(bare), bare)
  })
})
