/**
 * Settings-card DnD regression: the drag session must be shared across rows.
 *
 * 0.1.16–0.1.19 shipped a complete DnD implementation that never worked:
 * `let source = ''` lived inside makeDraggableRow(), so dragstart wrote the
 * source row's closure while dragover/drop read the target row's closure
 * (always ''). The early return skipped preventDefault(), the browser refused
 * the drop, and no error surfaced. This file locks the shape of the fix.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const card = readFileSync(join(root, 'src/client/settings-card.ts'), 'utf8')
const fnStart = card.indexOf('function makeDraggableRow(')
const fn = card.slice(fnStart, card.indexOf('\n}', fnStart))

describe('settings-card drag session', () => {
  it('declares dragSource at module scope, outside the per-row closure', () => {
    assert.match(card, /^let dragSource = ''/m)
    assert.ok(fnStart > 0)
    assert.doesNotMatch(fn, /\blet\s+source\b/)
    assert.match(fn, /dragSource = label/)
  })
  it('target dragover reads the shared source and permits the drop', () => {
    assert.match(fn, /if \(dragSource === '' \|\| dragSource === label\) return/)
    assert.match(fn, /e\?\.preventDefault\?\.\(\)/)
  })
  it('sets text/plain on dragstart so browsers that need it fire drop', () => {
    assert.match(fn, /e\.dataTransfer\.setData\('text\/plain', label\)/)
  })
  it('drop / dragend clear the shared source so a stale drag cannot leak', () => {
    assert.match(fn, /const from = dragSource\s+dragSource = ''/)
    assert.match(fn, /dragend[\s\S]*dragSource = ''/)
  })
})
