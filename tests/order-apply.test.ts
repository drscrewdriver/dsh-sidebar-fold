/**
 * Ordering, applied: `applyOrder` reorders the column with CSS `order` on each
 * row's wrapper and never moves the host's nodes.
 *
 * Why this file exists: the 0.1.16 cut reordered by DOM moves and shipped a drag
 * that highlighted the drop target and changed nothing. On the 0.2.2 line every
 * row button lives in its own `div._panelEntry`, so `parent.insertBefore(row,
 * next)` is called with a reference node from another parent — the DOM throws
 * `NotFoundError`, the `try` swallowed it, and the order never moved. These tests
 * pin the replacement: ranks land on the wrapper, the "More" header keeps the
 * last rank, an empty list clears every rank, and no node is re-parented.
 *
 * Run: `npm test`.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyOrder, type RowLike } from '../src/client/fold.ts'

/** A row wrapper carrying the inline style `order` we write. */
interface EntryStub extends RowLike {
  style: { order: string }
  /** How many times this plugin re-parented anything through this node. */
  moves: number
  /** How many attribute writes this wrapper received. */
  writes: number
  insertBefore(reference: unknown): void
}

/** One `div._panelEntry`-shaped wrapper: an element whose children are never moved. */
function entry(): EntryStub {
  const attributes = new Map<string, string>()
  const stub: EntryStub = {
    style: { order: '' },
    moves: 0,
    writes: 0,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      stub.writes += 1
      attributes.set(name, value)
    },
    removeAttribute: (name: string) => void attributes.delete(name),
    addEventListener: () => {},
    textContent: '',
    isConnected: true,
    // The host's tree is not ours to rearrange; any call here would be a bug.
    insertBefore: () => { stub.moves += 1 },
  }
  return stub
}

/** A panel-row button: named, and wrapped in its own entry. */
function row(label: string, wrapper: EntryStub, haspopup?: string): RowLike {
  const attributes = new Map<string, string>([['aria-label', label]])
  if (haspopup !== undefined) attributes.set('aria-haspopup', haspopup)
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    addEventListener: () => {},
    textContent: '',
    isConnected: true,
    parentElement: wrapper,
    closest: () => wrapper as unknown as Element,
  }
}

/** The shipped shape: one wrapper per row, the More launcher last. */
function column(...labels: string[]): { rows: RowLike[]; entries: EntryStub[] } {
  const entries = labels.map(() => entry())
  const rows = labels.map((label, index) =>
    row(label, entries[index], index === labels.length - 1 ? 'menu' : undefined),
  )
  return { rows, entries }
}

/** Every rank as a plain `label -> order` table, for readable assertions. */
function ranks(labels: readonly string[], entries: readonly EntryStub[]): Record<string, string> {
  const out: Record<string, string> = {}
  labels.forEach((label, index) => { out[label] = entries[index].style.order })
  return out
}

describe('applyOrder', () => {
  it('ranks the wrappers in the stored order and keeps "More" last', () => {
    const { rows, entries } = column('插件', '自动化任务', '记忆星海', '更多')
    applyOrder(rows, ['记忆星海', '插件'])
    assert.deepEqual(ranks(['插件', '自动化任务', '记忆星海', '更多'], entries), {
      '插件': '2',
      '自动化任务': '3',
      '记忆星海': '1',
      '更多': '4',
    })
  })

  it('never re-parents a host node', () => {
    const { rows, entries } = column('插件', '自动化任务', '更多')
    applyOrder(rows, ['自动化任务', '插件'])
    assert.deepEqual(entries.map((item) => item.moves), [0, 0, 0])
  })

  it('is idempotent: a second pass writes nothing', () => {
    const { rows, entries } = column('插件', '自动化任务', '更多')
    applyOrder(rows, ['自动化任务', '插件'])
    const after = entries.map((item) => item.writes)
    applyOrder(rows, ['自动化任务', '插件'])
    assert.deepEqual(entries.map((item) => item.writes), after)
  })

  it('clears every rank when the stored order is empty', () => {
    const { rows, entries } = column('插件', '自动化任务', '更多')
    applyOrder(rows, ['自动化任务', '插件'])
    applyOrder(rows, [])
    assert.deepEqual(
      entries.map((item) => [item.style.order, item.getAttribute('data-dshsf-order')]),
      [['', null], ['', null], ['', null]],
    )
  })

  it('leaves a single-row column alone', () => {
    const { rows, entries } = column('更多')
    applyOrder(rows, ['更多'])
    assert.equal(entries[0].style.order, '')
  })
})
