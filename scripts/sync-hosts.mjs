/**
 * sync-hosts.mjs —— 把 `scripts/hosts.mjs` 的枚举串写进（或校验）三处声明面。
 *
 *   node scripts/sync-hosts.mjs            # 检查：漂移即 exit 1
 *   node scripts/sync-hosts.mjs --write    # 修复：以 hosts.mjs 为准重写
 *
 * 托管点位（同串纪律，见 dsh-plugin-peer-adapt §双清单）：
 *   1. package.json  engines.dsh
 *   2. package.json  peerDependencies[每只托管包]
 *   3. dsh.plugin.json engines.dsh
 * 版本号点位（同号纪律）：package.json version === dsh.plugin.json version。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertHostPeers, hostPeerPackages, peerRange, supportedHosts } from './hosts.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const write = process.argv.includes('--write')

const pkgPath = join(root, 'package.json')
const manifestPath = join(root, 'dsh.plugin.json')
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

const drift = []

/** Compare one string slot against the frozen enumeration. */
function check(label, actual) {
  if (actual !== peerRange) drift.push(`${label}: ${JSON.stringify(actual)} ≠ 枚举串 ${JSON.stringify(peerRange)}`)
}

check('package.json engines.dsh', pkg?.engines?.dsh)
check('dsh.plugin.json engines.dsh', manifest?.engines?.dsh)
for (const name of hostPeerPackages) check(`package.json peerDependencies[${name}]`, pkg?.peerDependencies?.[name])
try {
  assertHostPeers(pkg?.peerDependencies)
} catch (error) {
  drift.push(String(error.message ?? error))
}
if (pkg?.version !== manifest?.version) {
  drift.push(`版本号不同号: package.json ${pkg?.version} ≠ dsh.plugin.json ${manifest?.version}`)
}
// Guard the "no wide range" rule on the way: a range never satisfies the exact
// enumeration string, so a hand-edit to `>=x` shows up here even if both lists
// were left in sync with each other.
for (const [label, value] of [
  ['package.json engines.dsh', pkg?.engines?.dsh],
  ['dsh.plugin.json engines.dsh', manifest?.engines?.dsh],
]) {
  for (const forbidden of ['>=', '<=', '^', ' - ', '.x', '-0']) {
    if (typeof value === 'string' && value.includes(forbidden)) drift.push(`${label} 含宽区间记法 '${forbidden}'`)
  }
}

if (drift.length === 0) {
  console.log(`sync-hosts OK: ${supportedHosts.length} rc 同串（${peerRange}）`)
} else if (!write) {
  console.error('sync-hosts FAILED:\n' + drift.map((line) => ` - ${line}`).join('\n') + '\n（node scripts/sync-hosts.mjs --write 修复）')
  process.exit(1)
} else {
  pkg.engines ??= {}
  pkg.engines.dsh = peerRange
  pkg.peerDependencies ??= {}
  for (const name of hostPeerPackages) pkg.peerDependencies[name] = peerRange
  manifest.engines ??= {}
  manifest.engines.dsh = peerRange
  manifest.version = pkg.version
  // Key order is preserved; trailing newline matches npm's own writer.
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`sync-hosts written: ${supportedHosts.length} rc 同串已落到三处声明面`)
}
