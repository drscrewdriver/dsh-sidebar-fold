# dsh-sidebar-fold

[![npm version](https://img.shields.io/npm/v/dsh-sidebar-fold?color=4d6bfe)](https://www.npmjs.com/package/dsh-sidebar-fold)
[![license](https://img.shields.io/npm/l/dsh-sidebar-fold)](https://github.com/drscrewdriver/dsh-sidebar-fold/blob/main/LICENSE)

Collapse the DSH sidebar's add-on entries into the shipped **“More”** row.

The left column's *Global panels* list grows with every installed plugin: schedules,
agent teams, the plugin market, context pages, … `dsh-sidebar-fold` puts a
**28×28 square arrow toggle** on the right end of the host's “More” row. One click
folds those add-on rows away so only the “More” line remains; the arrow flips from
▲ (can collapse) to ▼ (can expand) and a second click brings the rows back.

- **Non-invasive** — a client plugin that only adds DOM. The host bundle is never
  patched, nothing in `app.asar` is touched, and uninstalling restores the sidebar
  exactly as shipped (own `<style>` tag and `data-dshsf-*` marks removed).
- **Structural header detection** — the header row is the `panelRow` carrying
  `aria-haspopup="menu"` inside the “Global panels” nav, which is locale-independent
  and independent of plugin registration order.
- **State per window** — the folded/open choice persists in `localStorage`, so a
  reload keeps it.
- **Alignment switch** — the managed rows (the “More” row included) can put their
  icon + label pair **left / centred / right**. At `right` the toggle mirrors to the
  row's left end so it never covers the text; the override is a single
  `justify-content` longhand and leaves the row's `display`/`gap`/height alone.
- **Configurable** — default state, the kept-visible rows and the row alignment live
  in the plugin's settings card (host `Config`, `.volatile()`, applied without a
  restart).
- **Rail-safe** — when the sidebar is collapsed to the 36 px icon rail the toggle is
  removed and every row is shown again: no squeezing, no half-hidden state.
- **Quiet degradation** — if the host DOM drifts and the anchors are not found, the
  plugin stays out of the way instead of breaking the sidebar (`dsh-sidebar-fold:
  fold installed { mounted: false }` in the console tells you it happened).

## Install

```sh
# npm channel (after release)
dsh plugin --profile <profile> add dsh-sidebar-fold

# local build
npm run build && npm run verify
npm pack --pack-destination .
dsh plugin --profile <profile> add ./dsh-sidebar-fold-0.1.1.tgz
```

Then add `dsh-sidebar-fold` to the profile's `dsh.profile.bundles` list (or
enable the bundle in the app) and restart. On the desktop profile, quit the Electron
app before editing its `package.json` — the running app rewrites that file and rolls
external edits back.

## Settings

Open **Plugins → dsh-sidebar-fold** (the card is registered on the
`plugins.bundle.config` seat, keyed by the package name):

| Field | Meaning | Default |
|---|---|---|
| Folded by default | State a window starts in when it has no local record | off |
| Row alignment | Three-way segmented control (left / centre / right) for the managed rows; the “More” row follows the same setting | left |
| Entries kept visible | **One switch per row read from the live sidebar** — switch a row on to keep it visible while the rest fold | only `插件` / `Plugins` |

The row list is read from the DOM at open time, so a panel installed later shows up
without editing anything. When every row is switched on the toggle dims itself and
reports `aria-disabled="true"` instead of flipping an arrow over an unchanged list.

## Development

```sh
npm run build        # scripts/build-client.mjs -> lib/client.js (module-loader bundle)
npm run verify       # gate: loader id === package name, dual-manifest same string,
                     #       no module request, no host primitives, 9 locales, no
                     #       machine-absolute paths
npm test             # node --test on the pure seams (header split, nav fallback chain)
npm run hosts:check  # enumeration drift vs scripts/hosts.mjs (--write to repair)
```

`prepack` runs build + verify, so a stale `lib/client.js` cannot be published.

## Supported hosts

**DSH 0.2.1-rc.3 only.** Single source of truth: `scripts/hosts.mjs` (the three
declarations — `engines.dsh`, `peerDependencies`, `dsh.plugin.json` — are generated
from it and must not be edited by hand).

Why not wider: mounting needs the sidebar's panel list **and** the shipped "More"
row. Measured on every published `dsh-client-ui-sidebar` rc:

| host line | panel list | "More" row |
|---|---|---|
| 0.1.0-rc.8 / 0.1.1-rc.2 / 0.1.2-rc.1 | no | no |
| 0.1.5-rc.3 / 0.1.7-rc.2 / 0.2.0-rc.2 | yes | no |
| 0.2.1-rc.1 / 0.2.1-rc.2 | yes | no |
| **0.2.1-rc.3** | yes | **yes** |

On a line without the More row the plugin degrades quietly — it injects nothing and
leaves the sidebar as shipped. Declaring such a host would only install a plugin
that does nothing.

After a host upgrade, re-run the browser smoke test before widening this list:
CSS-module hashes drift every build (rc.2 emitted `wtg9ga_`, rc.3 emits `hHd-Xa_`),
so only the fragment selectors (`_panelList`, `_panelRow`, `_moreAnchor`,
`_collapsed`) are stable.

## Upgrade guardrail

Host CSS-module hashes drift per build (`wtg9ga_` on rc.2 → `hHd-Xa_` on the rc.3
runtime), which is why every selector matches a *fragment* (`_panelList`, `_panelRow`,
`_moreAnchor`, `_collapsed`). **After any host upgrade, re-run the browser smoke**
before assuming the fold still mounts; the plugin degrades silently by design, so a
regression shows up as “nothing happened”, not as an error.

## Layout

```
src/index.js              host half: Config schema + no-op apply (no build step)
src/client/constants.ts   measured anchors, attribute marks, injected stylesheet
src/client/locales.ts     9 runtime dictionaries (zh = key-set source of truth)
src/client/fold.ts        nav location, header/group split, toggle mount, fold state
src/client/settings-card.ts  the bundle-page configuration card (plain DOM)
src/client/index.ts       apply: fold first, then the guarded settings waists
scripts/                  build-client / verify / sync-hosts / hosts / gen-locale-meta
```

## License

MIT
