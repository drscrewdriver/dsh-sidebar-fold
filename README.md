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
- **Three states per row (host 0.2.2 on)** — every row in the settings card picks one of
  **Show** (always visible), **Fold** (may be folded) or **Hide in More** (hand the row to the
  host's own “More” list, i.e. its unpin action). A hidden row leaves the column and appears
  in the “More” menu, from where the host's own pin control brings it back; the plugin
  reconciles both sides on boot, on a config write and on every sidebar repaint — including
  after a reload, where the host's in-memory pin table comes back empty.
- **Configurable** — default state, the three-state row controls and the row alignment live
  in the plugin's settings card (host `Config`, `.volatile()`, applied without a restart).
- **Rail-safe** — when the sidebar is collapsed to the 36 px icon rail the toggle is
  removed and every row is shown again: no squeezing, no half-hidden state.
- **Quiet degradation** — if the host DOM drifts and the anchors are not found, the
  plugin stays out of the way instead of breaking the sidebar (`dsh-sidebar-fold:
  fold installed { mounted: false }` in the console tells you it happened).

## Screenshots

Expanded, rows centred — the toggle sits on the More row and the add-on rows are listed:

![expanded and centre-aligned](assets/middle.png)

Folded — only the plugin row and the More row remain:

![folded](assets/fold.png)

## Install

```sh
# npm channel (after release)
dsh plugin --profile <profile> add dsh-sidebar-fold

# local build
npm run build && npm run verify
npm pack --pack-destination .
dsh plugin --profile <profile> add ./dsh-sidebar-fold-0.1.2.tgz
```

Then add `dsh-sidebar-fold` to the profile's `dsh.profile.bundles` list (or
enable the bundle in the app) and restart. On the desktop profile, quit the Electron
app before editing its `package.json` — the running app rewrites that file and rolls
external edits back.

## Settings

Open **Plugins → dsh-sidebar-fold** (the card is registered on the
`plugins.bundle.config` seat, keyed by the package name), or click
**“Sidebar fold settings” at the bottom of the sidebar's “More” menu**: that row sits in
the `sidebar.panellist.actions` seat and jumps with the host's own
`pluginNavigation.openBundle(package)`, so it shares the menu's keyboard walk and dismiss
path; a host without that service falls back to selecting the Plugins panel.

| Field | Meaning | Default |
|---|---|---|
| Folded by default | State a window starts in when it has no local record | off |
| Row alignment | Three-way segmented control (left / centre / right) for the managed rows; the “More” row follows the same setting | left |
| Entries (one per row) | **Show** = always visible; **Fold** = may be folded (default); **Hide in More** = move it into the host's “More” menu | Fold |

The row list is read from the DOM at open time, so a panel installed later shows up
without editing anything. When every row is set to Show the toggle dims itself and
reports `aria-disabled="true"` instead of flipping an arrow over an unchanged list.

“Hide in More” needs the 0.2.2 row structure (`div._panelEntry` plus the in-row pin
control): on the 0.2.1 line that one segment is disabled in the card while the other two
keep working. The host's pin table is **in memory only** (a reload starts empty), so the
plugin reconciles on every scan: a row that should be hidden but is still in the column
gets its unpin control clicked, and a hidden label whose row came back is dropped from
the hide list.

## Development

```sh
npm run build        # scripts/build-client.mjs -> lib/client.js (module-loader bundle)
npm run verify       # gate: loader id === package name, dual-manifest same string,
                     #       no module request, no host primitives, 10 locales, no
                     #       machine-absolute paths
npm test             # node --test on the pure seams (header split, nav fallback chain)
npm run hosts:check  # enumeration drift vs scripts/hosts.mjs (--write to repair)
```

`prepack` runs build + verify, so a stale `lib/client.js` cannot be published.

## Releases

Releases are published by CI from a pushed tag; the local side only bumps and tags:

```sh
npm run ci                              # 1 the gate, run locally first
# 2 bump package.json AND dsh.plugin.json to the same number
# 3 add the new version section at the top of CHANGELOG.md
git commit -am "release(0.1.14): ..."   # 4 version and changes in one commit
git tag v0.1.14                         # 5 the tag points at that commit
git push origin main v0.1.14            # 6 pushing the tag is the trigger
```

`.github/workflows/release.yml` then does the rest: version alignment (tag / package.json /
`dsh.plugin.json`), dependency install, the gate, `npm pack --dry-run`, an idempotency guard
(`npm view <pkg>@<ver>`), `npm publish`, `dsh-*` line-tag sync with read-side retry, and the
GitHub Release carrying the `Latest` badge.

