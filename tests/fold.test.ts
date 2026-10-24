/**
 * Pure-logic tests for the fold: header detection, group membership, the
 * nav-finding fallback chain, and alignment coercion.
 *
 * Run: `npm test` (node --test with type stripping; no DOM library involved —
 * the seams under test take plain objects).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findPanelNav, isKept, normalizeAlign, splitRows, type RowLike } from '../src/client/fold.ts'

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
