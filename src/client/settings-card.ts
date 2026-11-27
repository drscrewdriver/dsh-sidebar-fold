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
import { mountStarRow } from './star-row-copy.ts'
import {
  applyConfig,
  canMoveToMore,
  deriveLists,
  effectiveConfig,
  hostHasPin,
  isFixedLabel,
  normalizeAlign,
  reorderLabels,
  roster,
  subscribeRoster,
  type RowState,
} from './fold.ts'

/** The module-loader factory's `require`, injected by the host's module table. */
declare const require: (id: string) => any
const react: any = require('react')

/** One settings snapshot as the host's scoped form reports it. */
export interface ConfigSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: { defaultFolded?: boolean; keepLabels?: string[]; hideLabels?: string[]; align?: string; orderLabels?: string[] } | undefined
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
let fallback: { defaultFolded: boolean; keepLabels: string[]; hideLabels: string[]; align: AlignMode; orderLabels: string[] } = {
  defaultFolded: false,
  keepLabels: ['插件', 'Plugins'],
  hideLabels: [],
  align: 'start',
  orderLabels: [],
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
  hideLabels: string[]
  align: AlignMode
  orderLabels: string[]
  writable: boolean
  status: ConfigSnapshot['status']
} {
  const scope = scopeRef.scope
  if (scope !== undefined) {
    const snap = scope.getSnapshot()
    return {
      defaultFolded: snap.value?.defaultFolded ?? fallback.defaultFolded,
      keepLabels: snap.value?.keepLabels ?? fallback.keepLabels,
      hideLabels: snap.value?.hideLabels ?? fallback.hideLabels,
      align: normalizeAlign(snap.value?.align ?? fallback.align),
      orderLabels: Array.isArray(snap.value?.orderLabels) ? snap.value.orderLabels : fallback.orderLabels,
      writable: snap.writable && snap.status === 'ready',
      status: snap.status,
    }
  }
  return {
    defaultFolded: fallback.defaultFolded,
    keepLabels: fallback.keepLabels,
    hideLabels: fallback.hideLabels,
    align: normalizeAlign(fallback.align),
    orderLabels: fallback.orderLabels,
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

/** What the last write did, so the card can say it instead of failing silently. */
let saveState: { status: 'idle' | 'saving' | 'saved' | 'error'; fields: Record<string, unknown> } = {
  status: 'idle',
  fields: {},
}
/** How long a host write may stay unconfirmed before the card reads the store. */
const SAVE_CONFIRM_MS = 1200

/** Deep-equality over JSON values — enough for the strings and string arrays here. */
function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

/**
 * Write fields through the host's scoped form and report the outcome.
 *
 * Two lies this replaces: the first build dropped `set()`'s promise entirely, and
 * the second believed it. On the 0.2.2 line the write is persisted but the
 * promise **never settles** (measured: still pending after 6s), so the confirm is
 * bounded by {@link SAVE_CONFIRM_MS} and then settled against the served
 * snapshot — the host's own store is the only thing that can say “stored”.
 */
function commit(fields: Record<string, unknown>): void {
  const scope = scopeRef.scope
  if (scope === undefined) return
  saveState = { status: 'saving', fields }
  paint()
  const writes = Object.entries(fields).map(([field, value]) =>
    Promise.resolve(scope.set(field, value)).then((ok) => ok === true).catch(() => false),
  )
  const confirmed = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      let value: Record<string, unknown> | undefined
      try {
        value = scope.getSnapshot().value as Record<string, unknown> | undefined
      } catch {
        value = undefined
      }
      resolve(Object.entries(fields).every(([field, expected]) => sameValue(value?.[field], expected)))
    }, SAVE_CONFIRM_MS)
  })
  void Promise.race([Promise.all(writes).then((results) => results.every(Boolean)), confirmed]).then((ok) => {
    saveState = { status: ok ? 'saved' : 'error', fields }
    paint()
  })
}

