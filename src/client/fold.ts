/**
 * The fold itself: locate the shipped "More" row, decide which sibling panel
 * rows belong to the group, and mount a 28×28 toggle that folds them away.
 *
 * Why DOM and not a slot (findings §1/§2): the row is hardcoded in
 * `SidebarRoot` (`dsh-client-ui-sidebar/lib/client.js:479`) and no slot projects
 * into it — `sidebar.panellist` only projects icons, `sidebar.panellist.actions`
 * only fills the dropdown menu, and registering the `sidebar` single slot would
 * shadow the whole column. A client plugin that owns only DOM additions is the
 * one distributable route.
 *
 * The header is found **structurally**: within the "Global panels" nav the
 * `panelRow` carrying `aria-haspopup="menu"` is the More row (it is the last
 * child by construction), which keeps the logic free of localised text.
 */
import {
  ALIGN_MODES,
  ATTR,
  CLS,
  FIXED_LABELS,
  ICON_PATH,
  ICON_PX,
  PANELS_LABELS,
  SEL,
  SHEET,
  STORAGE_KEY,
  STYLE_TAG_ID,
  type AlignMode,
} from './constants.ts'
import { pickDictionary } from './locales.ts'

/** Minimal DOM surface we touch — keeps the tests free of a DOM dependency. */
type ConfigLike = { defaultFolded: boolean; keepLabels: string[]; hideLabels: string[]; align: AlignMode; orderLabels: string[] }

/**
 * Coerce a served alignment value into a mode the sheet has a rule for.
 *
 * The host config is a plain string (schemastery cannot express a closed union
 * across every line this plugin supports), so the value reaching the browser is
 * untrusted input: anything unknown must fall back to the shipped layout rather
 * than leaving the nav carrying an attribute no CSS matches.
 * @param value - whatever the config surface served.
 * @returns one of `ALIGN_MODES`, defaulting to `start`.
 */
export function normalizeAlign(value: unknown): AlignMode {
  return typeof value === 'string' && (ALIGN_MODES as readonly string[]).includes(value)
    ? (value as AlignMode)
    : 'start'
}

/**
 * What a sidebar row is set to do — the card's three-state control.
 *
 * `always` keeps the row in the column at all times, `foldable` lets the fold hide
 * it, and `more` hands it to the host's own "More" list (the 0.2.2 pin feature).
 */
export type RowState = 'always' | 'foldable' | 'more'

/** One sidebar panel row as the settings card shows it. */
export interface RowInfo {
  /** The row's accessible name (its aria-label), which is also what config stores. */
  label: string
  /** The row's current three-state setting. */
  state: RowState
}

/**
 * The row surface this plugin actually uses.
 *
 * Deliberately narrower than `HTMLElement`: the pure seams (row split, nav
 * lookup) are unit-tested against stubs of exactly this shape, and every real
 * `HTMLElement` satisfies it. Anything wider would be an untested promise.
 */
export interface RowLike {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  addEventListener(type: string, listener: (event: any) => void): void
  readonly textContent: string | null
  readonly isConnected: boolean
  readonly parentElement?: RowLike | null
  querySelector?(selector: string): RowLike | null
  querySelectorAll?(selector: string): NodeListOf<Element>
  matches?(selector: string): boolean
  closest?(selector: string): Element | null
  /** DOM `Node.contains`, used to tell “the nav itself” from “a row inside it”. */
  contains?(node: unknown): boolean
}

/** A queryable subtree (the real `document`, or a stub with the two query faces). */
type QueryRoot = {
  querySelector(sel: string): unknown
  querySelectorAll(sel: string): readonly unknown[]
}
type ElementLike = RowLike

/** What a mounted nav remembers so a re-scan is idempotent. */
interface Mount {
  nav: ElementLike
  header: ElementLike
  toggle: ElementLike
  dispose: () => void
}

/** The single live mount (this plugin owns exactly one sidebar). */
let mount: Mount | null = null
/** Whether the group is folded; `null` = never decided in this window yet. */
let folded: boolean | null = null
/** Last config the fold was applied with (also read by the settings card). */
let config: ConfigLike = { defaultFolded: false, keepLabels: [], hideLabels: [], align: 'start', orderLabels: [] }
/** Registered so `index.ts` can notify the fold after a settings write. */
const configListeners = new Set<() => void>()

/**
 * Read the folded flag for this window.
 * @returns the stored flag, or the configured default when nothing is stored.
 */
function currentFolded(): boolean {
  return folded === null ? config.defaultFolded : folded
}

/** Write the folded flag through to `localStorage` (window-level UI state). */
function persist(next: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    // Private mode / disabled storage: the session still folds, it just won't
    // survive a reload. Never let storage break the sidebar.
  }
}

/** Parse the persisted flag once per window. */
function readStored(): void {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    raw = null
  }
  folded = raw === '1' ? true : raw === '0' ? false : null
}

/** The accessible name of a row: `aria-label` first, then its text content. */
function labelOf(row: ElementLike): string {
  return (row.getAttribute('aria-label') || row.textContent || '').trim()
}

/** True when a label is in the "never fold" list (case/whitespace tolerant). */
export function isKept(label: string, keepLabels: readonly string[]): boolean {
  const needle = label.trim().toLowerCase()
  if (needle === '') return true
  return keepLabels.some((item) => item.trim().toLowerCase() === needle)
}

/**
 * True when a label belongs to the host's fixed panel row.
 *
 * The host never unpins that row (`FIXED_PANEL_ID`), so the third state is not
 * available for it on any line — offering it would be a promise the host
 * silently refuses.
 */
export function isFixedLabel(label: string): boolean {
  const needle = label.trim().toLowerCase()
  if (needle === '') return false
  return FIXED_LABELS.some((item) => item.toLowerCase() === needle)
}

/**
 * Whether one row may be handed to the host's "More" list.
 *
 * Two gates: the host must ship the pin mechanism at all, and the row must not
 * be the fixed one.
 * @param label - the row's accessible name.
 * @param hostCanPin - whether this host renders the 0.2.2 row structure.
 */
