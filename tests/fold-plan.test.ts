/**
 * Tests for the decision layer: `planFold`, `rosterFrom`, `deriveLists`.
 *
 * These three were extracted out of the DOM renderers precisely so the branchy
 * part (idle vs active, rail suppression, the three row states) is testable
 * without a browser. The renderer that consumes the plan is a straight
 * attribute-writing loop and is covered by the browser smoke runs instead.
 *
 * Run: `npm test`.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deriveLists, planFold, rosterFrom, type RowLike } from '../src/client/fold.ts'

/** A panel-row stub carrying only what the pure seams read. */
function row(label: string, options: { haspopup?: string } = {}): RowLike {
  const attributes = new Map<string, string>()
  if (label !== '') attributes.set('aria-label', label)
  if (options.haspopup !== undefined) attributes.set('aria-haspopup', options.haspopup)
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    addEventListener: () => {},
    textContent: '',
    isConnected: true,
  }
}

/** The shipped shape: two add-on rows followed by the More launcher. */
function rows(...labels: string[]): RowLike[] {
  return labels.map((label, index, all) =>
    row(label, index === all.length - 1 ? { haspopup: 'menu' } : {}),
  )
}

describe('planFold', () => {
  it('folds the group when the window asked for it and there is no rail', () => {
    const list = rows('插件', '自动化任务', '更多')
    const plan = planFold(list, ['插件'], [], true, false)
    assert.ok(plan !== null)
    assert.equal(plan.idle, false)
    assert.equal(plan.active, true)
    assert.equal(plan.state, 'folded')
    assert.equal(plan.toggleVisible, true)
    assert.deepEqual(
      plan.folded.map((entry) => entry.getAttribute('aria-label')),
      ['自动化任务'],
    )
  })

  it('only marks rows; the header is never part of the group', () => {
    const list = rows('插件', '自动化任务', '更多')
    const plan = planFold(list, [], [], true, false)
    assert.ok(plan !== null)
    assert.equal(plan.header.getAttribute('aria-label'), '更多')
    assert.equal(plan.group.length, 2)
  })

  it('stays expanded when the window did not ask to fold', () => {
    const list = rows('插件', '自动化任务', '更多')
    const plan = planFold(list, ['插件'], [], false, false)
    assert.ok(plan !== null)
    assert.equal(plan.active, false)
    assert.equal(plan.state, null)
    assert.deepEqual(plan.folded, [])
  })

  // The rail case is the one that used to leave a half-hidden sidebar: a 36px
  // column cannot host a second 28px square, so the plan must suppress both the
  // fold and the control itself.
  it('suppresses fold and control in the 36px rail', () => {
    const list = rows('插件', '自动化任务', '更多')
    const plan = planFold(list, ['插件'], [], true, true)
    assert.ok(plan !== null)
    assert.equal(plan.active, false)
    assert.equal(plan.state, null)
    assert.deepEqual(plan.folded, [])
    assert.equal(plan.toggleVisible, false)
  })

  // "Arrow flips but nothing collapses" was a shipped bug caused by a stale keep
  // list: every sibling was whitelisted, so the plan must report idle and refuse
  // to mark the nav as folded.
  it('reports idle instead of pretending to fold when every sibling is kept', () => {
    const list = rows('插件', '自动化任务', '更多')
    const plan = planFold(list, ['插件', '自动化任务'], [], true, false)
    assert.ok(plan !== null)
    assert.equal(plan.idle, true)
    assert.equal(plan.active, false)
    assert.equal(plan.state, null)
    assert.deepEqual(plan.folded, [])
    assert.equal(plan.toggleVisible, true)
  })

  // A row on its way into the host's "More" list is the host's to hide, not the
  // fold's: counting it would flip the arrow over a row nobody can see.
  it('leaves rows bound for the host "More" list out of the group', () => {
    const list = rows('插件', '自动化任务', 'agent团队', '更多')
    const plan = planFold(list, ['插件'], ['agent团队'], true, false)
    assert.ok(plan !== null)
    assert.equal(plan.idle, false)
    assert.deepEqual(
      plan.folded.map((entry) => entry.getAttribute('aria-label')),
      ['自动化任务'],
    )
  })

  it('reports idle when the only foldable row left is bound for "More"', () => {
    const list = rows('插件', 'agent团队', '更多')
    const plan = planFold(list, ['插件'], ['agent团队'], true, false)
    assert.ok(plan !== null)
    assert.equal(plan.idle, true)
    assert.equal(plan.active, false)
  })

  it('returns null when the nav has fewer than two rows', () => {
    assert.equal(planFold(rows('更多'), ['插件'], [], true, false), null)
    assert.equal(planFold([], [], [], true, false), null)
  })
})

describe('rosterFrom', () => {
  it('lists every sibling of the header with its three-state setting', () => {
    const list = rows('插件', '自动化任务', '更多')
    assert.deepEqual(rosterFrom(list, ['插件'], []), [
      { label: '插件', state: 'always' },
      { label: '自动化任务', state: 'foldable' },
    ])
  })

  it('marks a hidden row as living in the host "More" list', () => {
    const list = rows('插件', '自动化任务', '更多')
    assert.deepEqual(rosterFrom(list, [], ['自动化任务']), [
      { label: '插件', state: 'foldable' },
      { label: '自动化任务', state: 'more' },
    ])
  })

  it('drops unnamed rows instead of rendering an empty control', () => {
    const list = rows('', '自动化任务', '更多')
    assert.deepEqual(rosterFrom(list, [], []), [{ label: '自动化任务', state: 'foldable' }])
  })
})

describe('deriveLists', () => {
  const roster = [
    { label: '插件', state: 'always' as const },
    { label: '自动化任务', state: 'foldable' as const },
    { label: '插件市场', state: 'foldable' as const },
  ]

  it('moves a row into the keep list when it is set to always', () => {
    assert.deepEqual(deriveLists(roster, '自动化任务', 'always'), {
      keepLabels: ['插件', '自动化任务'],
      hideLabels: [],
    })
  })

  it('drops a row out of both lists when it is set to foldable', () => {
    assert.deepEqual(deriveLists(roster, '插件', 'foldable'), { keepLabels: [], hideLabels: [] })
  })

  it('moves a row into the hide list without leaving it in keep', () => {
    assert.deepEqual(deriveLists(roster, '插件', 'more'), {
      keepLabels: [],
      hideLabels: ['插件'],
    })
  })

  it('leaves both lists alone for a label that is not in the roster', () => {
    assert.deepEqual(deriveLists(roster, '不存在的行', 'more'), { keepLabels: ['插件'], hideLabels: [] })
  })
})