/** Write one field (the single-value controls go through here). */
function write(field: string, value: unknown): void {
  commit({ [field]: value })
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
  options: readonly { value: string; label: string; unavailable?: boolean }[],
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
    // One option can be absent from this host (a 0.2.1 sidebar has no pin
    // control); disabling just that segment keeps the other two usable.
    button.disabled = disabled || option.unavailable === true
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
 * Persist one row's moved control.
 *
 * Two lists, one source of truth: `always` rows are written to `keepLabels` and
 * `more` rows to `hideLabels`, so the control state never has to be inferred
 * from a stale list.
 *
 * The write is also adopted **locally**: the host persists the value but does not
 * echo a new snapshot within seconds (measured on 0.2.2-rc.3 while moving a row
 * into “More”), and a control whose click visibly does nothing reads as broken.
 */
function writeRowState(rows: ReturnType<typeof roster>, label: string, next: RowState): void {
  const lists = deriveLists(rows, label, next)
  applyConfig({ ...effectiveConfig(), keepLabels: lists.keepLabels, hideLabels: lists.hideLabels })
  paint()
  commit({ keepLabels: lists.keepLabels, hideLabels: lists.hideLabels })
}

/**
 * The drag session is shared by all rows: HTML5 DnD fires `dragstart` on the
 * source row but `dragover`/`drop` on the *target* row, so a per-row closure
 * would always read the target's own (empty) source and never call
 * `preventDefault()` — the browser then refuses the drop and dragging is dead.
 */
let dragSource = ''

/**
 * Attach a drag handle to a settings row so the visible list can be reordered.
 *
 * The row itself is the drag source and drop target; both surfaces (sidebar and
 * card) compute the next order via reorderLabels and commit through commit().
 *
 * The drop commits in one direction only — the sidebar is the ordering
 * authority: `applyConfig` ranks the live rows, `paint()` re-reads the roster
 * (which now reports the new order), and only then does the write go out. The
 * first cut rebuilt the list by appending fresh rows to the card root, which
 * left the originals in place (a duplicated list that read as "nothing changed").
 */
function makeDraggableRow(row: HTMLElement, label: string, rows: ReturnType<typeof roster>): HTMLElement {
  row.setAttribute('draggable', 'true')
  // A grab cursor, not the drag *feedback* class: dimming the row permanently
  // made every settings row look disabled.
  row.classList.add(CLS.rowHandle)
  row.addEventListener('dragstart', (e: any) => {
    dragSource = label
    row.classList.add(CLS.rowDrag)
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', label) // Safari/some hosts need this to fire drop
    }
  })
  row.addEventListener('dragover', (e: any) => {
    if (dragSource === '' || dragSource === label) return
    e?.preventDefault?.()
    if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move'
    row.classList.add(CLS.rowDragOver)
  })
  row.addEventListener('dragleave', () => row.classList.remove(CLS.rowDragOver))
  row.addEventListener('drop', (e: any) => {
    e?.preventDefault?.()
    row.classList.remove(CLS.rowDragOver)
    const from = dragSource
    dragSource = ''
    if (from === '' || from === label) return
    const next = reorderLabels(rows.map((entry) => entry.label), from, label)
    applyConfig({ ...effectiveConfig(), orderLabels: next })
    paint()
    commit({ orderLabels: next })
  })
  row.addEventListener('dragend', () => {
    dragSource = ''
    row.classList.remove(CLS.rowDrag)
    row.classList.remove(CLS.rowDragOver)
  })
  return row
}

