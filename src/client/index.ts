/**
 * Browser half of `dsh-sidebar-fold`.
 *
 * Activation shape (each rule is an incident lesson, not a preference):
 *  - the fold is mounted at the **top level** of `apply` and never waits on a
 *    service, so a host without the settings surface still folds;
 *  - the settings seat is registered at the top level too, inside its own guard:
 *    a missing seat must not take the fold down with it;
 *  - the two settings waists (`configForms` for 0.1.7+, `settingsScope` for
 *    ≤0.1.6) are declared through separate `ctx.inject` calls — naming one that
 *    a generation does not register would otherwise leave the whole fiber
 *    pending and the plugin silently inert.
 */
import { PKG_NAME } from './constants.ts'
import { applyConfig, BUILTIN_CONFIG, installFold, normalizeAlign, rescan } from './fold.ts'
import { createConfigCard, onFallback, onScope, type SettingsScopeLike } from './settings-card.ts'

/** Cordis services the client half reads. Only `slots` is unconditional. */
export const inject = ['slots']

/** A tolerant view of the client context: every face is probed, never assumed. */
interface ClientCtx {
  slots: {
    inject: (name: string, fn: () => unknown) => () => void
    register: (options: Record<string, unknown>, component: unknown) => () => void
  }
  inject?: (names: readonly string[], fn: (sctx: Record<string, any>) => void) => unknown
  effect?: (factory: () => () => void, label: string) => unknown
  get?: (name: string) => unknown
}

/** Fold + card wiring, run once the fold is installed. */
let disposer: (() => void) | null = null
/** Whether the fold found its anchors on the last scan (diagnostics only). */
let mountedNow = false

/** One guard per surface: a missing host face degrades that surface only. */
function safe(tag: string, fn: () => void): void {
  try {
    fn()
  } catch (error) {
    console.warn(`${PKG_NAME}: surface '${tag}' unavailable:`, error)
  }
}

/** Adopt a served snapshot, falling back to the built-ins when it says nothing. */
function adopt(scope: SettingsScopeLike): void {
  onScope(scope)
  const push = (): void => {
    const snap = scope.getSnapshot()
    const value = snap.value
    const next = {
      defaultFolded: typeof value?.defaultFolded === 'boolean' ? value.defaultFolded : BUILTIN_CONFIG.defaultFolded,
      keepLabels: Array.isArray(value?.keepLabels) ? value.keepLabels : BUILTIN_CONFIG.keepLabels,
      // Alignment is validated by `normalizeAlign` here so everything downstream
      // (fold marks, card radios) only ever sees one of the three known modes.
      align: normalizeAlign(typeof value?.align === 'string' ? value.align : BUILTIN_CONFIG.align),
    }
    onFallback(next)
    applyConfig(next)
  }
  push()
  scope.subscribe(push)
}

/**
 * Candidate namespaces for this bundle's served settings form.
 *
 * `ConfigForms.get(entryId)` keys forms by the *host plugin entry id*, and the
 * Plugin Manager only opens a form whose namespace appears in the served
 * `settings.describe` mirror. The entry id is the bundle row's id, which
 * `cordis.patch.yml` inserts as the package name; the scope-stripped variant is
 * tried as well because sibling plugins namespace their forms that way. Asking
 * for an unserved key is cheap (the form reports `unavailable`), so we probe
 * rather than guess, and adopt whichever key the host actually serves first.
 */
const NAMESPACE_CANDIDATES = [PKG_NAME, PKG_NAME.replace(/^dsh-/, '')]

/** Ask the host which of our candidate namespaces it serves, if any. */
function servedNamespace(forms: any): string | undefined {
  const mirror = forms.describe?.()
  const served = new Set((mirror?.getSnapshot()?.view?.namespaces ?? []).map((entry: { ns: string }) => entry.ns))
  return NAMESPACE_CANDIDATES.find((candidate) => served.has(candidate))
}

/**
 * Bind the two generations' settings waists, each behind its own inject.
 *
 * The `configForms` probe is **not** one-shot: the settings mirror is still
 * loading when a client half activates, so `view` can be `undefined` at that
 * instant. First smoke run proved the cost of probing once — the card rendered
 * read-only forever while the host was serving a writable, live-reloadable
 * namespace. So: subscribe to the mirror, kick it with `ensure()`, and keep a
 * bounded timer as a belt-and-braces retry.
 */
function bindSettingsWaists(ctx: ClientCtx): void {
  if (typeof ctx.inject !== 'function') return

  safe('configForms', () => {
    ctx.inject?.(['configForms'], (sctx) => {
      const forms = sctx.configForms
      if (forms === undefined) return
      let adopted = false
      let unsubscribe: (() => void) | undefined
      let tries = 0
      const attempt = (): void => {
        if (adopted) return
        try {
          const served = servedNamespace(forms)
          if (served === undefined) {
            forms.describe?.().ensure?.()
            return
          }
          adopted = true
          unsubscribe?.()
          adopt(forms.get(served))
        } catch (error) {
          console.warn(`${PKG_NAME}: configForms unreadable:`, error)
        }
      }
      try {
        unsubscribe = forms.describe?.().subscribe?.(attempt)
      } catch {
        // A mirror without a subscribe face still gets the timer below.
      }
      attempt()
      const timer = setInterval(() => {
        tries += 1
        attempt()
        if (adopted || tries > 40) clearInterval(timer)
      }, 250)
      if (adopted) clearInterval(timer)
    })
  })

  // ≤0.1.6: the imperative settings scope, same namespace family.
  safe('settingsScope', () => {
    ctx.inject?.(['settingsScope'], (sctx) => {
      try {
        const scope = sctx.settingsScope?.bind({ namespace: NAMESPACE_CANDIDATES[0] })
        if (scope !== undefined) adopt(scope)
      } catch (error) {
        console.warn(`${PKG_NAME}: settingsScope unreadable:`, error)
      }
    })
  })
}

/** Register the configuration card on this bundle's detail page. */
function mountConfigCard(ctx: ClientCtx): void {
  safe('plugins.bundle.config', () => {
    ctx.slots.inject('plugins.bundle.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.bundle.config',
          key: PKG_NAME,
          inject: () => ({}),
        },
        createConfigCard(),
      ),
    )
  })
}

/**
 * Activate the plugin.
 * @param ctx - the client context, narrowed to the faces this plugin probes.
 */
export function apply(ctx: ClientCtx): void {
  onFallback(BUILTIN_CONFIG)
  // `installFold` scans immediately and keeps an observer alive, so a sidebar
  // that mounts after boot is picked up without a second install call.
  disposer = installFold(BUILTIN_CONFIG)
  mountedNow = rescan()
  mountConfigCard(ctx)
  bindSettingsWaists(ctx)
  // One line so a silent failure is never silent: without this the sidebar simply
  // keeps its shipped shape and nothing says why. `mounted:false` means the
  // selectors missed (host DOM drifted) — see findings §7 for the fallback policy.
  console.info(`${PKG_NAME}: fold installed`, { mounted: mountedNow })

  ctx.effect?.(() => () => {
    disposer?.()
    disposer = null
    console.info(`${PKG_NAME}: fold removed`)
  }, `${PKG_NAME}: sidebar fold`)
}
