/**
 * check-surface-classes.mjs — 设置面样式闸（zero-dep，可拷进任何 DSH 插件仓）。
 *
 * 为什么存在：manage-session 2.0.26 的列数分段钮 `dms_seg` / `dms_segBtn` /
 * `dms_segBtnOn` 三个类在 JSX 里用了，样式串里一个都没定义 —— 控件渲染出来
 * 是裸 `<button>`，视觉上「设置面样式全烂」，但 typecheck/build/单测全绿。
 * 这类漏定义的类名**没有任何现有闸能抓到**：CSS 不是 TS 类型的一部分。
 *
 * 用法（插件仓根）：
 *   node scripts/check-surface-classes.mjs                 # 自动探测扫描目录
 *   node scripts/check-surface-classes.mjs --dir .         # 指定根目录（单文件 JS 仓用）
 *   node scripts/check-surface-classes.mjs --list          # 列出每个类的定义/使用情况
 *   node scripts/check-surface-classes.mjs --prefix dms_   # 只查本插件前缀
 *   node scripts/check-surface-classes.mjs --allow foo,bar # 放行宿主/第三方注入类
 *
 * 自动探测顺序（第一个存在的就用）：src/client → client/src → src → 仓根
 * 单文件 JS 仓（如 dsh-progress-union：只有 client.js / index.js）走最后一档，
 * 由 --ext 控制扫哪些扩展名（缺省 .ts,.tsx,.js,.jsx,.mjs,.css）。
 *
 * 退出码：0 = 无漏定义；1 = 有漏定义（列出文件:类名）；2 = 参数/路径错误。
 *
 * 判据：
 *   1. 收集目标目录下源码里 `className: '...'` / `` className: `...` ``
 *      的**静态**类名片段（反引号里的 `${...}` 插值单独按「前缀族」判定）。
 *   2. 收集同一批文件里所有 `.类名` 定义（兼容 `const CSS = ['.a{...}'].join('')`
 *      与 `<style>` 文本块两种形态）。
 *   3. 差集非空 → 失败。
 *
 * ⚠ 已知覆盖边界（别把它当全覆盖闸）：
 *   · `className={`x${on ? ' hidden' : ''}`}` —— 插值**内部**的字面量 `hidden`
 *     扫不到。条件类名请写成两个完整分支（`on ? 'x hidden' : 'x'`）。
 *   · 只查 `className:` 键；`class=`、`clsx(...)`、`css.xxx`（CSS Modules 的
 *     类型由 TS 保证）不参与，必要时用 --allow。
 *   · **不检查样式注入的位置与时机**——那是另一类故障（样式定义齐全却全素），
 *     见 references/settings-surface-wiring.md §4.4「样式全素三因」。
 *   · 只做「有没有定义」的集合判定，不校验令牌用对、颜色写死、暗色主题失配。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const args = process.argv.slice(2)
const listMode = args.includes('--list')
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback
}
const prefix = argOf('--prefix', '')
const allow = new Set(argOf('--allow', '').split(',').filter(Boolean))
const extList = argOf('--ext', '.ts,.tsx,.js,.jsx,.mjs,.css').split(',').map(s => s.trim()).filter(Boolean)
const EXT_RE = new RegExp(`(${extList.map(e => e.replace('.', '\\.')).join('|')})$`)

/** 候选扫描目录：--dir 显式指定优先，否则按常见布局探测。 */
const dirArg = argOf('--dir', '')
const candidates = dirArg !== '' ? [path.resolve(root, dirArg)] : [
  path.join(root, 'src', 'client'),
  path.join(root, 'client', 'src'),
  path.join(root, 'src'),
  root,
]
const scanDir = candidates.find(d => fs.existsSync(d))
if (scanDir === undefined) {
  console.error(`skip: 以下目录都不存在 ${candidates.join(' / ')}`)
  process.exit(0)
}

