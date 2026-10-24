/**
 * Browser-half constants: the anchors this plugin reads and the surfaces it owns.
 *
 * Every selector here is measured against the shipped rc.3 runtime (host-farm
 * `0.2.1-rc.3`, http://127.0.0.1:3093) and quoted from `dsh-client-ui-sidebar`
 * `lib/client.js`. CSS-module hashes drift per build — rc.2 emitted `wtg9ga_`,
 * the rc.3 runtime emits `hHd-Xa_` — so all class matching uses the *fragment*
 * after the underscore and never a full class name.
 */

/** Package name / settings namespace / module-loader id (must equal package.json `name`). */
export const PKG_NAME = 'dsh-sidebar-fold'

/** One style tag, identified by the same convention the host uses for its own injected CSS. */
export const STYLE_TAG_ID = `${PKG_NAME}/SidebarFold.css`

/** Prefix for every class this plugin owns. */
export const CLS = Object.freeze({
  toggle: 'dshsf-fold-toggle',
  toggleIdle: 'dshsf-fold-idle',
  icon: 'dshsf-fold-icon',
  card: 'dshsf-card',
  cardHost: 'dshsf-card-host',
  row: 'dshsf-row',
  rowMain: 'dshsf-row-main',
  label: 'dshsf-label',
  hint: 'dshsf-hint',
  control: 'dshsf-control',
  switch: 'dshsf-switch',
  switchKnob: 'dshsf-switch-knob',
  segmentGroup: 'dshsf-segment-group',
  segment: 'dshsf-segment',
})

/**
 * Alignment of a panel row's content (icon + label) inside the row.
 *
 * `start` is the host's own layout and is applied as a no-op-ish value (the nav
 * still carries the attribute so the CSS can stay declarative). `center` and
 * `end` are ours: the host row is `display:flex` with `justify-content:normal`
 * and the title does not stretch (`flex:0 1 auto`, measured on rc.3), so moving
 * the pair only takes one `justify-content` override.
 */
export const ALIGN_MODES = Object.freeze(['start', 'center', 'end'] as const)

/** One of {@link ALIGN_MODES}. */
export type AlignMode = (typeof ALIGN_MODES)[number]

/** Attribute marks this plugin writes (and removes on dispose). */
export const ATTR = Object.freeze({
  /** On the nav: the fold header, i.e. the shipped "More" row. */
  header: 'data-dshsf-header',
  /** On the nav: `folded` while the group is collapsed. */
  state: 'data-dshsf-state',
  /** On a panel row taken into the fold. */
  folded: 'data-dshsf-folded',
  /** On every element this plugin created — the dispose sweep key. */
  own: 'data-dshsf-own',
  /** On the nav: row-content alignment (`start` | `center` | `end`). */
  align: 'data-dshsf-align',
})

/** Selector fragments (hash-tolerant). */
export const SEL = Object.freeze({
  /** The panel-list `<nav>` and a collapsed rail's root carry these. */
  panelList: '[class*="_panelList"]',
  panelRow: 'button[class*="_panelRow"]',
  panelTitle: '[class*="_panelTitle"]',
  /** The `Menu` host element wrapping the "More" anchor: our toggle's parent. */
  moreAnchor: '[class*="_moreAnchor"]',
  /** Sidebar root modifier present exactly while the column is a narrow rail. */
  collapsed: '[class*="_collapsed"]',
})

/** `localStorage` key for the open/closed state (window-level UI state, by design). */
export const STORAGE_KEY = `${PKG_NAME}.v1.folded`

/** Accessible-name strings of the shipped "More" row (`client.js:528-544` zh/en dictionaries). */
export const MORE_LABELS = Object.freeze(['更多', 'More'])

/** Accessible-name strings of the "Global panels" nav label (`client.js:533`). */
export const PANELS_LABELS = Object.freeze(['全局面板', 'Global panels'])

/** Self-drawn chevron geometry: the host `primitives` package is off-limits to plugins. */
export const ICON_PATH = Object.freeze({
  up: 'M3.5 10 8 5.5 12.5 10',
  down: 'M3.5 6 8 10.5 12.5 6',
})

/** Measured host geometry this plugin matches instead of inventing (findings §2.6). */
export const TOGGLE_PX = 28
export const ICON_PX = 16

/** The CSS this plugin injects. Tokens are host-public aliases only; the anchor
 *  override keeps the row's height so the portal menu's anchor box is unchanged.
 *
 *  Every rule is one joined string built from an explicit declaration list — the
 *  first smoke run shipped a sheet whose declarations ran together (no `;`),
 *  so `transform`/`cursor`/`padding` were all dropped and the toggle sat 14px low.
 *  Declarations are joined here, never by string concatenation across lines. */
const rule = (selector: string, declarations: string[]): string =>
  `${selector}{${declarations.join(';')}}`

