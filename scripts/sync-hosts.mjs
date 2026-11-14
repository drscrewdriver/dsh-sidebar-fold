/**
 * sync-hosts.mjs —— 把 `scripts/hosts.mjs` 的声明串写进（或校验）三处声明面。
 *
 *   node scripts/sync-hosts.mjs            # 检查：漂移即 exit 1
 *   node scripts/sync-hosts.mjs --write    # 修复：以 hosts.mjs 为准重写
 *
 * 托管点位（2026-11-14 版本上下限改造后的形状）：
 *   1. package.json  engines.dsh          ← {@link enginesRange}（有界区间）
 *   2. package.json  peerDependencies[每只托管包] ← {@link peerRange}（逐 rc 枚举）
 *   3. dsh.plugin.json engines.dsh          ← {@link enginesRange}
 * engines 与 peer 不同串是故意的：engines 是注入声明（宿主带 includePrerelease
 * 判定），peer 是包管理器解析面（无 includePrerelease，必须枚举）。
 * 版本号点位（同号纪律）：package.json version === dsh.plugin.json version。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertHostPeers, enginesRange, hostPeerPackages, peerRange, supportedHosts } from './hosts.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const write = process.argv.includes('--write')

const pkgPath = join(root, 'package.json')
const manifestPath = join(root, 'dsh.plugin.json')
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

const drift = []

/** Compare one string slot against its expected declaration string. */
function check(label, actual, expected) {
  if (actual !== expected) drift.push(`${label}: ${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`)
}

check('package.json engines.dsh', pkg?.engines?.dsh, enginesRange)
check('dsh.plugin.json engines.dsh', manifest?.engines?.dsh, enginesRange)
for (const name of hostPeerPackages) {
  check(`package.json peerDependencies[${name}]`, pkg?.peerDependencies?.[name], peerRange)
}
try {
  assertHostPeers(pkg?.peerDependencies)
} catch (error) {
  drift.push(String(error.message ?? error))
}
if (pkg?.version !== manifest?.version) {
  drift.push(`版本号不同号: package.json ${pkg?.version} ≠ dsh.plugin.json ${manifest?.version}`)
}
// Guard the shapes on the way: engines.dsh must stay a bounded range and every
// host peer must stay an exact enumeration. Either one drifting to the other
// form silently breaks one of the two readers (see hosts.mjs header).
for (const [label, value] of [
  ['package.json engines.dsh', pkg?.engines?.dsh],
  ['dsh.plugin.json engines.dsh', manifest?.engines?.dsh],
]) {
  if (typeof value === 'string' && !value.startsWith('>=')) drift.push(`${label} 应为 '>=<下限> <上限' 区间记法`)
}
for (const name of hostPeerPackages) {
  const value = pkg?.peerDependencies?.[name]
  if (typeof value === 'string' && value.includes('>=')) drift.push(`peerDependencies[${name}] 必须保持逐 rc 枚举，不得改宽区间`)
}

if (drift.length === 0) {
  console.log(`sync-hosts OK: engines.dsh=${enginesRange}；peer 枚举 ${supportedHosts.length} rc`)
} else if (!write) {
  console.error('sync-hosts FAILED:\n' + drift.map((line) => ` - ${line}`).join('\n') + '\n（node scripts/sync-hosts.mjs --write 修复）')
  process.exit(1)
} else {
  pkg.engines ??= {}
  pkg.engines.dsh = enginesRange
  pkg.peerDependencies ??= {}
  for (const name of hostPeerPackages) pkg.peerDependencies[name] = peerRange
  manifest.engines ??= {}
  manifest.engines.dsh = enginesRange
  manifest.version = pkg.version
  // Key order is preserved; trailing newline matches npm's own writer.
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`sync-hosts written: engines.dsh=${enginesRange}；peer 枚举 ${supportedHosts.length} rc 已落到三处声明面`)
}
