/**
 * verify.mjs —— 发布/打包门禁（prepack 触发）。
 *
 * 抓的是本插件族真实踩过的坑，不是仪式：
 *  - loader id ≠ 包名 → client 半整体静默失活；
 *  - 双清单不同号/不同串 → 装上了但被 peer 闸拒载，或装了旧号；
 *  - bundle 里出现模块请求 → 宿主禁面，装载期抛错；
 *  - 引用宿主 primitives → vendor 规范明文禁止；
 *  - 机器绝对路径泄漏 → 别人装不上。
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostPeerPackages, peerRange, supportedHosts } from './hosts.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const fail = []
const note = []

/** Read a file as UTF-8, reporting absence instead of throwing. */
async function text(rel) {
  try {
    return await readFile(join(root, rel), 'utf8')
  } catch {
    fail.push(`缺少文件: ${rel}`)
    return ''
  }
}

const pkg = JSON.parse(await text('package.json'))
const manifest = JSON.parse(await text('dsh.plugin.json'))
const clientBundle = await text('lib/client.js')
const hostEntry = await text('src/index.js')

// --- identity ---------------------------------------------------------------
if (pkg.name !== 'dsh-sidebar-fold') fail.push(`package.json name 异常: ${pkg.name}`)
if (manifest.id !== `dsh-external/${pkg.name}`) fail.push(`dsh.plugin.json id 应为 dsh-external/${pkg.name}，实为 ${manifest.id}`)
if (pkg.version !== manifest.version) fail.push(`版本号不同号: ${pkg.version} ≠ ${manifest.version}`)

// --- dual manifest enumeration ---------------------------------------------
for (const [label, value] of [
  ['package.json engines.dsh', pkg?.engines?.dsh],
  ['dsh.plugin.json engines.dsh', manifest?.engines?.dsh],
]) {
  if (value !== peerRange) fail.push(`${label} 与 hosts.mjs 枚举串不一致`)
}
for (const name of hostPeerPackages) {
  if (pkg?.peerDependencies?.[name] !== peerRange) fail.push(`peerDependencies[${name}] 未同串`)
}
const peerKeys = Object.keys(pkg?.peerDependencies ?? {}).sort().join(',')
const expectedKeys = [...hostPeerPackages].sort().join(',')
if (peerKeys !== expectedKeys) fail.push(`peerDependencies 集合漂移: ${peerKeys || '(空)'} ≠ ${expectedKeys}`)
for (const value of [pkg?.engines?.dsh, manifest?.engines?.dsh]) {
  for (const forbidden of ['>=', '<=', '^', '-0', '.x']) {
    if (typeof value === 'string' && value.includes(forbidden)) fail.push(`engines.dsh 含宽区间记法 '${forbidden}'`)
  }
}

// --- dsh declarations -------------------------------------------------------
const patch = await text('cordis.patch.yml')
if (!/- insert:\s*\n\s*-\s*id:\s*dsh-sidebar-fold/.test(patch)) fail.push('cordis.patch.yml 未插入本包自有 bundle 行')
if (pkg?.dsh?.bundle?.patch !== './cordis.patch.yml') fail.push('package.json dsh.bundle.patch 缺失或指错')
if (pkg?.dsh?.client?.platform !== 'web') fail.push('package.json dsh.client.platform 应为 web')
for (const dep of pkg?.dsh?.client?.inject ?? []) {
  if (!/^@deepseek-ai\/dsh-/.test(dep)) fail.push(`dsh.client.inject 只允许宿主包，发现 ${dep}`)
}
if (manifest?.client?.main !== './lib/client.js') fail.push('dsh.plugin.json client.main 应为 ./lib/client.js')
if (manifest?.main !== './src/index.js') fail.push('dsh.plugin.json main 应为 ./src/index.js')
if (pkg?.exports?.['./client'] !== './lib/client.js') fail.push('package.json exports["./client"] 应为 ./lib/client.js')
if (!hostEntry.includes('export const Config')) fail.push('宿主半未导出 Config（设置面无 schema 可投影）')
if (!hostEntry.includes('export function apply')) fail.push('宿主半未导出 apply')