export function canMoveToMore(label: string, hostCanPin: boolean): boolean {
  return hostCanPin && !isFixedLabel(label)
}

/**
 * Drop fixed labels from a stored hide list.
 *
 * A config written by an older build (or hand-edited) may list the fixed row;
 * ignoring it here keeps the fold from chasing a move the host will never do.
 * @param hideLabels - the served hide list.
 * @returns the same list without the host's fixed labels.
 */
export function pruneHidden(hideLabels: readonly string[]): string[] {
  return hideLabels.filter((label) => !isFixedLabel(label))
}

/**
 * True when a label belongs to the host's "More" list (case/whitespace tolerant).
 *
 * An unnamed row is never hidden: the pin control is addressed by name, so a row
 * we cannot name is a row we cannot move.
 */
export function isHidden(label: string, hideLabels: readonly string[]): boolean {
  const needle = label.trim().toLowerCase()
  if (needle === '' || isFixedLabel(label)) return false
  return hideLabels.some((item) => item.trim().toLowerCase() === needle)
}

/**
 * One label's three-state setting, resolved from the two stored lists.
 *
 * `more` wins over `always`: a label that somehow sits in both lists must leave
 * the column rather than be silently resurrected by the keep list.
 */
export function stateOf(label: string, keepLabels: readonly string[], hideLabels: readonly string[]): RowState {
  if (isHidden(label, hideLabels)) return 'more'
  return isKept(label, keepLabels) ? 'always' : 'foldable'
}

/**
 * Split an ordered row list into the fold header and the fold group.
 *
 * The header is the row with `aria-haspopup="menu"` (the More launcher); with
 * the shipped DOM that is also always the last child, so the fallback keeps
 * working if a host ever drops the attribute. The group is every other row,
 * minus the `keepLabels` whitelist and minus the `hideLabels` rows (those are on
 * their way into the host's More list and must not count as foldable).
 * @param rows - the nav's `panelRow` buttons, in document order.
 * @param keepLabels - accessible names that are never folded.
 * @param hideLabels - accessible names that live in the host's "More" list.
 * @returns the header plus the foldable group, or `null` when there is nothing to fold.
 */
export function splitRows(
  rows: readonly ElementLike[],
  keepLabels: readonly string[],
  hideLabels: readonly string[] = [],
): { header: ElementLike; group: ElementLike[] } | null {
  if (rows.length < 2) return null
  const header = rows.find((row) => row.getAttribute('aria-haspopup') === 'menu') ?? rows[rows.length - 1]
  const group = rows.filter((row) => {
    if (row === header) return false
    const label = labelOf(row)
    return !isKept(label, keepLabels) && !isHidden(label, hideLabels)
  })
  return { header, group }
}

/**
 * Locate the "Global panels" nav.
 *
 * Three levels, most semantic first: the nav's own accessible name, any element
 * whose CSS-module fragment is `_panelList`, then any `<nav>` holding a
 * `_panelRow` button. Returns `null` when nothing matches — the caller then
 * leaves the sidebar exactly as shipped.
 */
/**
 * Move one label to another label's position in an ordered label list.
 *
 * Pure and case-sensitive by label identity: unknown labels leave the list
 * untouched. Used both by the sidebar DnD and by the settings card so both
 * surfaces compute the next order through one function.
 */
