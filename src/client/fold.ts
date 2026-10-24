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
type ConfigLike = { defaultFolded: boolean; keepLabels: string[]; align: AlignMode }

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
 * The row surface this plugin actually uses.
 *
 * Deliberately narrower than `HTMLElement`: the pure seams (row split, nav
 * lookup) are unit-tested against stubs of exactly this shape, and every real
 * `HTMLElement` satisfies it. Anything wider would be an untested promise.
 */
/** One sidebar panel row as the settings card shows it. */
export interface RowInfo {
  /** The row's accessible name (its aria-label), which is also what config stores. */
  label: string
  /** True when the row is kept visible while the group is folded. */
  keep: boolean
}

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
let config: ConfigLike = { defaultFolded: false, keepLabels: [], align: 'start' }
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
 * Split an ordered row list into the fold header and the fold group.
 *
 * The header is the row with `aria-haspopup="menu"` (the More launcher); with
 * the shipped DOM that is also always the last child, so the fallback keeps
 * working if a host ever drops the attribute. The group is every other row,
 * minus the `keepLabels` whitelist.
 * @param rows - the nav's `panelRow` buttons, in document order.
 * @param keepLabels - accessible names that are never folded.
 * @returns the header plus the foldable group, or `null` when there is nothing to fold.
 */
