/**
 * Settings-card keyboard reorder contract (0.1.21): ArrowUp/ArrowDown move a
 * row through the same reorderLabels + commit path as dragging, guard the
 * first/last boundary, and restore focus after paint() rebuilds the DOM.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const card = readFileSync(join(root, 'src/client/settings-card.ts'), 'utf8')
const constants = readFileSync(join(root, 'src/client/constants.ts'), 'utf8')
const fnStart = card.indexOf('function makeKeyboardRow(')
const fn = card.slice(fnStart, card.indexOf('\n}', fnStart))
const entry = card.slice(card.indexOf('function buildEntry('), card.indexOf('\n/** Paint', card.indexOf('function buildEntry(')))

describe('settings-card keyboard reorder', () => {
  it('is attached to every entry row alongside dragging', () => {
    assert.match(entry, /makeKeyboardRow\(makeDraggableRow\(built, entry\.label, rows\), entry\.label, rows\)/)
    assert.match(entry, /built\.setAttribute\(ATTR\.rowLabel, entry\.label\)/)
    assert.match(constants, /rowLabel: 'data-dshsf-row'/)
  })
  it('listens only for ArrowUp/ArrowDown and guards the boundary', () => {
    assert.match(fn, /e\?\.key !== 'ArrowUp' && e\?\.key !== 'ArrowDown'\) return/)
    assert.match(fn, /if \(to < 0 \|\| to >= labels\.length\) return/)
    assert.match(fn, /e\.preventDefault\(\)/)
  })
  it('reuses reorderLabels + the same applyConfig/paint/commit chain as dragging', () => {
    assert.match(fn, /const next = reorderLabels\(labels, label, labels\[to\]\)/)
    assert.match(fn, /applyConfig\(\{ \.\.\.effectiveConfig\(\), orderLabels: next \}\)/)
    assert.match(fn, /paint\(\)\s+commit\(\{ orderLabels: next \}\)/)
  })
  it('restores focus on the moved row after every paint, including commit()\'s async repaint', () => {
    assert.match(fn, /tabindex', '0'/)
    assert.match(fn, /pendingFocusLabel = label/)
    const paint = card.slice(card.indexOf('function paint('), card.indexOf('\n/** Point the card', card.indexOf('function paint(')))
    assert.match(paint, /requestAnimationFrame/)
    assert.match(paint, /querySelectorAll\(`\[\$\{ATTR\.rowLabel\}\]`\)/)
    // Focus follows the moved row, not the neighbour, so two presses move the
    // same row twice instead of swapping it back.
    assert.match(paint, /getAttribute\(ATTR\.rowLabel\) === focusLabel/)
    assert.match(paint, /\(target as HTMLElement \| undefined\)\?\.focus\(\)/)
    // The async save-confirmation paint in commit() must release the request.
    const commit = card.slice(card.indexOf('function commit('), card.indexOf('\n/** Write one field', card.indexOf('function commit(')))
    assert.match(commit, /paint\(\)\s+pendingFocusLabel = ''/)
  })
})
