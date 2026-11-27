/**
 * Ordering contract: the settings card writes orderLabels through the same
 * commit path, and both surfaces derive order through reorderLabels.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const card = readFileSync(join(root, 'src/client/settings-card.ts'), 'utf8')
const host = readFileSync(join(root, 'src/index.js'), 'utf8')

describe('settings-side order commit', () => {
  it('writes orderLabels via commit, not a bespoke path', () => {
    assert.match(card, /commit\(\{ orderLabels: next \}\)/)
    assert.match(card, /CARD_WRITES[^\n]*'orderLabels'/)
  })
  it('declares orderLabels as a live Config field', () => {
    assert.match(host, /DEFAULT_ORDER_LABELS/)
    assert.match(host, /orderLabels: live\(z\.array\(z\.string\(\)\)\.default/)
  })
  it('bridges sidebar-originated order changes through index.ts', () => {
    const index = readFileSync(join(root, 'src/client/index.ts'), 'utf8')
    assert.match(index, /subscribeOrder/)
    assert.match(index, /scope\.set\('orderLabels'/)
  })
});