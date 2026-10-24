/**
 * The configuration card on this bundle's Plugin-Manager page.
 *
 * Seat: `plugins.bundle.config` (kind `keyed`, key = the bundle's package name) —
 * verified present in rc.3 (`dsh-cordis-client-runner` slot-catalog, rendered at
 * `dsh-client-ui-plugin-manager/lib/client.js:2964`).
 *
 * Two design points earned from the first smoke runs:
 *  - the slot renderer is React, so the component must return a **React element**
 *    (a bare DOM node made React throw and the host dropped the entry into
 *    `data-slot-error`); the element is a thin wrapper whose ref mounts the
 *    plain-DOM card body;
 *  - the fold scope is **read from the live sidebar**, not typed by the user: the
 *    card lists the panel rows that exist right now and gives each one a switch.
 *    Free-text labels were the wrong shape — they let a stale list silently
 *    exempt every row, which reads to the user as "the button does nothing".
 *
 * `react` is served by the host's module table (not a `@deepseek-ai/dsh-*`
 * package, which stays off-limits), so the factory's own `require` is the way in.
 */
import { ATTR, CLS, type AlignMode } from './constants.ts'
import { pickDictionary } from './locales.ts'
import { normalizeAlign, roster, subscribeRoster } from './fold.ts'

/** The module-loader factory's `require`, injected by the host's module table. */
declare const require: (id: string) => any
const react: any = require('react')

/** One settings snapshot as the host's scoped form reports it. */
export interface ConfigSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: { defaultFolded?: boolean; keepLabels?: string[]; align?: string } | undefined
  revision: number | undefined
  writable: boolean
}

/** The scoped-form surface this card consumes (mirrors `dsh-session-guard` §scope-face). */
export interface SettingsScopeLike {
  getSnapshot(): ConfigSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
}

/** The card's live data source, filled by `index.ts` whichever settings waist lands. */
const scopeRef: { scope: SettingsScopeLike | undefined } = { scope: undefined }

/** Fallback shown when no host form is served (≤0.1.6, or an unserved namespace). */
let fallback: { defaultFolded: boolean; keepLabels: string[]; align: AlignMode } = {
  defaultFolded: false,
  keepLabels: ['插件', 'Plugins'],
  align: 'start',
}

/** The card body node, created once and re-used by every mount. */
let cardRoot: HTMLElement | null = null

/** Create the card body once, and hand the same node back on every mount. */
function ensureCardRoot(): HTMLElement {
  if (cardRoot === null) {
    cardRoot = document.createElement('div')
    cardRoot.className = CLS.card
    cardRoot.setAttribute(ATTR.own, '')
  }
  return cardRoot
}

/** Read the effective values: live form first, built-in fallback second. */
function currentValues(): {
  defaultFolded: boolean
  keepLabels: string[]
  align: AlignMode
  writable: boolean
  status: ConfigSnapshot['status']
} {
  const scope = scopeRef.scope
  if (scope !== undefined) {
    const snap = scope.getSnapshot()
    return {
      defaultFolded: snap.value?.defaultFolded ?? fallback.defaultFolded,
      keepLabels: snap.value?.keepLabels ?? fallback.keepLabels,
      align: normalizeAlign(snap.value?.align ?? fallback.align),
      writable: snap.writable && snap.status === 'ready',
      status: snap.status,
    }
  }
  return {
    defaultFolded: fallback.defaultFolded,
    keepLabels: fallback.keepLabels,
    align: normalizeAlign(fallback.align),
    writable: false,
    status: 'unavailable',
  }
}

/** One labelled row: text block on the left, control on the right. */
function buildRow(label: string, hint: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div')
  row.className = CLS.row
  row.setAttribute(ATTR.own, '')
  const main = document.createElement('div')
  main.className = CLS.rowMain
  const title = document.createElement('span')
  title.className = CLS.label
  title.textContent = label
  const note = document.createElement('span')
  note.className = CLS.hint
  note.textContent = hint
  main.append(title, note)
  row.append(main, control)
  return row
}

/**
 * A pill switch bound to one field.
 *
 * A real `<button role="switch">` (not a checkbox): the card is a settings
 * surface, and this plugin family renders on/off rows as capsule switches. The
 * `aria-checked` attribute is also the paint hook (track colour + knob travel).
 */
function switchControl(
  field: string,
  checked: boolean,
  disabled: boolean,
  onChange: (next: boolean) => void,
): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = CLS.switch
  button.setAttribute('role', 'switch')
  button.setAttribute('aria-checked', String(checked))
  button.dataset.field = field
  button.disabled = disabled
  const knob = document.createElement('span')
  knob.className = CLS.switchKnob
  button.appendChild(knob)
  button.addEventListener('click', () => {
    if (button.disabled) return
    const next = button.getAttribute('aria-checked') !== 'true'
    button.setAttribute('aria-checked', String(next))
    onChange(next)
  })
  return button
}

/** Write one field through the host's scoped form (the host owns conflicts). */
function write(field: string, value: unknown): void {
  const scope = scopeRef.scope
  if (scope === undefined) return
  void scope.set(field, value)
}

/**
 * A segmented control for a small closed set of options.
 *
 * Row alignment is one of three mutually exclusive choices, which reads better as
 * a single track than as three independent switches. The host's own UI primitives
 * package is off-limits to plugins, so the track is drawn with this plugin's own
 * classes over host theme tokens.
 */