/** 跳过依赖/产物/备份目录，避免把 node_modules 里的类名混进来。 */
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'lib', 'build', 'coverage', '.next', '_backup', '_artifacts'])
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.isDirectory()) return SKIP_DIR.has(e.name) ? [] : walk(path.join(dir, e.name))
  return [path.join(dir, e.name)]
})
const files = walk(scanDir).filter(f => EXT_RE.test(f))
if (files.length === 0) {
  console.error(`skip: ${path.relative(root, scanDir)} 下没有 ${extList.join('/')} 文件`)
  process.exit(0)
}

/** 静态类名词字符集；`$`/`{` 说明是插值，跳过整段。 */
const CLASS_TOKEN = /^[A-Za-z][A-Za-z0-9_-]*$/

const used = new Map() // class -> [file:line]
/** 模板插值前的类名前缀片段：只要求「有任一已定义类名以它为前缀」。 */
const fragments = []
const defined = new Set()

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)

  // ---- 收集使用点：className: '<literal>' / className: `literal ${x} literal`
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/className:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? ''
      // 模板串里去掉 ${...} 插值，保留两侧静态片段。
      // 关键：紧贴 ${ 之前的那个片段是「类名前缀」而非完整类名
      // （如 `dms_level_${kind}` 的 dms_level_）——它必须与插值拼接后才是类名，
      // 直接当漏定义会全是假阳性。这类片段只在 fragmentsBeforeInterp 里参与
      // 「前缀匹配已定义类名」的宽松判定（见下方 missing 计算）。
      const chunks = raw.split(/\$\{[^}]*\}/)
      const interpolated = /\$\{[^}]*\}/.test(raw)
      chunks.forEach((chunk, idx) => {
        const tokens = chunk.split(/\s+/).filter(Boolean)
        tokens.forEach((token, tIdx) => {
          if (!CLASS_TOKEN.test(token)) return
          if (prefix && !token.startsWith(prefix)) return
          const isTrailingFragment = interpolated && idx < chunks.length - 1 && tIdx === tokens.length - 1
          const where = `${path.relative(root, file)}:${i + 1}`
          if (isTrailingFragment) {
            fragments.push({ token, where })
            return
          }
          if (!used.has(token)) used.set(token, [])
          used.get(token).push(where)
        })
      })
    }
  })

  // ---- 收集定义点：.class 后面跟着 { , : 空格 或换行
  for (const m of text.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)\s*(?=[{,:;\s])/g)) {
    defined.add(m[1])
  }
  // 同时兜住 `.a:hover` / `.a,.b` 这类紧跟冒号或逗号的写法
  for (const m of text.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)(?=:)/g)) defined.add(m[1])
}

const missing = [...used.entries()]
  .filter(([cls]) => !defined.has(cls) && !allow.has(cls))
  .sort((a, b) => a[0].localeCompare(b[0]))

/** 前缀片段：只有当没有任何已定义类名以它为前缀时才算漏（如 dms_level_ → dms_level_ok 命中）。 */
const orphanFragments = fragments
  .filter(({ token }) => !allow.has(token) && ![...defined].some((d) => d.startsWith(token)))
  .sort((a, b) => a.token.localeCompare(b.token))

if (listMode) {
  console.log(`defined ${defined.size} classes:`, [...defined].sort().join(', '))
  console.log(`\nused ${used.size} classes:`)
  for (const [cls, where] of [...used.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${defined.has(cls) ? '✓' : '✗'} ${cls}  (${where.length} use, ${where[0]})`)
  }
}

if (missing.length > 0 || orphanFragments.length > 0) {
  console.error('check-surface-classes FAILED — 用了但没定义样式的类名：')
  for (const [cls, where] of missing) console.error(`  ${cls}  ←  ${where.join(', ')}`)
  for (const { token, where } of orphanFragments) {
    console.error(`  ${token}<插值>  ←  ${where}（没有任何已定义类名以 ${token} 开头）`)
  }
  console.error('\n修法：把这几个类补进本插件的样式串（与兄弟仓同名控件保持同一套样式令牌），')
  console.error('或者确认它们是宿主/第三方注入的，用 --allow <cls1,cls2> 显式放行。')
  process.exit(1)
}

console.log(`check-surface-classes OK: ${used.size} classes used, all defined (${fragments.length} interpolated prefixes checked)`)