/**
 * The "More" menu's shortcut row into this plugin's own settings.
 *
 * Why a slot row and not DOM surgery: the host's More menu is rendered by
 * `sidebar.panellist.actions`, so a registration lands in the same list, follows
 * the menu's own keyboard walk and its dismiss path, and survives re-renders
 * without an observer. (The host also documents this seat as the additive way to
 * reach a plugin's surface from the menu.)
 *
 * Where it lands: the shipped rows in that list are 「浏览更多插件 / 创建你的插件」,
 * preceded by their own hairline. A list entry can only be appended to that block,
 * so the row carries its own hairline and reads as the last item of the action
 * group — see the README note for what exact placement would cost.
 *
 * Navigation: `pluginNavigation.openBundle(pkg)` is the host's own intent
 * (`plugin-manager/lib/client.js`: selectPanel('plugins') + tab 'installed' +
 * view {kind:'package', name}), which is the page our config card is registered
 * on. Older lines that do not provide the service fall back to the panel itself.
 */
import { CLS, PKG_NAME } from './constants.ts'
import { pickDictionary } from './locales.ts'

/** The module-loader factory's `require`, injected by the host's module table. */
declare const require: (id: string) => any
// Named `menuReact`, not `react`: the build concatenates every module into one
// closure, and a second `const react` there is a duplicate declaration that kills
// the whole bundle (measured: the sidebar simply kept its shipped shape).
const menuReact: any = require('react')

/** The sliver of the client context this row needs to navigate. */
export interface MenuCtx {
  get?: (name: string) => unknown
}

/** The `pluginNavigation` face the host provides on 0.2.2 (`openList`/`openBundle`). */
interface PluginNavigation {
  openBundle?: (packageName: string) => void
  openList?: () => void
}

/** A panel-selector face, used only when `pluginNavigation` is absent. */
interface LayoutFace {
  selectPanel?: (id: string) => void
}

/**
 * The navigation face adopted through `ctx.inject` in `index.ts`.
 *
 * `ctx.get('pluginNavigation')` alone did not reach the service (measured: the
 * row fell back to the panel and the package page never opened), so the row is
 * handed the face by a scoped inject — the same arrangement the settings waists
 * use, which also keeps the plugin alive on lines that do not provide it.
 */
let navigationFace: PluginNavigation | undefined

/**
 * Adopt the host's `pluginNavigation` service when it shows up.
 * @param face - whatever the scoped inject resolved; anything unusable is ignored.
 */
export function adoptPluginNavigation(face: unknown): void {
  if (face === null || typeof face !== 'object') return
  const candidate = face as PluginNavigation
  if (typeof candidate.openBundle === 'function' || typeof candidate.openList === 'function') navigationFace = candidate
}

/**
 * Open this bundle's page in the Plugin Manager.
 *
 * Three routes, most precise first: the bundle itself, then the plugin list, then
 * the panel. Each is probed — none of them is a stable plugin API.
 * @param ctx - the client context the row was registered from.
 */
export function openPluginSettings(ctx: MenuCtx): void {
  let navigation: PluginNavigation | undefined = navigationFace
  try {
    navigation = navigation ?? (ctx.get?.('pluginNavigation') as PluginNavigation | undefined)
  } catch {
    navigation = navigation ?? undefined
  }
  if (typeof navigation?.openBundle === 'function') {
    navigation.openBundle(PKG_NAME)
    return
  }
  if (typeof navigation?.openList === 'function') {
    navigation.openList()
    return
  }
  let layout: LayoutFace | undefined
  try {
    layout = ctx.get?.('layout') as LayoutFace | undefined
  } catch {
    layout = undefined
  }
  layout?.selectPanel?.('plugins')
}

/** A sliders glyph, drawn here because the host `primitives` package is off-limits. */
function buildGlyph(): unknown {
  const svg = (props: Record<string, unknown>, children: unknown[]): unknown =>
    menuReact.createElement('svg', {
      width: 16,
      height: 16,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      ...props,
    }, ...children)
  return svg({ className: CLS.menuIcon }, [
    menuReact.createElement('path', { key: 'a', d: 'M2.5 5.5h11M2.5 10.5h11' }),
    menuReact.createElement('circle', { key: 'b', cx: 6, cy: 5.5, r: 1.6, fill: 'var(--dsw-alias-bg-layer-1)' }),
    menuReact.createElement('circle', { key: 'c', cx: 10.5, cy: 10.5, r: 1.6, fill: 'var(--dsw-alias-bg-layer-1)' }),
  ])
}

/**
 * Build the component for one `sidebar.panellist.actions` seat.
 *
 * The menu hands every registration the same owner props (`onDismiss` among
 * them), so the row closes the list before navigating — otherwise the menu would
 * stay open over the page it just opened.
 * @param ctx - the client context the row was registered from.
 * @returns a React component the slot can render.
 */
export function createSettingsRow(ctx: MenuCtx): (props: { onDismiss?: () => void }) => unknown {
  return function SidebarFoldSettingsRow(props: { onDismiss?: () => void }) {
    const dict = pickDictionary(document.documentElement.lang ?? '')
    const label = dict['menu.settings']
    return menuReact.createElement(
      'div',
      { className: CLS.menuGroup },
      menuReact.createElement(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: CLS.menuRow,
          title: label,
          'aria-label': label,
          onClick: () => {
            try {
              props?.onDismiss?.()
            } catch {
              // A menu that cannot close must not take the navigation with it.
            }
            openPluginSettings(ctx)
          },
        },
        buildGlyph(),
        menuReact.createElement('span', { className: CLS.menuText }, label),
      ),
    )
  }
}