export const SHEET = [
  // The header keeps `position:relative` so the toggle (a sibling inside the
  // Menu's anchor span) is positioned against the row, not the span.
  //
  // Its horizontal padding is per alignment: at `start` the toggle sits on the
  // right and needs a gutter; at `center` the gutter would push the labeled pair
  // off-centre (measured +19px), so the padding has to be symmetric; at `end` the
  // toggle mirrors to the left and the gutter moves with it. `padding-top/bottom`
  // from the host (`7px 8px`) is untouched by these longhands.
  rule(`[${ATTR.header}]`, ['position:relative']),
  rule(`[${ATTR.align}="start"] [${ATTR.header}]`, [`padding-right:${TOGGLE_PX + 10}px`]),
  rule(`[${ATTR.align}="center"] [${ATTR.header}]`, ['padding-left:8px', 'padding-right:8px']),
  rule(`[${ATTR.align}="end"] [${ATTR.header}]`, [`padding-left:${TOGGLE_PX + 10}px`, 'padding-right:8px']),
  rule(`[${ATTR.align}="end"] .${CLS.toggle}`, ['left:4px', 'right:auto']),
  // Row-content alignment. The whitespace after `:` is deliberate — a bare
  // `center!important` is a parse error in some engines and silently dropped.
  rule(`[${ATTR.align}="center"] ${SEL.panelRow}`, ['justify-content: center !important']),
  rule(`[${ATTR.align}="end"] ${SEL.panelRow}`, ['justify-content: flex-end !important']),
  rule(`.${CLS.toggle}`, [
    'position:absolute',
    'right:4px',
    'top:50%',
    'transform:translateY(-50%)',
    'box-sizing:border-box',
    `width:${TOGGLE_PX}px`,
    `height:${TOGGLE_PX}px`,
    'border:0',
    'padding:0',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'border-radius:var(--dsw-radius-sm,6px)',
    'background:transparent',
    'color:var(--dsw-alias-label-secondary,currentColor)',
    'cursor:pointer',
    '-webkit-app-region:no-drag',
  ]),
  rule(`.${CLS.toggle}:hover`, ['background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))']),
  rule(`.${CLS.toggleIdle}`, ['opacity:.45', 'cursor:default']),
  rule(`.${CLS.toggleIdle}:hover`, ['background:transparent']),
  rule(`.${CLS.toggle}:focus-visible`, [
    'outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#666))',
    'outline-offset:-2px',
  ]),
  rule(`.${CLS.icon}`, ['display:inline-flex', 'align-items:center', 'justify-content:center']),
  rule(`[${ATTR.state}="folded"] [${ATTR.folded}]`, ['display:none']),
  // Settings card (bundle detail page): spacing only, colours come from tokens.
  rule(`.${CLS.card}`, ['display:flex', 'flex-direction:column', 'gap:12px', 'min-width:0']),
  rule(`.${CLS.cardHost}`, ['display:block', 'min-width:0', 'width:100%']),
  rule(`.${CLS.row}`, ['display:flex', 'align-items:flex-start', 'justify-content:space-between', 'gap:16px']),
  rule(`.${CLS.rowMain}`, ['display:flex', 'flex-direction:column', 'gap:2px', 'min-width:0']),
  rule(`.${CLS.label}`, ['font-size:13px', 'line-height:20px']),
  rule(`.${CLS.hint}`, ['font-size:12px', 'line-height:16px', 'opacity:.72']),
  rule(`.${CLS.control}`, [
    'box-sizing:border-box',
    'flex:none',
    'font:inherit',
    'font-size:13px',
    'padding:4px 8px',
    'border-radius:8px',
    'border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35))',
    'background:var(--dsw-specific-input-major,transparent)',
    'color:inherit',
    'max-width:280px',
  ]),
  rule(`.${CLS.control}[type="checkbox"]`, ['width:16px', 'height:16px', 'margin-top:3px']),
  // Pill switch (the shape this plugin family uses for on/off rows): the track is
  // 36×20, the knob 16px, and the whole thing is a real button with role="switch".
  rule(`.${CLS.switch}`, [
    'position:relative',
    'display:inline-block',
    'flex:none',
    'box-sizing:border-box',
    'width:36px',
    'height:20px',
    'margin-top:2px',
    'border:0',
    'padding:0',
    'border-radius:999px',
    'background:var(--dsw-alias-border-l3,rgba(127,127,127,.35))',
    'cursor:pointer',
    'transition:background .15s ease',
  ]),
  rule(`.${CLS.switch}[aria-checked="true"]`, ['background:var(--dsw-alias-state-business-primary,#4d6bfe)']),
  rule(`.${CLS.switch}[disabled]`, ['opacity:.5', 'cursor:default']),
  rule(`.${CLS.switch}:focus-visible`, [
    'outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#666))',
    'outline-offset:2px',
  ]),
  rule(`.${CLS.switchKnob}`, [
    'position:absolute',
    'top:2px',
    'left:2px',
    'width:16px',
    'height:16px',
    'border-radius:50%',
    'background:#fff',
    'box-shadow:0 1px 2px rgba(0,0,0,.2)',
    'transition:transform .15s ease',
    'pointer-events:none',
  ]),
  rule(`.${CLS.switch}[aria-checked="true"] .${CLS.switchKnob}`, ['transform:translateX(16px)']),
  // Segmented control (three-state alignment): a track holding one button per
  // option, the chosen one raised. Same family shape as the pill switch above.
  rule(`.${CLS.segmentGroup}`, [
    'display:inline-flex',
    'flex:none',
    'gap:2px',
    'padding:2px',
    'border-radius:9px',
    'background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))',
  ]),
  rule(`.${CLS.segment}`, [
    'border:0',
    'background:transparent',
    'border-radius:7px',
    'padding:3px 10px',
    'font:inherit',
    'font-size:12px',
    'line-height:16px',
    'color:var(--dsw-alias-label-secondary,inherit)',
    'cursor:pointer',
  ]),
  rule(`.${CLS.segment}[aria-checked="true"]`, [
    'background:var(--dsw-alias-bg-layer-1,#fff)',
    'color:var(--dsw-alias-label-primary,inherit)',
    'box-shadow:0 1px 2px rgba(0,0,0,.12)',
  ]),
  rule(`.${CLS.segment}[disabled]`, ['opacity:.5', 'cursor:default']),
  rule(`.${CLS.segment}:focus-visible`, [
    'outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#666))',
    'outline-offset:1px',
  ]),
].join('')