Two properties worth knowing before you tag:

- **Dry run first.** `gh workflow run release.yml -f tag=vX -f dry_run=true` runs every step
  except publish / line-tag sync / Release, so a broken gate is found while the version is
  still unpublished.
- **Re-publishing is idempotent.** If the version already exists in the registry the job skips
  the publish block and warns instead of failing, so re-dispatching the same tag is safe.
  A line-tag sync failure only warns (publish has already succeeded) and the job summary
  prints the local repair command.

Release notes are built by `scripts/release-notes.mjs`: `RELEASE-NOTES-v<ver>.md` > the version
section of `CHANGELOG.md` > the tag message, with a minimum body length so that an empty shell
cannot be published.

## Supported hosts

**DSH hosts `>=0.2.1-rc.3 <0.3.0`** (the "More" row first ships in 0.2.1-rc.3; newer 0.2.x rcs stay installable without a republish). Single source of truth: `scripts/hosts.mjs` — `engines.dsh` carries that bounded range, `peerDependencies` keep the per-rc enumeration (npm resolution never assumes `includePrerelease`), and `dsh.plugin.json` mirrors the range; all generated, never hand-edited.

Why the floor is 0.2.1-rc.3: mounting needs the sidebar's panel list **and** the shipped "More"
row. Measured on every published `dsh-client-ui-sidebar` rc:

| host line | panel list | "More" row | row wrapper / in-row pin control |
|---|---|---|---|
| 0.1.0-rc.8 / 0.1.1-rc.2 / 0.1.2-rc.1 | no | no | — |
| 0.1.5-rc.3 / 0.1.7-rc.2 / 0.2.0-rc.2 | yes | no | — |
| 0.2.1-rc.1 / 0.2.1-rc.2 | yes | no | — |
| 0.2.1-rc.3 | yes | yes | no |
| 0.2.2-rc.3 (DOM-verified 2026-11-14) | yes | yes | **yes** (`div._panelEntry` + `button._panelUnpin`, `button._pinButton` inside the menu) |

On a line without the More row the plugin degrades quietly — it injects nothing and
leaves the sidebar as shipped. Declaring such a host would only install a plugin
that does nothing.

**Two measured differences on the 0.2.2 line** (both verified on 0.2.2-rc.3):

1. A row is wrapped in `div._panelEntry` and carries the host's own unpin control. The fold
   mark therefore has to land on the **wrapper**: hiding only the inner `button._panelRow`
   left a 32 px empty slot (plus a pin that appears on hover) behind — the real regression
   v0.1.6 showed on newer hosts.
2. The host's unpin action *is* “hide in More”: an unpinned row is filtered out of the nav
   and rendered by `sidebar.panellist.actions` into the “More” menu (each row with a
   pin-back control). That pin table is in-memory and never persisted, so the plugin keeps
   two label lists (`keepLabels` / `hideLabels`) as the source of truth and reconciles.

After a host upgrade, re-run the browser smoke test before widening this list:
CSS-module hashes drift every build (rc.2 emitted `wtg9ga_`, the 0.2.1/0.2.2 rc.3 runtimes
emit `hHd-Xa_`), so only the fragment selectors (`_panelList`, `_panelRow`, `_moreAnchor`,
`_collapsed`, `_panelEntry`, `_panelUnpin`, `_pinButton`) are stable.

## Upgrade guardrail

Host CSS-module hashes drift per build (`wtg9ga_` on rc.2 → `hHd-Xa_` on the 0.2.1/0.2.2
rc.3 runtimes), which is why every selector matches a *fragment* (`_panelList`, `_panelRow`,
`_moreAnchor`, `_collapsed`, `_panelEntry`, `_panelUnpin`, `_pinButton`). **After any host
upgrade, re-run the browser smoke** before assuming the three paths still hold: the fold
mount, the three-state write, and hide/pin-back. The plugin degrades quietly (or disables
one segment) by design, so a regression shows up as “nothing happened”, not as an error.

## Layout

```
src/index.js              host half: Config schema + no-op apply (no build step)
src/client/constants.ts   measured anchors, attribute marks, injected stylesheet
src/client/locales.ts     10 runtime dictionaries (zh = key-set source of truth)
src/client/fold.ts        nav location, header/group split, toggle mount, fold state
src/client/settings-card.ts  the bundle-page configuration card (plain DOM)
src/client/index.ts       apply: fold first, then the guarded settings waists
scripts/                  build-client / verify / sync-hosts / hosts / gen-locale-meta
```

## License

MIT