// --- client bundle contract ------------------------------------------------
if (clientBundle) {
  const idMatch = clientBundle.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)
  if (idMatch === null) fail.push('lib/client.js 未经 window.__ModuleLoader__.load 注册')
  else if (idMatch[1] !== pkg.name) fail.push(`loader id ${idMatch[1]} ≠ 包名 ${pkg.name}（client 半会整体静默失活）`)
  if (!clientBundle.includes('exports.apply = apply;')) fail.push('bundle 未导出 apply')
  if (!clientBundle.includes('exports.inject = inject;')) fail.push('bundle 未导出 inject')
  // Shared module requests are allowed (a slot component must return a React
  // element); host packages are not — the vendor rule forbids loading them.
  const SHARED_ALLOWED = new Set(['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'cordis', '@deepseek-ai/cordis'])
  const requests = [...clientBundle.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
  const illegal = requests.filter((id) => !SHARED_ALLOWED.has(id))
  if (illegal.length > 0) fail.push(`bundle 含非共享模块请求: ${illegal.join(', ')}`)
  if (clientBundle.includes('dsh-client-ui-primitives')) fail.push('bundle 引用了宿主 primitives（vendor 禁面）')
  // The bundle is the shipped artifact: prove the fold actually reads the anchors
  // we measured, so a stale build can never ship silently.
  for (const marker of ['_panelList', '_panelRow', '_moreAnchor', '_collapsed']) {
    if (!clientBundle.includes(marker)) fail.push(`bundle 缺少锚点 ${marker}（产物可能过期，重跑 npm run build）`)
  }
}

// --- i18n ------------------------------------------------------------------
const localeDir = await readdir(join(root, 'locale')).catch(() => null)
if (localeDir === null) fail.push('缺少 locale/ 目录')
else {
  for (const lang of ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'it', 'ru', 'es']) {
    if (!localeDir.includes(`${lang}.json`)) fail.push(`locale/${lang}.json 缺失`)
  }
  if (!localeDir.includes('en.json')) fail.push('locale/en.json 是宿主扫描的必需锚')
}
const localesTs = await text('src/client/locales.ts')
const dictionaryCount = (localesTs.match(/^export const (zh|en|ja|ko|fr|de|it|ru|es):?/gm) ?? []).length
if (dictionaryCount !== 9) fail.push(`src/client/locales.ts 应含 9 部词典，实为 ${dictionaryCount}`)

// --- files[] completeness & portability -----------------------------------
const filesField = pkg.files ?? []
for (const entry of ['src/', 'lib/', 'locale/', 'cordis.patch.yml', 'dsh.plugin.json']) {
  if (!filesField.includes(entry)) fail.push(`files 缺 ${entry}（发布后将无该产物）`)
}
const absPat = /[A-Za-z]:[\\/](?:test|Users|deepseek-harness)[\\/]/
const walk = async (dir) => {
  const out = []
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'lib'].includes(entry.name) && dir === '.') continue
      out.push(...await walk(rel))
    } else if (/\.(ts|js|mjs|json|yml|yaml|md)$/.test(entry.name)) out.push(rel)
  }
  return out
}
for (const rel of [...(await walk('src')), 'README.md', 'README.zh.md', 'cordis.patch.yml', ...(await walk('scripts'))]) {
  const body = await readFile(join(root, rel), 'utf8').catch(() => '')
  if (absPat.test(body)) fail.push(`泄漏机器绝对路径: ${rel}`)
}

// --- report ---------------------------------------------------------------
note.push(`枚举 ${supportedHosts.length} 格 · 托管 peer ${hostPeerPackages.length} 只 · bundle ${clientBundle.length} chars`)
if (fail.length > 0) {
  console.error('verify FAILED:\n' + fail.map((line) => ` - ${line}`).join('\n'))
  process.exit(1)
}
console.log(`verify OK: ${note.join(' · ')}`)