export function reorderLabels(labels: readonly string[], fromLabel: string, toLabel: string): string[] {
  const from = labels.indexOf(fromLabel)
  const to = labels.indexOf(toLabel)
  if (from < 0 || to < 0 || from === to) return [...labels]
  const next = [...labels]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Arrange live panel rows into the persisted label order.
 *
 * Rows whose label is absent from `orderLabels` are appended in their current
 * DOM order, so a config written before a row existed never loses that row.
 * The "More" header (aria-haspopup="menu", or the last row as fallback) is
 * always forced to the end — it is the fold toggle and must stay put.
 */
export function orderedRows(rows: readonly ElementLike[], orderLabels: readonly string[]): ElementLike[] {
  if (rows.length < 2) return [...rows]
  const header = rows.find((row) => row.getAttribute('aria-haspopup') === 'menu') ?? rows[rows.length - 1]
  const body = rows.filter((row) => row !== header)
  const rank = (row: ElementLike): number => {
    const label = labelOf(row)
    const idx = orderLabels.indexOf(label)
    return idx < 0 ? Number.MAX_SAFE_INTEGER : idx
  }
  // Stable sort: unknown labels keep their relative DOM order.
  const sorted = body
    .map((row, index) => ({ row, index, r: rank(row) }))
    .sort((a, b) => (a.r - b.r) || (a.index - b.index))
    .map((entry) => entry.row)
  return [...sorted, header]
}

export function findPanelNav(root: QueryRoot): ElementLike | null {
  for (const label of PANELS_LABELS) {
    const byLabel = root.querySelector(`nav[aria-label="${label}"]`)
    if (byLabel !== null) return byLabel as ElementLike
  }
  const byFragment = root.querySelectorAll(SEL.panelList)
  for (const candidate of Array.from(byFragment) as ElementLike[]) {
    if (candidate.querySelector?.(SEL.panelRow) !== null) return candidate
  }
  for (const candidate of Array.from(root.querySelectorAll('nav')) as ElementLike[]) {
    if (candidate.querySelector?.(SEL.panelRow) !== null) return candidate
  }
  return null
}

/** Read the nav's panel rows, in document order. */
function rowsOf(nav: ElementLike): ElementLike[] {
  return Array.from(nav.querySelectorAll?.(SEL.panelRow) ?? []) as ElementLike[]
}

/** Apply {@link splitRows} to a live nav. */
function resolveNavGroup(nav: ElementLike, keepLabels: readonly string[], hideLabels: readonly string[]) {
  return splitRows(rowsOf(nav), keepLabels, hideLabels)
}

/**
 * What one apply pass should do — computed without touching the DOM.
 *
 * Pulled out of `applyFold` so the decision (which rows fold, whether the control
 * is idle, whether the rail suppresses it) is testable without a browser. The
 * renderer below only writes what this returns.
 */
export interface FoldPlan {
  /** The row that carries the toggle (the shipped More row). */
  header: ElementLike
  /** Sibling rows that are not kept visible. */
  group: ElementLike[]
  /** True when every sibling is kept: nothing to fold, control reports itself idle. */
  idle: boolean
  /** The fold actually takes effect (folded, not idle, not in the 36px rail). */
  active: boolean
  /** Rows that must carry the folded mark. */
  folded: ElementLike[]
  /** Nav-level state mark, or null when the attribute should be absent. */
  state: 'folded' | null
  /** False in the rail: a 36px column has no room for a second 28px square. */
  toggleVisible: boolean
}

/**
 * Decide the fold for one scan.
 * @param rows - the nav's panel rows, in document order.
 * @param keepLabels - rows that stay visible while the group folds.
 * @param hideLabels - rows handed to the host's "More" list; never folded.
 * @param folded - the window's current fold choice.
 * @param rail - whether the sidebar is currently the 36px icon rail.
 * @returns the plan, or `null` when there is no header/group to work with.
 */
export function planFold(
  rows: readonly ElementLike[],
  keepLabels: readonly string[],
  hideLabels: readonly string[],
  folded: boolean,
  rail: boolean,
): FoldPlan | null {
  const resolved = splitRows(rows, keepLabels, hideLabels)
  if (resolved === null) return null
  const { header, group } = resolved
  const idle = group.length === 0
  const active = folded && !rail && !idle
  return {
    header,
    group,
    idle,
    active,
    folded: active ? group : [],
    state: active ? 'folded' : null,
    toggleVisible: !rail,
  }
}

/** Listeners the settings card registers to repaint when the sidebar changes. */
const rosterListeners = new Set<() => void>()
/** Last roster fingerprint, so we only notify on real change. */
let rosterKey = ''

/**
 * The rows the settings card shows: the sidebar's own panel rows, the entries the
 * host already holds in its "More" list, and every label we still hide but whose
 * row is not on screen right now (the More list is portalled, so it only exists
 * while it is open).
 *
 * This is read from the **live DOM**, not from config: the point of the card is
 * to offer controls for whatever this profile actually has, including entries
 * installed after the card was written.
 * @returns one entry per manageable row, in document order.
 */
export function roster(): RowInfo[] {
  const nav = findPanelNav(document as unknown as QueryRoot)
  const rows = nav === null
    ? []
    : rosterFrom(orderedRows(rowsOf(nav), config.orderLabels), config.keepLabels, config.hideLabels)
  const seen = new Set(rows.map((row) => row.label.toLowerCase()))
  for (const entry of moreMenuRows()) {
    if (seen.has(entry.label.toLowerCase())) continue
    rows.push(entry)
    seen.add(entry.label.toLowerCase())
  }
  // A label we still hide whose row is gone from both surfaces keeps its control:
  // dropping it would silently drop the setting with it.
  for (const label of config.hideLabels) {
    const trimmed = label.trim()
    if (trimmed === '' || seen.has(trimmed.toLowerCase())) continue
    rows.push({ label: trimmed, state: 'more' })
    seen.add(trimmed.toLowerCase())
  }
  return rows
}

/**
 * The host's own "More" list, read from the portalled menu when it is open.
 *
 * The menu is rendered under `document.body`, so its rows never sit inside the
 * nav and the nav scan can never see them. Each row is a menu item plus a
 * `_pinButton` whose enclosing `div` owns the label text.
 * @returns one entry per entry the host currently keeps out of the column.
 */
export function moreMenuRows(): RowInfo[] {
  const out: RowInfo[] = []
  for (const button of Array.from(document.querySelectorAll(SEL.pinButton))) {
    const label = ((button as Element).closest('div')?.textContent ?? '').trim()
    if (label !== '') out.push({ label, state: 'more' })
  }
  return out
}

/**
 * The card's row list, computed from a row array instead of the live DOM.
 * @param rows - the nav's panel rows, in document order.
 * @param keepLabels - rows set to stay visible.
 * @param hideLabels - rows set to live in the host's "More" list.
 * @returns one entry per sibling of the header, unnamed rows dropped.
 */
export function rosterFrom(
  rows: readonly ElementLike[],
  keepLabels: readonly string[],
  hideLabels: readonly string[] = [],
): RowInfo[] {
  const resolved = splitRows(rows, keepLabels, hideLabels)
  const header = resolved?.header
  return rows
    .filter((row) => row !== header)
    .map((row) => {
      const label = labelOf(row)
      return { label, state: stateOf(label, keepLabels, hideLabels) }
    })
    .filter((row) => row.label !== '')
}

/**
 * Fold one row's moved control into the two stored lists.
 *
 * The control state IS the storage: `always` rows are the keep list, `more` rows
 * are the hide list, and `foldable` rows appear in neither. A row that dropped
 * out of the roster loses its entry, and a row that appears starts foldable —
 * which is what the shipped default means.
 * @param rows - the roster the card rendered.
 * @param label - the row whose control moved.
 * @param next - its new state.
 * @returns the two label lists to write to config.
 */
export function deriveLists(
  rows: readonly RowInfo[],
  label: string,
  next: RowState,
): { keepLabels: string[]; hideLabels: string[] } {
  const keepLabels: string[] = []
  const hideLabels: string[] = []
  for (const row of rows) {
    const state = row.label === label ? next : row.state
    if (state === 'always') keepLabels.push(row.label)
    else if (state === 'more') hideLabels.push(row.label)
  }
  return { keepLabels, hideLabels }
}

/**
 * Subscribe to roster changes (rows added/removed, or keep flags recomputed).
 * @param listener - called whenever the card should repaint.
 * @returns an unsubscribe function.
 */
export function subscribeRoster(listener: () => void): () => void {
  rosterListeners.add(listener)
  return () => {
    rosterListeners.delete(listener)
  }
}

/** Tell the card that the row inventory (or one row's state) changed. */
function notifyRoster(rows: RowInfo[]): void {
  const key = rows.map((row) => `${row.label}:${row.state}`).join('|')
  if (key === rosterKey) return
  rosterKey = key
  for (const listener of Array.from(rosterListeners)) {
    try {
      listener()
    } catch {
      // A broken card must not take the fold with it.
    }
  }
}

/** The narrow-rail state: the host hides labels and every row is 36px wide. */
function isRail(nav: ElementLike): boolean {
  return nav.closest?.(SEL.collapsed) !== null && nav.closest?.(SEL.collapsed) !== undefined
}

/**
 * True when this row holds the panel the host marks as current.
 *
 * Two signals, because the line changed shape: the shipped rows carry
 * `aria-current="page"`, and from 0.2.2 on the wrapper carries
 * `_panelEntryActive`.
 * @param row - one panel-row button.
 */
function isActiveRow(row: ElementLike): boolean {
  if (row.getAttribute('aria-current') === 'page') return true
  const entry = row.closest?.(SEL.panelEntry) as Element | null | undefined
  return (entry?.className ?? '').includes('_panelEntryActive')
}

/**
 * Whether a mutation batch could concern the sidebar at all.
 *
 * The observer sees the whole body, so the first thing every batch gets is this
 * cheap filter: a streaming reply mutates the tree dozens of times per second,
 * and none of it can change the fold. Only added/removed nodes that are (or
 * contain) a panel row count.
 * @param records - one observer batch.
 * @returns true when at least one record adds or removes a panel row.
 */
export function recordsTouchRows(
  records: readonly { type?: string; addedNodes?: ArrayLike<unknown> | null; removedNodes?: ArrayLike<unknown> | null }[],
): boolean {
  for (const record of records) {
    if (record.type !== undefined && record.type !== 'childList') continue
    const nodes = [...Array.from(record.addedNodes ?? []), ...Array.from(record.removedNodes ?? [])]
    for (const node of nodes) {
      const element = node as ElementLike | null
      if (element === null || typeof element !== 'object' || (element as unknown as Node).nodeType !== 1) continue
      if (element.matches?.(SEL.panelRow) === true) return true
      const inside = element.querySelector?.(SEL.panelRow)
      if (inside !== null && inside !== undefined) return true
    }
  }
  return false
}

/** Inject (once) the sheet that draws the toggle and hides folded rows. */
function ensureSheet(): HTMLStyleElement | null {
  const existing = document.head.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`)
  if (existing !== null) return existing as HTMLStyleElement
  const tag = document.createElement('style')
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.dataset.plugin = STYLE_TAG_ID.split('/')[0] as string
  tag.textContent = SHEET
  document.head.appendChild(tag)
  return tag
}

/** Build the chevron SVG (self-drawn: the host `primitives` package is off-limits). */
function buildIcon(pointUp: boolean): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(ICON_PX))
  svg.setAttribute('height', String(ICON_PX))
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.25')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add(CLS.icon)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', pointUp ? ICON_PATH.up : ICON_PATH.down)
  svg.appendChild(path)
  return svg
}

/** What the toggle currently shows, so a repaint only happens when it must. */
let paintedKey = ''
/** When a pointer gesture last activated us (guards against a second `click`). */
let lastPointerActivation = 0

/**
 * Repaint the toggle: arrow up = "can collapse", arrow down = "can expand".
 *
 * Repainting is **idempotent and skipped when nothing changed**. The first
 * implementation rebuilt the chevron on every scan; scans run on every DOM
 * mutation, so the `<svg>` could be replaced between `mousedown` and `mouseup` —
 * and a click whose press/release targets no longer exist is dropped by the
 * browser (measured: ~half of real clicks silently ignored).
 */
function paintToggle(toggle: ElementLike, options: { idle?: boolean }): void {
  const lang = document.documentElement.lang ?? ''
  const isFolded = currentFolded()
  const key = `${isFolded ? '1' : '0'}|${lang}|${options.idle === true ? 'idle' : 'live'}`
  if (key === paintedKey && (toggle as HTMLElement).firstElementChild !== null) return
  paintedKey = key
  const dict = pickDictionary(lang)
  ;(toggle as HTMLElement).replaceChildren(buildIcon(!isFolded))
  const label = options.idle === true
    ? dict['fold.nothing']
    : isFolded ? dict['fold.expand'] : dict['fold.collapse']
  toggle.setAttribute('aria-expanded', String(!isFolded))
  toggle.setAttribute('aria-label', label)
  toggle.setAttribute('title', label)
}

/**
 * True when this host ships the 0.2.2 row wrapper, i.e. it owns the pin feature.
 *
 * The third state ("hide into More") is not ours to draw: the host removes the
 * row from the column and renders it in its own menu. What we own is driving it,
 * and the wrapper is the structure that says the host can be driven.
 */
export function hostHasPin(): boolean {
  return document.querySelector(SEL.panelEntry) !== null
}

/**
 * The element a fold mark must hide.
 *
 * From the 0.2.2 line on, a row button is wrapped in `div._panelEntry` that also
 * carries the host's own pin control; hiding only the button left an empty entry
 * with a hover-visible pin behind (measured on 0.2.2-rc.3). Hiding the wrapper
 * takes the whole row with it and leaves the shipped DOM untouched on older lines.
 *
 * Exported as a seam: it is the one line that decides whether the host's
 * `.panelList { gap: 2px }` still sees an item, so the test has to reach it.
 */
export function foldTarget(row: ElementLike): ElementLike {
  return (row.closest?.(SEL.panelEntry) ?? row) as ElementLike
}

/** The host's own "unpin" control of one row, or `null` in the 36px rail. */
function unpinControl(row: ElementLike): HTMLElement | null {
  const scope = foldTarget(row)
  return (scope.querySelector?.(SEL.panelUnpin) ?? null) as HTMLElement | null
}

/** The label text of one row inside the portalled "More" list. */
function menuRowLabel(control: Element): string {
  return (control.closest('div')?.textContent ?? '').trim()
}

/** One key form for label matching (the host writes labels, we compare them). */
function labelKey(label: string): string {
  return label.trim().toLowerCase()
}

/** The "More" list's pin-back control for one label, when that list is on screen. */
function pinControl(label: string): HTMLElement | null {
  const key = labelKey(label)
  if (key === '') return null
  for (const control of Array.from(document.querySelectorAll(SEL.pinButton))) {
    if (labelKey(menuRowLabel(control)) === key) return control as HTMLElement
  }
  return null
}

/** One label we owe the host a move, with how many times we asked and when. */
const pinMoves = new Map<string, { tries: number; at: number }>()
/** Labels waiting for the host to put their row back into the column. */
const restoreWanted = new Map<string, number>()
/** One label is moved at most this often: every click re-renders the sidebar. */
const PIN_COOLDOWN_MS = 1000
/** Moves per label before this window gives up (a rail refuses, so stop asking). */
const PIN_MAX_TRIES = 3
/** How long a pin-back request waits for the list's pin control to render. */
const RESTORE_WINDOW_MS = 2000

/**
 * Ask the host to move every `more` row out of the column.
 *
 * Only the host owns that decision (`setPinned` is not a plugin surface), so the
 * move rides its own pin control. The call is bounded: at most {@link PIN_MAX_TRIES}
 * clicks per label per window, at most one per {@link PIN_COOLDOWN_MS}, and never
 * while the row is missing its control (the 36px rail renders none).
 * @param rows - the nav's panel rows, in document order.
 */
function moveRowsToMore(rows: readonly ElementLike[]): void {
  if (!hostHasPin() || config.hideLabels.length === 0) return
  const now = Date.now()
  for (const row of rows) {
    const label = labelOf(row)
    if (!isHidden(label, config.hideLabels)) continue
    const key = labelKey(label)
    const move = pinMoves.get(key)
    if (move !== undefined && (move.tries >= PIN_MAX_TRIES || now - move.at < PIN_COOLDOWN_MS)) continue
    const control = unpinControl(row)
    if (control === null) continue
    pinMoves.set(key, { tries: (move?.tries ?? 0) + 1, at: now })
    control.click()
  }
}

/**
 * Ask the host to pin rows back into the column.
 *
 * The pin-back control exists only inside the host's portalled "More" list, so
 * this opens that list when needed and waits for the control to render: the
 * sidebar's own mutation stream drives the retry, no timer of ours.
 * @param rows - the nav's panel rows, in document order.
 */
function pinRowsBack(rows: readonly ElementLike[]): void {
  if (restoreWanted.size === 0) return
  if (!hostHasPin()) {
    restoreWanted.clear()
    return
  }
  const now = Date.now()
  const present = new Set(rows.map((row) => labelKey(labelOf(row))))
  let missing = 0
  for (const [key, at] of Array.from(restoreWanted)) {
    // The row already came back (a restart drops the host's in-memory pins).
    if (present.has(key)) {
      restoreWanted.delete(key)
      continue
    }
    if (now - at > RESTORE_WINDOW_MS) {
      restoreWanted.delete(key)
      continue
    }
    const control = pinControl(key)
    if (control !== null) {
      control.click()
      restoreWanted.delete(key)
      continue
    }
    missing += 1
  }
  if (missing > 0) openMoreList()
}

/** Open the host's "More" list if it is closed (idempotent through aria-expanded). */
function openMoreList(): void {
  const anchor = document.querySelector(`${SEL.panelRow}[aria-haspopup="menu"]`)
  if (anchor === null || anchor.getAttribute('aria-expanded') === 'true') return
  ;(anchor as HTMLElement).click()
}

// --- Row reorder (HTML5 DnD on the live sidebar rows) -----------------------

/** Registered by index.ts / the settings card to learn when a sidebar drag commits a new order. */
const orderListeners = new Set<(order: string[]) => void>()
let dragSourceLabel: string | null = null

/** Subscribe to order changes originating from the sidebar DOM. */
export function subscribeOrder(listener: (order: string[]) => void): () => void {
  orderListeners.add(listener)
  return () => { orderListeners.delete(listener) }
}

/** Publish a new order from a sidebar drag and persist it in our config. */
function notifyOrderChange(order: string[]): void {
  config = { ...config, orderLabels: [...order] }
  for (const listener of Array.from(orderListeners)) listener([...order])
}

/**
 * Wire one panel row's **wrapper** for HTML5 drag-and-drop.
 *
 * Idempotent: an `ATTR.dnd` mark prevents duplicate listeners across the many
 * rescan passes. The wrapper (not the button) is the drag surface because it is
 * the visible row *and* the flex item `applyOrder` ranks — otherwise dropping on
 * the row's pin gutter would miss the target. The "More" header is never wired:
 * it stays the fold toggle and stays last.
 */
function bindRowDrag(row: ElementLike, isHeader: boolean): void {
  if (isHeader) return
  const label = labelOf(row)
  if (label === '') return
  const el = foldTarget(row) as unknown as HTMLElement
  if (el.getAttribute(ATTR.dnd) !== null) return
  el.setAttribute(ATTR.dnd, '')
  el.setAttribute('draggable', 'true')
  el.addEventListener('dragstart', (e: any) => {
    dragSourceLabel = label
    el.classList.add(CLS.rowDrag)
    if (e?.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  })
  el.addEventListener('dragover', (e: any) => {
    if (dragSourceLabel === null || dragSourceLabel === label) return
    e?.preventDefault?.()
    if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move'
    el.classList.add(CLS.rowDragOver)
  })
  el.addEventListener('dragleave', () => {
    el.classList.remove(CLS.rowDragOver)
  })
  el.addEventListener('drop', (e: any) => {
    e?.preventDefault?.()
    el.classList.remove(CLS.rowDragOver)
    const source = dragSourceLabel
    dragSourceLabel = null
    if (source === null || source === label) return
    const all = rowsOf(mount?.nav ?? (el.closest?.(SEL.panelList) as ElementLike))
    if (all.length === 0) return
    // Order the reorderable rows only: the "More" header is not a rank, it is
    // pinned last by orderedRows, and persisting its label would just be noise.
    const header = all.find((row) => row.getAttribute('aria-haspopup') === 'menu') ?? all[all.length - 1]
    const next = reorderLabels(all.filter((row) => row !== header).map(labelOf), source, label)
    applyOrder(all, next)
    notifyOrderChange(next)
  })
  el.addEventListener('dragend', () => {
    dragSourceLabel = null
    el.classList.remove(CLS.rowDrag)
    el.classList.remove(CLS.rowDragOver)
  })
}

/** Wire every live row for reordering (called on each apply pass, idempotent). */
function bindRowDrags(rows: readonly ElementLike[]): void {
  if (rows.length < 2) return
  const header = rows.find((row) => row.getAttribute('aria-haspopup') === 'menu') ?? rows[rows.length - 1]
  for (const row of rows) bindRowDrag(row, row === header)
}

/**
 * Reorder the nav's rows to match the persisted label order.
 *
 * Written as the flex `order` property on each row's **wrapper**, never by moving
 * nodes. Two measured facts force that choice:
 *
 *  - from the 0.2.2 line on every row button sits in its own `div._panelEntry`
 *    (`SidebarRoot.tsx:78`), so the buttons are *not* siblings. The first cut
 *    moved them with `parent.insertBefore(row, next)`, where `next` belonged to
 *    another parent — the DOM throws `NotFoundError`, our `try` swallowed it, and
 *    a drop therefore highlighted the target and changed nothing (the bug this
 *    replaces);
 *  - the nodes are React's, so re-parenting them is a fight we lose on the next
 *    render. `order` is ours alone to write, it survives re-renders (the host sets
 *    no `style` on these wrappers), and removing the declarations undoes it.
 *
 * `.panelList` is `display:flex; flex-direction:column` (`SidebarRoot.module.css`),
 * so `order` reorders the column without touching document order — which is also
 * why the observer (attributes filtered to `class`) cannot see these writes.
 *
 * The "More" header is ordered last by {@link orderedRows}, so it stays the fold
 * toggle no matter what the user drags.
 * @param rows - the nav's panel rows, in document order.
 * @param orderLabels - persisted label order; an empty list clears every rank.
 */
export function applyOrder(rows: readonly ElementLike[], orderLabels: readonly string[]): void {
  if (rows.length < 2) return
  const entries: ElementLike[] = []
  for (const row of rows) {
    const entry = foldTarget(row)
    if (!entries.includes(entry)) entries.push(entry)
  }
  const wanted = new Map<ElementLike, number>()
  if (orderLabels.length > 0) {
    orderedRows(rows, orderLabels).forEach((row, index) => {
      wanted.set(foldTarget(row), index + 1)
    })
  }
  for (const entry of entries) {
    const value = wanted.get(entry)
    if (value === undefined) {
      if (entry.getAttribute(ATTR.order) === null) continue
      entry.removeAttribute(ATTR.order)
      const el = entry as unknown as HTMLElement
      if (el.style != null) el.style.order = ''
      continue
    }
    const text = String(value)
    // Write only on change: a no-op write is a mutation nobody asked for.
    if (entry.getAttribute(ATTR.order) === text) continue
    entry.setAttribute(ATTR.order, text)
    const el = entry as unknown as HTMLElement
    if (el.style != null) el.style.order = text
  }
}

/** Undo every inline rank this plugin wrote (dispose / HMR sweep). */
function clearOrder(): void {
  for (const node of Array.from(document.querySelectorAll(`[${ATTR.order}]`)) as ElementLike[]) {
    node.removeAttribute(ATTR.order)
    const el = node as unknown as HTMLElement
    if (el.style != null) el.style.order = ''
  }
}

/**
 * Write the fold marks. Only attributes we own are touched: no host class,
 * no host attribute, and never the anchor's `aria-expanded` (that one is the
 * dropdown menu's state, not ours).
 */
function applyFold(): void {
  if (mount === null) return
  const rows = rowsOf(mount.nav)
  const plan = planFold(rows, config.keepLabels, config.hideLabels, currentFolded(), isRail(mount.nav))
  if (plan === null) return
  const { header } = plan
  // Reorder the live rows to the persisted order before any fold marks are
  // written. Ranks are inline `order` values written only when they change, and
  // the observer watches `class` alone, so a scan cannot trigger itself.
  applyOrder(rows, config.orderLabels)
  bindRowDrags(rows)
  if (header.getAttribute(ATTR.header) === null) header.setAttribute(ATTR.header, '')
  // Alignment is one nav-level mark with three rule sets behind it. Written on
  // every scan (and only when it differs) so a settings write repaints the row
  // content without a remount.
  const align = normalizeAlign(config.align)
  if (mount.nav.getAttribute(ATTR.align) !== align) mount.nav.setAttribute(ATTR.align, align)

  // The settings card renders whatever is on screen right now; keep it in sync —
  // and in the order the column shows, so a drag reads the same on both surfaces.
  notifyRoster(rosterFrom(orderedRows(rows, config.orderLabels), config.keepLabels, config.hideLabels))

  // Nothing to fold (every sibling is kept): say so on the control instead of
  // flipping the arrow over an unchanged list — the first report of "arrow moves
  // but nothing collapses" was exactly this state, caused by a config write.
  ;(mount.toggle as HTMLElement).classList.toggle(CLS.toggleIdle, plan.idle)
  mount.toggle.setAttribute('aria-disabled', plan.idle ? 'true' : 'false')

  for (const row of rows) {
    const want = plan.folded.includes(row)
    // The mark lands on the row's wrapper where the host ships one (0.2.2 on),
    // so an emptied `_panelEntry` cannot outlive its row.
    const target = foldTarget(row)
    // Touch an attribute only when it actually changes: every write is a
    // mutation, and every mutation triggers the rescan that caused this write.
    if (want && !target.getAttribute(ATTR.folded)) target.setAttribute(ATTR.folded, '')
    else if (!want && target.getAttribute(ATTR.folded) !== null) target.removeAttribute(ATTR.folded)
  }
  // The plan owns the idle case too: an idle control carries no state mark.
  if (plan.state !== null && mount.nav.getAttribute(ATTR.state) !== plan.state) mount.nav.setAttribute(ATTR.state, plan.state)
  else if (plan.state === null && mount.nav.getAttribute(ATTR.state) !== null) mount.nav.removeAttribute(ATTR.state)
  // A 36px rail has no room for a second 28px square: hand the row back to the host.
  ;(mount.toggle as HTMLElement).style.display = plan.toggleVisible ? 'inline-flex' : 'none'
  paintToggle(mount.toggle, { idle: plan.idle })
  // Folded while the current panel is one of the folded rows: mark the control so
  // a 5px dot can say “what you are reading lives in here”.
  const holdsActive = plan.active && plan.group.some((row) => isActiveRow(row))
  if (holdsActive && mount.toggle.getAttribute(ATTR.activeInside) === null) mount.toggle.setAttribute(ATTR.activeInside, '')
  else if (!holdsActive && mount.toggle.getAttribute(ATTR.activeInside) !== null) mount.toggle.removeAttribute(ATTR.activeInside)
  // Last, because both hand the sidebar back to the host and every click causes a
  // re-render: the third state and its recovery ride on the host's own pin controls.
  moveRowsToMore(rows)
  pinRowsBack(rows)
}
/** Toggle the group and persist the choice. */
function toggleFold(): void {
  // An empty group must not pretend to fold: ignore the gesture entirely.
  if (mount !== null) {
    const resolved = resolveNavGroup(mount.nav, config.keepLabels, config.hideLabels)
    if (resolved !== null && resolved.group.length === 0) return
  }
  folded = !currentFolded()
  persist(folded)
  applyFold()
}

/**
 * Bind the toggle's input surface.
 *
 * Activation rides on **`pointerup`**, not on `click`: the host re-renders the
 * sidebar constantly, and a click whose press target was replaced mid-gesture is
 * never dispatched. `pointerup` always fires on the element under the pointer.
 * The `click` handler stays for keyboard activation (Enter/Space) and as the
 * fallback when this run predates Pointer Events.
 */
function bindToggle(toggle: ElementLike): void {
  const stop = (event: Event): void => {
    event.stopPropagation()
  }
  const activate = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
    lastPointerActivation = Date.now()
    toggleFold()
  }
  // Keep the host's own menu/dismiss logic out of our gesture.
  for (const type of ['pointerdown', 'mousedown', 'dblclick']) toggle.addEventListener(type, stop as (event: Event) => void)
  toggle.addEventListener('pointerup', (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== undefined) return
    activate(event)
  })
  if (typeof PointerEvent === 'undefined') {
    toggle.addEventListener('mouseup', activate as (event: Event) => void)
  }
  toggle.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation()
    // A click that follows our own pointerup is the same gesture — ignore it.
    if (Date.now() - lastPointerActivation < 500) return
    event.preventDefault()
    toggleFold()
  })
  toggle.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') activate(event)
  })
}

/** Create the toggle as a sibling of the More anchor, inside the `_moreAnchor` span. */
function buildToggle(): ElementLike {
  const toggle = document.createElement('div')
  toggle.className = CLS.toggle
  toggle.setAttribute('role', 'button')
  toggle.setAttribute('tabindex', '0')
  toggle.setAttribute(ATTR.own, '')
  // A fresh node has no icon yet, so the paint-dedupe key must not suppress it.
  paintedKey = ''
  bindToggle(toggle as ElementLike)
  return toggle as ElementLike
}

/** Tear down a live mount: remove our nodes and every attribute we wrote. */
function unmount(): void {
  if (mount === null) return
  const { nav, header, toggle, dispose } = mount
  dispose()
  ;(toggle as HTMLElement).remove()
  nav.removeAttribute(ATTR.state)
  nav.removeAttribute(ATTR.align)
  header.removeAttribute(ATTR.header)
  for (const row of Array.from(nav.querySelectorAll?.(`[${ATTR.folded}]`) ?? []) as ElementLike[]) {
    row.removeAttribute(ATTR.folded)
  }
  for (const row of Array.from(nav.querySelectorAll?.(`[${ATTR.dnd}]`) ?? []) as ElementLike[]) {
    row.removeAttribute(ATTR.dnd)
    row.removeAttribute('draggable')
    ;(row as unknown as HTMLElement).classList?.remove(CLS.rowDrag, CLS.rowDragOver)
  }
  clearOrder()
  mount = null
}

/**
 * Mount (or re-mount) the fold over the current sidebar DOM.
 *
 * Called on activation and after every DOM mutation. Idempotent: an existing
 * healthy mount whose header is still in the document is left untouched.
 * @returns whether a mount is live after the call.
 */
export function rescan(): boolean {
  const nav = findPanelNav(document as unknown as QueryRoot)
  if (nav === null) {
    unmount()
    return false
  }
  const resolved = resolveNavGroup(nav, config.keepLabels, config.hideLabels)
  if (resolved === null) {
    unmount()
    return false
  }
  const stillHealthy =
    mount !== null && mount.nav === nav && mount.header.isConnected && mount.toggle.isConnected
  if (stillHealthy && mount !== null) {
    applyFold()
    return true
  }
  unmount()
  const { header } = resolved
  const anchor = header.parentElement as ElementLike | null
  if (anchor === null || anchor === undefined || anchor.matches?.(SEL.moreAnchor) !== true) {
    // Without the Menu host element we would have to nest a button inside the
    // host's button, or restyle a flex column: refuse rather than guess.
    return false
  }
  ensureSheet()
  const toggle = buildToggle()
  // The anchor span is the `Menu` host element: React only re-sets its *class*
  // there, so appending a sibling survives re-renders — and because we position
  // the toggle off the header row instead, the Menu's own anchor box (and thus
  // the portal menu's offset) keeps the exact height the host measures.
  ;(anchor as HTMLElement).appendChild(toggle as HTMLElement)
  mount = { nav, header, toggle, dispose: () => {} }
  applyFold()
  return true
}

/**
 * Remove every artifact this plugin may have left in the DOM, including ones a
 * previous activation left behind.
 *
 * Disable→enable (or any HMR remount) runs `apply` again without a guaranteed
 * teardown of the old mount first; without this sweep each cycle stacked another
 * invisible toggle on the same coordinate (measured: 3 ghosts after 2 cycles).
 */
function sweep(): void {
  for (const node of Array.from(document.querySelectorAll(`.${CLS.toggle}[${ATTR.own}]`))) node.remove()
  for (const nav of Array.from(document.querySelectorAll(`[${ATTR.header}], [${ATTR.state}], [${ATTR.align}]`)) as ElementLike[]) {
    nav.removeAttribute(ATTR.header)
    nav.removeAttribute(ATTR.state)
    nav.removeAttribute(ATTR.align)
  }
  for (const row of Array.from(document.querySelectorAll(`[${ATTR.folded}]`)) as ElementLike[]) {
    row.removeAttribute(ATTR.folded)
  }
  for (const row of Array.from(document.querySelectorAll(`[${ATTR.dnd}]`)) as ElementLike[]) {
    row.removeAttribute(ATTR.dnd)
    row.removeAttribute('draggable')
    ;(row as unknown as HTMLElement).classList?.remove(CLS.rowDrag, CLS.rowDragOver)
  }
  clearOrder()
  mount = null
  // The pin bookkeeping belongs to one window's DOM; a remount starts from what
  // the host shows now, never from a count that may no longer refer to it.
  pinMoves.clear()
  restoreWanted.clear()
}

/**
 * Install the fold and keep it installed across re-renders.
 * @param cfg - the effective configuration.
 * @returns a disposer that leaves the sidebar exactly as shipped.
 */
export function installFold(cfg: ConfigLike): () => void {
  config = copyConfig(cfg)
  readStored()
  sweep()
  let observer: MutationObserver | null = null
  let queued = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  const schedule = (): void => {
    if (queued) return
    queued = true
    // 50ms, not 16: the sidebar re-renders on every pin/selection and a streaming
    // reply mutates the tree many times per frame. One scan per burst is enough.
    setTimeout(() => {
      queued = false
      rescan()
    }, 50)
  }
  /**
   * Feed the observer's batches through a relevance filter before scanning.
   *
   * A batch matters when it adds/removes a panel row, or when a `class` flips on
   * the nav, one of its ancestors (the 36px rail switch) or a row inside it (the
   * wrapper's active mark, which the dot follows).
   */
  const onMutations = (records: MutationRecord[]): void => {
    if (recordsTouchRows(records)) {
      schedule()
      return
    }
    const nav = mount?.nav ?? findPanelNav(document as unknown as QueryRoot)
    if (nav === null) return
    for (const record of records) {
      if (record.type !== 'attributes') continue
      const target = record.target as unknown as ElementLike
      if (target === nav || target.contains?.(nav) === true || nav.contains?.(target) === true) {
        schedule()
        return
      }
    }
  }
  /**
   * Boot retry: the sidebar can mount after this plugin, and a hidden/background
   * window never fires `requestAnimationFrame` (measured: the first scan missed
   * and every later rescan was queued on a frozen rAF, leaving the plugin inert
   * until a manual remount). A plain timer has no such freeze.
   */
  const retryUntilMounted = (): void => {
    if (mount !== null || attempts >= 40) return
    attempts += 1
    rescan()
    if (mount === null) retryTimer = setTimeout(retryUntilMounted, 250)
  }
  rescan()
  retryTimer = setTimeout(retryUntilMounted, 100)
  if (typeof MutationObserver === 'function') {
    // `attributes` matters: collapsing the sidebar only flips a `class` on an
    // ancestor, and the childList mutations of that same commit can land before
    // the class change (measured) — watching only children read a stale rail.
    observer = new MutationObserver(onMutations)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
  }
  const onConfig = (): void => {
    schedule()
  }
  configListeners.add(onConfig)
  return () => {
    configListeners.delete(onConfig)
    if (retryTimer !== null) clearTimeout(retryTimer)
    observer?.disconnect()
    unmount()
    document.head.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`)?.remove()
  }
}