/** Build one three-state entry row (shared by paint and the DnD repaint). */
function buildEntry(entry: ReturnType<typeof roster>[number], rows: ReturnType<typeof roster>): HTMLElement {
  const canHide = hostHasPin()
  const movable = canMoveToMore(entry.label, canHide)
  const hintText = movable
    ? pickDictionary(document.documentElement.lang ?? '')['settings.rowHint']
    : isFixedLabel(entry.label)
      ? pickDictionary(document.documentElement.lang ?? '')['settings.moreFixed']
      : pickDictionary(document.documentElement.lang ?? '')['settings.moreUnavailable']
  const dict = pickDictionary(document.documentElement.lang ?? '')
  const built = buildRow(
    entry.label,
    hintText,
    segmentedControl(
      `row:${entry.label}`,
      entry.state,
      [
        { value: 'always', label: dict['settings.rowAlways'] },
        { value: 'foldable', label: dict['settings.rowFold'] },
        { value: 'more', label: dict['settings.rowMore'], unavailable: !movable },
      ],
      !currentValues().writable,
      (next) => writeRowState(rows, entry.label, next as RowState),
    ),
  )
  return makeDraggableRow(built, entry.label, rows)
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

  // ③ fold scope: one three-state control per row that exists in this profile
  const scopeTitle = document.createElement('div')
  scopeTitle.className = CLS.label
  scopeTitle.setAttribute(ATTR.own, '')
  scopeTitle.textContent = dict['settings.rows']
  cardRoot.appendChild(scopeTitle)

  const dragHint = document.createElement('span')
  dragHint.className = CLS.hint
  dragHint.setAttribute(ATTR.own, '')
  dragHint.textContent = dict['settings.rowDrag'] + ' — ' + dict['settings.rowDragHint']
  cardRoot.appendChild(dragHint)

  const hint = document.createElement('span')
  hint.className = CLS.hint
  hint.setAttribute(ATTR.own, '')
  hint.textContent = dict['settings.rowsHint']
  cardRoot.appendChild(hint)

  if (rows.length === 0) {
    const empty = document.createElement('span')
    empty.className = CLS.hint
    empty.setAttribute(ATTR.own, '')
    empty.textContent = dict['settings.rowsEmpty']
    cardRoot.appendChild(empty)
  }

  // Two gates on the third state, per row: this host must ship the pin mechanism
  // at all (0.2.2 on), and the row must not be the host's fixed panel — the host
  // never unpins that one, so offering it would be a promise it silently refuses.
  for (const entry of rows) {
    cardRoot.appendChild(buildEntry(entry, rows))
  }

  // ④ write outcome. The host owns persistence; a refused write leaves the card
  // and the sidebar agreeing with each other and disagreeing with the store, so
  // the state has to be on screen, with the retry next to it.
  if (saveState.status !== 'idle') {
    const status = document.createElement('span')
    status.className = CLS.hint
    status.setAttribute(ATTR.own, '')
    status.dataset.saveState = saveState.status
    status.textContent = saveState.status === 'saving'
      ? dict['settings.saving']
      : saveState.status === 'saved' ? dict['settings.saved'] : dict['settings.saveFailed']
    cardRoot.appendChild(status)
  }
  if (saveState.status === 'error') {
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.className = CLS.control
    retry.dataset.field = 'retry'
    retry.setAttribute(ATTR.own, '')
    retry.textContent = dict['settings.retrySave']
    retry.addEventListener('click', () => {
      commit(saveState.fields)
    })
    cardRoot.appendChild(retry)
  }

  if (!values.writable) {
    const note = document.createElement('span')
    note.className = CLS.hint
    note.setAttribute(ATTR.own, '')
    note.textContent = dict['settings.readonly']
    cardRoot.appendChild(note)
  }

  // star 快车道行（单源 _tools/star-row，改副本无效；重渲染随 cardRoot 一起重建）
  const starRow = mountStarRow()
  starRow.setAttribute(ATTR.own, '')
  cardRoot.appendChild(starRow)
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
  fallback = {
    defaultFolded: next.defaultFolded,
    keepLabels: [...next.keepLabels],
    hideLabels: [...next.hideLabels],
    align: normalizeAlign(next.align),
    orderLabels: [...(next.orderLabels ?? [])],
  }
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
export const CARD_WRITES: readonly string[] = ['defaultFolded', 'align', 'keepLabels', 'hideLabels', 'orderLabels']