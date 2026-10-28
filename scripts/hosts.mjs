/**
 * hosts.mjs —— 宿主版本枚举的**唯一事实源**。
 *
 * 枚举口径（2026-10-24 复核后收紧）：**只声明「更多」行真实存在的宿主**。
 * 本插件的挂载前提是宿主侧边栏同时具备三组锚点：
 *   ① `_panelList` / `_panelRow`        面板列表
 *   ② `_moreAnchor` + `aria-haspopup="menu"`  「更多」行（折叠头）
 *   ③ `sidebar.panellist.actions`        菜单席位（折叠后菜单仍要能开合）
 *
 * 逐版本取证（unpkg 直读各版本发布的 client 半，脚本 `_scratch/probe-sidebar-versions.mjs`）：
 *
 *   0.1.0-rc.8   17K  ①②③ 全无
 *   0.1.1-rc.2   17K  全无
 *   0.1.2-rc.1   18K  全无
 *   0.1.5-rc.3   22K  仅 ①
 *   0.1.7-rc.2   32K  仅 ①
 *   0.2.0-rc.2   32K  仅 ①
 *   0.2.1-rc.1   32K  仅 ①
 *   0.2.1-rc.2   32K  仅 ①
 *   0.2.1-rc.3   37K  ①②③ 全有   ← 唯一可声明（rc.3 批次时点）
 *   0.2.1-rc.4   ——   与 rc.3 同形（slot-catalog/docs 零 diff，source-analysis v0.2.1-rc.4 四件套） ← 2026-10-28 入列
 *
 * 结论：**「更多」行自 0.2.1-rc.3 起才出现**。0.1.5～0.2.1-rc.2 虽然有面板列表，
 * 但没有折叠头，插件在这些线上走 `rescan()` 的静默降级（不注入、不改坏侧栏）；
 * 声明它们只会让用户装上一个不工作的插件，故一律不声明。
 *
 * 升级流程：本数组加版本 → `node scripts/sync-hosts.mjs --write` → farm 格浏览器冒烟 →
 * 发版。本数组与由它生成的三处声明（package.json peerDependencies / package.json
 * engines.dsh / dsh.plugin.json engines.dsh）**禁止手改**。
 */



/** 全部声明支持的宿主 rc（冻结；新增只在此处追加）。 */
export const supportedHosts = Object.freeze([
  // 「更多」行首次出现于 0.2.1-rc.3；host-farm 格 + 真实浏览器 DOM 已实测
  // （三档对齐、折叠翻转、设置卡写入四条通路）。
  '0.2.1-rc.3',
  // rc.4（2026-10-28 入列）：契约面与 rc.3 零 diff，「更多」行同在；DOM 锚点未单独复测，不入 domVerifiedHosts
  '0.2.1-rc.4',
])

/** peerDependencies / engines.dsh 共用的枚举串（精确枚举无暗坑，逐 rc 单列）。 */
export const peerRange = supportedHosts.join(' || ')

/** 本地开发与矩阵默认宿主（devDependencies 若引入宿主包一律钉这里）。 */
export const developmentHost = '0.2.1-rc.4'

/** 实测过 DOM 锚点的宿主（其余线在浏览器冒烟前只是声明面候选）。 */
export const domVerifiedHosts = Object.freeze(['0.2.1-rc.3'])

/**
 * peer 闸门指向的宿主子包。本插件的 client 半只经 `dsh.client.inject` 等
 * `@deepseek-ai/dsh-client-ui-settings`（其 `configForms` 服务提供设置面），
 * 因此该包与宿主 `@deepseek-ai/dsh` 同线逐版发布，纳入托管枚举。
 */
export const hostPeerPackages = Object.freeze([
  '@deepseek-ai/dsh-client-ui-settings',
])

/**
 * Assert a manifest's peerDependencies carry exactly the packages of
 * {@link hostPeerPackages}. Values are not checked here: `sync-hosts.mjs` owns
 * them (its check mode fails on drift, `--write` repairs it).
 * @param peers - the manifest's `peerDependencies` object.
 */
export function assertHostPeers(peers) {
  const actual = Object.keys(peers ?? {}).sort()
  const expected = [...hostPeerPackages].sort()
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(`peerDependencies 集合与 hosts.mjs 不一致：${actual.join(',')} ≠ ${expected.join(',')}`)
  }
}