export function splitRows(
  rows: readonly ElementLike[],
  keepLabels: readonly string[],
): { header: ElementLike; group: ElementLike[] } | null {
  if (rows.length < 2) return null
  const header = rows.find((row) => row.getAttribute('aria-haspopup') === 'menu') ?? rows[rows.length - 1]
  const group = rows.filter((row) => row !== header && !isKept(labelOf(row), keepLabels))
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
function resolveNavGroup(nav: ElementLike, keepLabels: readonly string[]) {
  return splitRows(rowsOf(nav), keepLabels)
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
 * @param folded - the window's current fold choice.
 * @param rail - whether the sidebar is currently the 36px icon rail.
 * @returns the plan, or `null` when there is no header/group to work with.
 */
export function planFold(
  rows: readonly ElementLike[],
  keepLabels: readonly string[],
  folded: boolean,
  rail: boolean,
): FoldPlan | null {
  const resolved = splitRows(rows, keepLabels)
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
 * The fold group as the settings card shows it: every sibling panel row of the
 * "More" header, with whether it is currently kept visible.
 *
 * This is read from the **live DOM**, not from config: the point of the card is
 * to offer switches for whatever entries this profile actually has, including
 * ones installed after the card was written.
 * @returns one entry per foldable row, in document order.
 */
export function roster(): RowInfo[] {
  const nav = findPanelNav(document as unknown as QueryRoot)
  if (nav === null) return []
  return rosterFrom(rowsOf(nav), config.keepLabels)
}

/**
 * The card's row list, computed from a row array instead of the live DOM.
 * @param rows - the nav's panel rows, in document order.
 * @param keepLabels - rows currently kept visible.
 * @returns one entry per sibling of the header, unnamed rows dropped.
 */
export function rosterFrom(rows: readonly ElementLike[], keepLabels: readonly string[]): RowInfo[] {
  const resolved = splitRows(rows, keepLabels)
  const header = resolved?.header
  return rows
    .filter((row) => row !== header)
    .map((row) => ({ label: labelOf(row), keep: isKept(labelOf(row), keepLabels) }))
    .filter((row) => row.label !== '')
}

/**
 * Fold the per-row switches into the stored keep list.
 *
 * The switch state IS the storage: switched-on rows are the kept ones, so a row
 * that disappeared from the sidebar drops out and a new row starts folded.
 * @param rows - the roster the card rendered.
 * @param label - the row whose switch moved.
 * @param next - its new state.
 * @returns the labels to write to `keepLabels`.
 */
export function deriveKeep(rows: readonly RowInfo[], label: string, next: boolean): string[] {
  return rows
    .filter((row) => (row.label === label ? next : row.keep))
    .map((row) => row.label)
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

/** Tell the card that the row inventory (or its keep flags) changed. */
function notifyRoster(rows: RowInfo[]): void {
  const key = rows.map((row) => `${row.label}:${row.keep ? 1 : 0}`).join('|')
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
 * Write the fold marks. Only attributes we own are touched: no host class,
 * no host attribute, and never the anchor's `aria-expanded` (that one is the
 * dropdown menu's state, not ours).
 */
function applyFold(): void {
  if (mount === null) return
  const rows = rowsOf(mount.nav)
  const plan = planFold(rows, config.keepLabels, currentFolded(), isRail(mount.nav))
  if (plan === null) return
  const { header } = plan
  if (header.getAttribute(ATTR.header) === null) header.setAttribute(ATTR.header, '')
  // Alignment is one nav-level mark with three rule sets behind it. Written on
  // every scan (and only when it differs) so a settings write repaints the row
  // content without a remount.
  const align = normalizeAlign(config.align)
  if (mount.nav.getAttribute(ATTR.align) !== align) mount.nav.setAttribute(ATTR.align, align)

  // The settings card renders whatever is on screen right now; keep it in sync.
  notifyRoster(rosterFrom(rows, config.keepLabels))

  // Nothing to fold (every sibling is kept): say so on the control instead of
  // flipping the arrow over an unchanged list — the first report of "arrow moves
  // but nothing collapses" was exactly this state, caused by a config write.
  ;(mount.toggle as HTMLElement).classList.toggle(CLS.toggleIdle, plan.idle)
  mount.toggle.setAttribute('aria-disabled', plan.idle ? 'true' : 'false')

  for (const row of rows) {
    const want = plan.folded.includes(row)
    // Touch an attribute only when it actually changes: every write is a
    // mutation, and every mutation triggers the rescan that caused this write.
    if (want && !row.getAttribute(ATTR.folded)) row.setAttribute(ATTR.folded, '')
    else if (!want && row.getAttribute(ATTR.folded) !== null) row.removeAttribute(ATTR.folded)
  }
  // The plan owns the idle case too: an idle control carries no state mark.
  if (plan.state !== null && mount.nav.getAttribute(ATTR.state) !== plan.state) mount.nav.setAttribute(ATTR.state, plan.state)
  else if (plan.state === null && mount.nav.getAttribute(ATTR.state) !== null) mount.nav.removeAttribute(ATTR.state)
  // A 36px rail has no room for a second 28px square: hand the row back to the host.
  ;(mount.toggle as HTMLElement).style.display = plan.toggleVisible ? 'inline-flex' : 'none'
  paintToggle(mount.toggle, { idle: plan.idle })
}
/** Toggle the group and persist the choice. */
function toggleFold(): void {
  // An empty group must not pretend to fold: ignore the gesture entirely.
  if (mount !== null) {
    const resolved = resolveNavGroup(mount.nav, config.keepLabels)
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
  const resolved = resolveNavGroup(nav, config.keepLabels)
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
  mount = null
}

/**
 * Install the fold and keep it installed across re-renders.
 * @param cfg - the effective configuration.
 * @returns a disposer that leaves the sidebar exactly as shipped.
 */
export function installFold(cfg: ConfigLike): () => void {
  config = { defaultFolded: cfg.defaultFolded, keepLabels: [...cfg.keepLabels], align: normalizeAlign(cfg.align) }
  readStored()
  sweep()
  let observer: MutationObserver | null = null
  let queued = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  const schedule = (): void => {
    if (queued) return
    queued = true
    setTimeout(() => {
      queued = false
      rescan()
    }, 16)
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
    observer = new MutationObserver(schedule)
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
 */
export function applyConfig(cfg: ConfigLike): void {
  config = { defaultFolded: cfg.defaultFolded, keepLabels: [...cfg.keepLabels], align: normalizeAlign(cfg.align) }
  for (const listener of Array.from(configListeners)) listener()
  applyFold()
}

/** The configuration the fold is currently running with (settings card reads it). */
export function effectiveConfig(): ConfigLike {
  return { defaultFolded: config.defaultFolded, keepLabels: [...config.keepLabels], align: normalizeAlign(config.align) }
}

/** Built-in defaults, used when a host serves no writable configuration surface. */
export const BUILTIN_CONFIG: ConfigLike = { defaultFolded: false, keepLabels: ['插件', 'Plugins'], align: 'start' }