/**
 * Adopt a freshly served configuration (settings write, or first read) and
 * repaint immediately — no restart, no reload.
 *
 * A label that left `hideLabels` is queued for a pin-back: the host put the row
 * in its own "More" list, and only that list's control can bring it back.
 */
export function applyConfig(cfg: ConfigLike): void {
  const previousHide = config.hideLabels
  config = copyConfig(cfg)
  const now = Date.now()
  for (const label of previousHide) {
    if (isHidden(label, config.hideLabels)) continue
    const key = labelKey(label)
    if (key !== '') restoreWanted.set(key, now)
  }
  for (const listener of Array.from(configListeners)) listener()
  applyFold()
}

/** One deep copy of a served configuration, with the alignment coerced. */
function copyConfig(cfg: ConfigLike): ConfigLike {
  return {
    defaultFolded: cfg.defaultFolded,
    keepLabels: [...cfg.keepLabels],
    // The fixed row can never be handed to the host, so a stale entry for it is
    // dropped on the way in instead of being retried on every scan.
    hideLabels: pruneHidden(cfg.hideLabels),
    align: normalizeAlign(cfg.align),
    orderLabels: [...(cfg.orderLabels ?? [])],
  }
}

/** The configuration the fold is currently running with (settings card reads it). */
export function effectiveConfig(): ConfigLike {
  return copyConfig(config)
}

/** Built-in defaults, used when a host serves no writable configuration surface. */
export const BUILTIN_CONFIG: ConfigLike = {
  defaultFolded: false,
  keepLabels: ['插件', 'Plugins'],
  hideLabels: [],
  align: 'start',
  orderLabels: [],
}