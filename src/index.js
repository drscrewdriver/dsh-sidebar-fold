/**
 * Host half of `dsh-sidebar-fold`.
 *
 * The plugin's behaviour lives entirely in the browser half (`lib/client.js`,
 * served through `exports["./client"]`): it folds the sidebar's add-on panel
 * rows under the shipped "More" row. This half therefore installs nothing and
 * owns no state — it exists so the profile row has an entry point, and it
 * declares the Config schema the settings form is projected from.
 *
 * Plain JS on purpose (the `dsh-session-guard` arrangement): the host half needs
 * no build step, so `dsh.plugin.json` points straight at `./src/index.js` and a
 * stale `lib/` can never shadow the served schema.
 *
 * Namespace discipline (verified against the shipped rc.3 browser half):
 * `ConfigForms.get(entryId)` keys forms by the *host plugin entry id*, and the
 * Plugin Manager page only opens a form whose namespace appears in the served
 * `settings.describe` mirror (`dsh-client-ui-plugin-manager/lib/client.js:3835`).
 * The entry id is the bundle row's id, which `cordis.patch.yml` inserts as this
 * package's name — so the client half reads its form under `name` below, and this
 * schema is what the host serves for it.
 */
import z from '@deepseek-ai/schemastery'

/** Profile row / settings namespace / module-loader id: one string, never drifted. */
export const name = 'dsh-sidebar-fold'

/** State a fresh window starts in when it has no local record yet. */
export const DEFAULT_FOLDED = false

/**
 * Rows kept visible while the group folds (zh first, because the sidebar renders
 * zh by default; en rides along so an English host behaves the same).
 *
 * Only the `插件` / `Plugins` entry is here on purpose: every other add-on row
 * (schedules, agent teams, markets, …) folds by default, and the user adjusts the
 * list from the settings card's per-row switches, which read the live sidebar.
 */
export const DEFAULT_KEEP_LABELS = ['插件', 'Plugins']

/**
 * Row-content alignment for the managed area: `start` | `center` | `end`.
 *
 * A plain string, not a closed union: schemastery's union builder is not the same
 * on every line this plugin supports, and the browser half already rejects an
 * unknown value through `normalizeAlign` (falling back to `start`, the shipped
 * layout). Keeping the schema primitive is what lets one Config serve
 * 0.1.0-rc.8 through 0.2.1-rc.3.
 */
export const DEFAULT_ALIGN = 'start'

/**
 * Whether THIS schemastery build knows `.volatile()`.
 *
 * 0.1.7+ projects a settings form out of the plugin's own Config, and only a
 * field marked volatile becomes editable there; dsh 0.1.5 ships schemastery
 * 3.18.2, which has no such method at all. Calling it unconditionally would
 * throw while this module LOADS — taking the whole plugin down on the older
 * line. Probe, never assume (the discipline dsh-paste-dock documents at
 * `src/index.ts:188-203`).
 */
const schemaVolatileCapable =
  typeof /** @type {{ volatile?: unknown }} */ (z.boolean()).volatile === 'function'

/** A live-editable field where the running line supports it, an ordinary one where not. */
function live(schema) {
  const box = /** @type {{ volatile?: () => typeof schema }} */ (schema)
  return typeof box.volatile === 'function' ? box.volatile() : schema
}

/**
 * The plugin's own Config — and, on dsh 0.1.7+, its settings surface.
 *
 * Both fields are volatile on purpose: the browser half re-reads the served
 * document through `configForms` and applies changes without a restart.
 */
export const Config = z.object({
  defaultFolded: live(z.boolean().default(DEFAULT_FOLDED)),
  // Rows kept visible while folding. Edited through the card's per-row switches,
  // which enumerate the live sidebar rather than asking the user to type labels.
  keepLabels: live(z.array(z.string()).default(DEFAULT_KEEP_LABELS)),
  // Icon + label alignment inside each managed row (`start` | `center` | `end`).
  align: live(z.string().default(DEFAULT_ALIGN)),
})

/**
 * Node-face apply. Intentionally empty: the fold lives in the browser.
 */
export function apply() {}