function segmentedControl(
  field: string,
  value: string,
  options: readonly { value: string; label: string }[],
  disabled: boolean,
  onChange: (next: string) => void,
): HTMLElement {
  const group = document.createElement('div')
  group.className = CLS.segmentGroup
  group.setAttribute('role', 'radiogroup')
  group.dataset.field = field
  for (const option of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = CLS.segment
    button.setAttribute('role', 'radio')
    button.setAttribute('aria-checked', String(option.value === value))
    button.dataset.option = option.value
    button.textContent = option.label
    button.disabled = disabled
    button.addEventListener('click', () => {
      if (button.disabled) return
      // Move the mark locally so the click feels immediate; the host echoes a
      // snapshot and the whole card repaints anyway.
      for (const sibling of Array.from(group.children)) {
        sibling.setAttribute('aria-checked', String(sibling === button))
      }
      onChange(option.value)
    })
    group.appendChild(button)
  }
  return group
}

/**
 * Persist the keep list produced by the per-row switches.
 *
 * The stored list is exactly "labels currently switched on" — the switch state is
 * the source of truth, so a row that disappears from the sidebar drops out and a
 * row that appears starts folded.
 */
function writeKeep(nextLabels: readonly string[]): void {
  write('keepLabels', [...nextLabels])
}

/** Paint (or repaint) the card body from the current values and the live roster. */
function paint(): void {
  if (cardRoot === null) return
  const dict = pickDictionary(document.documentElement.lang ?? '')
  const values = currentValues()
  const rows = roster()
  cardRoot.replaceChildren()

  // ① default state
  cardRoot.appendChild(
    buildRow(
      dict['settings.defaultFolded'],
      dict['settings.defaultFoldedHint'],
      switchControl('defaultFolded', values.defaultFolded, !values.writable, (next) => {
        write('defaultFolded', next)
      }),
    ),
  )

  // ② row-content alignment: left / centred / right for the icon + label pair
  cardRoot.appendChild(
    buildRow(
      dict['settings.align'],
      dict['settings.alignHint'],
      segmentedControl(
        'align',
        values.align,
        [
          { value: 'start', label: dict['settings.alignStart'] },
          { value: 'center', label: dict['settings.alignCenter'] },
          { value: 'end', label: dict['settings.alignEnd'] },
        ],
        !values.writable,
        (next) => {
          write('align', normalizeAlign(next))
        },
      ),
    ),
  )

  // ③ fold scope: one switch per row that exists in this profile right now
  const scopeTitle = document.createElement('div')
  scopeTitle.className = CLS.label
  scopeTitle.setAttribute(ATTR.own, '')
  scopeTitle.textContent = dict['settings.keep']
  cardRoot.appendChild(scopeTitle)

  const hint = document.createElement('span')
  hint.className = CLS.hint
  hint.setAttribute(ATTR.own, '')
  hint.textContent = dict['settings.keepHint']
  cardRoot.appendChild(hint)

  if (rows.length === 0) {
    const empty = document.createElement('span')
    empty.className = CLS.hint
    empty.setAttribute(ATTR.own, '')
    empty.textContent = dict['settings.keepEmpty']
    cardRoot.appendChild(empty)
  }

  for (const entry of rows) {
    cardRoot.appendChild(
      buildRow(
        entry.label,
        dict['settings.keepRowHint'],
        switchControl(`keep:${entry.label}`, entry.keep, !values.writable, (next) => {
          // The switch state IS the stored list: switched-on rows are the kept ones.
          const enabled = rows
            .filter((row) => (row.label === entry.label ? next : row.keep))
            .map((row) => row.label)
          writeKeep(enabled)
        }),
      ),
    )
  }

  if (!values.writable) {
    const note = document.createElement('span')
    note.className = CLS.hint
    note.setAttribute(ATTR.own, '')
    note.textContent = dict['settings.readonly']
    cardRoot.appendChild(note)
  }
}

/**
 * Point the card at a settings scope (called by `index.ts` when a waist resolves).
 * @param scope - the scoped form for this bundle's namespace.
 */
export function onScope(scope: SettingsScopeLike): void {
  scopeRef.scope = scope
  scope.subscribe(() => {
    paint()
  })
  paint()
}

/** Adopt the built-in fallback (used when no writable surface exists). */
export function onFallback(next: typeof fallback): void {
  fallback = { defaultFolded: next.defaultFolded, keepLabels: [...next.keepLabels], align: normalizeAlign(next.align) }
  paint()
}

/**
 * Build the card component for `ctx.slots.register`.
 *
 * The slot's owner props (`{ view, form }`) are ignored on purpose: the host's own
 * form object is not a stable write path for a plugin, while our scoped form is —
 * the same reasoning `dsh-session-guard` records for its family card.
 * @returns a React component the slot can render.
 */
export function createConfigCard(): () => unknown {
  // Repaint whenever the sidebar's row inventory changes, so the switch list
  // follows installs/removals without a reload. Subscribed once, at factory time.
  subscribeRoster(() => {
    paint()
  })
  return function SidebarFoldCard() {
    return react.createElement('div', {
      className: CLS.cardHost,
      ref: (node: HTMLElement | null) => {
        if (node === null) return
        const card = ensureCardRoot()
        if (node.firstChild !== card) node.append(card)
        paint()
      },
    })
  }
}

/** Exported for the guard test: the card writes no free-text label list. */
export const CARD_WRITES: readonly string[] = ['defaultFolded', 'align', 'keepLabels']
