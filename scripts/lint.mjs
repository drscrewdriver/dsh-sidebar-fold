/**
 * lint.mjs — 零依赖静态检查（本仓的 `npm run lint`）。
 *
 * 为什么不引 ESLint：这个仓刻意「零运行时/零构建依赖」（client 半是手写 bundle，
 * 门禁都是 node 标准库脚本）。引一套 ESLint + 插件链会让 `npm i` 从秒级变成分钟级，
 * 且 CI 的安装面变大。这里只保留**本仓真实踩过的坑**做规则，规则名即事故名。
 *
 * 退出码：任一 `error` 级规则命中即 1；`warn` 只打印。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const errors = []
const warnings = []
const fail = (rule, file, detail) => errors.push({ rule, file, detail })
const warn = (rule, file, detail) => warnings.push({ rule, file, detail })

/** Walk a subtree, skipping generated and dependency directories. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue
      walk(join(dir, entry.name), out)
      continue
    }
    out.push(join(dir, entry.name))
  }
  return out
}

const rel = (file) => relative(root, file).replace(/\\/g, '/')
const read = (file) => readFileSync(file, 'utf8')

const all = walk(root)
const sourceFiles = all.filter((f) => ['.ts', '.mjs', '.js'].includes(extname(f)))
const clientFiles = sourceFiles.filter((f) => rel(f).startsWith('src/client/'))

// ── rule: encoding — no BOM (a BOM breaks the host's manifest reader) ──────────
for (const file of all.filter((f) => ['.ts', '.mjs', '.js', '.json', '.yml', '.md'].includes(extname(f)))) {
  if (read(file).charCodeAt(0) === 0xfeff) fail('encoding', rel(file), 'file starts with a UTF-8 BOM')
}

// ── rule: host-imports — the browser half may not load host packages ──────────
for (const file of clientFiles) {
  const text = read(file)
  for (const match of text.matchAll(/from\s+['"](@deepseek-ai\/dsh-[^'"]+)['"]/g)) {
    fail('host-imports', rel(file), `imports host package ${match[1]} (vendor rule: not a plugin API)`)
  }
  if (/from\s+['"]react['"]/.test(text)) {
    fail('host-imports', rel(file), "imports react statically; use the loader's require('react')")
  }
}

// ── rule: no-console-log — diagnostics go through console.warn/error ──────────
for (const file of clientFiles) {
  if (/\bconsole\.log\(/.test(read(file))) fail('no-console-log', rel(file), 'uses console.log (use warn/error)')
}

// ── rule: no-todo — an unfinished marker in a shipped bundle is a silent edge ─
// The rule file itself is skipped: it has to spell the markers it looks for.
for (const file of sourceFiles) {
  if (rel(file) === 'scripts/lint.mjs') continue
  if (/\b(TODO|FIXME|XXX)\b/.test(read(file))) fail('no-todo', rel(file), 'contains a TODO/FIXME marker')
}

// ── rule: no-trailing-ws ──────────────────────────────────────────────────────
for (const file of sourceFiles) {
  read(file)
    .split('\n')
    .forEach((line, index) => {
      if (/[ \t]+$/.test(line)) fail('no-trailing-ws', rel(file), `line ${index + 1} has trailing whitespace`)
    })
}

// ── rule: max-line — 140 columns, locales.ts exempt (one line per language) ───
for (const file of clientFiles.filter((f) => !f.endsWith('locales.ts'))) {
  read(file)
    .split('\n')
    .forEach((line, index) => {
      if (line.length > 140) fail('max-line', rel(file), `line ${index + 1} is ${line.length} chars (max 140)`)
    })
}

// ── rule: file-header — every source file opens with a block comment ──────────
for (const file of [...clientFiles, ...sourceFiles.filter((f) => rel(f).startsWith('scripts/'))]) {
  if (!read(file).startsWith('/**')) fail('file-header', rel(file), 'does not start with a /** block comment')
}

// ── rule: sheet-rule-array — CSS declarations come from arrays, never strings ─
// The first shipped sheet concatenated declarations without `;` and three
// properties were silently dropped; `rule(selector, array)` is what prevents it.
const constants = read(join(root, 'src/client/constants.ts'))
for (const match of constants.matchAll(/rule\(`[^`]*`,\s*([^\n]*)/g)) {
  if (!match[1].trimStart().startsWith('[')) fail('sheet-rule-array', 'src/client/constants.ts', 'rule() called with a non-array declaration list')
}

// ── rule: important-only-for-alignment — exactly two overrides are justified ──
// Comment lines are exempt: the sheet explains why `center!important` is invalid.
const importantLines = constants
  .split('\n')
  .filter((line) => line.includes('!important') && !line.trimStart().startsWith('//'))
if (importantLines.length > 2) {
  fail('important-only-for-alignment', 'src/client/constants.ts', `${importantLines.length} !important declarations (only the two justify-content overrides are allowed)`)
}
for (const line of importantLines) {
  if (!line.includes('justify-content')) fail('important-only-for-alignment', 'src/client/constants.ts', `unexpected !important: ${line.trim().slice(0, 60)}`)
}

// ── rule: locale-parity — the zh key set is the truth source, 9 files must match ─
const localesFile = join(root, 'src/client/locales.ts')
const localesText = read(localesFile)
const LANGS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'it', 'ru', 'es']
const keySets = {}
for (let i = 0; i < LANGS.length; i += 1) {
  const start = localesText.indexOf(`export const ${LANGS[i]}`)
  const next = i + 1 < LANGS.length ? localesText.indexOf(`export const ${LANGS[i + 1]}`) : localesText.length
  if (start < 0) {
    fail('locale-parity', 'src/client/locales.ts', `dictionary ${LANGS[i]} is missing`)
    continue
  }
  keySets[LANGS[i]] = new Set([...localesText.slice(start, next).matchAll(/'([a-z][\w.]*)':/g)].map((m) => m[1]))
}
const zhKeys = keySets.zh ?? new Set()
for (const lang of LANGS.slice(1)) {
  const keys = keySets[lang]
  if (!keys) continue
  for (const key of zhKeys) if (!keys.has(key)) fail('locale-parity', 'src/client/locales.ts', `${lang} is missing key ${key}`)
  for (const key of keys) if (!zhKeys.has(key)) fail('locale-parity', 'src/client/locales.ts', `${lang} has extra key ${key}`)
}

// ── rule: no-dead-copy — every runtime string must be referenced somewhere ────
// A key nobody reads renders nothing; that is a missing UI, not a spare string.
const consumers = clientFiles
  .filter((f) => f !== localesFile)
  .map((f) => read(f))
  .join('\n')
for (const key of zhKeys) {
  if (!consumers.includes(`'${key}'`)) warn('no-dead-copy', 'src/client/locales.ts', `key ${key} is defined but never read`)
}

// ── rule: package-scripts — the delivery chain must stay wired ────────────────
const pkg = JSON.parse(read(join(root, 'package.json')))
for (const script of ['lint', 'typecheck', 'test', 'build', 'verify', 'prepack']) {
  if (!pkg.scripts?.[script]) fail('package-scripts', 'package.json', `missing script "${script}"`)
}
if (typeof pkg.scripts?.prepack === 'string' && !pkg.scripts.prepack.includes('build')) {
  fail('package-scripts', 'package.json', 'prepack does not run build (npm pack only triggers prepack)')
}
for (const entry of ['src/', 'lib/', 'locale/', 'dsh.plugin.json', 'cordis.patch.yml']) {
  if (!(pkg.files ?? []).includes(entry)) fail('package-files', 'package.json', `files[] is missing ${entry}`)
}

// ── rule: test-discovery — every tests/*.test.ts must be listed in `npm test` ─
const testFiles = all.filter((f) => rel(f).startsWith('tests/') && f.endsWith('.test.ts')).map(rel)
for (const file of testFiles) {
  if (!pkg.scripts?.test?.includes(file)) fail('test-discovery', file, 'not referenced by the test script (would never run)')
}

// ── report ────────────────────────────────────────────────────────────────────
for (const item of warnings) console.warn(`warn  ${item.rule}  ${item.file} — ${item.detail}`)
for (const item of errors) console.error(`ERROR ${item.rule}  ${item.file} — ${item.detail}`)
const stats = (label, list) => `${list.length} ${label}`
console.log(`lint: ${stats('errors', errors)} · ${stats('warnings', warnings)} · ${testFiles.length} test files · ${zhKeys.size} locale keys × ${LANGS.length}`)
if (errors.length > 0) process.exit(1)
