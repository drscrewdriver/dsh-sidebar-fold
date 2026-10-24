/**
 * hosts.mjs —— 宿主版本枚举的**唯一事实源**。
 *
 * 枚举口径（本仓 2026-10-24 定）：**起步只声明已实测宿主**。本插件的行为依赖宿主
 * 侧边栏的 CSS-module 片段锚（`_panelList` / `_panelRow` / `_moreAnchor`）与
 * 「更多」行的硬编码存在性，这两点只在 0.2.1-rc.3 的**真实浏览器 DOM** 上核过
 * （host-farm 格 + `_artifacts/dsh3093-*.png`）。因此枚举表按「每条线取最大 rc、
 * 逐格实测后删红留绿」推进：新增一格 = 跑一次 farm 浏览器冒烟，未过即从表内删除，
 * 禁止凭 semver 推断放行未测宿主。
 *
 * 升级流程：本数组加版本 → `node scripts/sync-hosts.mjs --write` → 矩阵格实测 →
 * 发版。本数组与由它生成的三处声明（package.json peerDependencies / package.json
 * engines.dsh / dsh.plugin.json engines.dsh）**禁止手改**。
 */

/** 全部声明支持的宿主 rc（冻结；新增只在此处追加）。 */
export const supportedHosts = Object.freeze([
  '0.1.0-rc.8', // 0.1.0 线最大 rc
  '0.1.1-rc.2', // 0.1.1 线最大 rc
  '0.1.2-rc.1', // 0.1.2 线最大 rc
  '0.1.5-rc.3', // 0.1.5 线最大 rc
  '0.1.7-rc.2', // 0.1.7 线最大 rc
  '0.2.0-rc.2', // 0.2.0 线最大 rc
  '0.2.1-rc.3', // 0.2.1 线最大 rc —— 已实测（host-farm 格 + 浏览器 DOM 取证）
])

/** peerDependencies / engines.dsh 共用的枚举串（精确枚举无暗坑，逐 rc 单列）。 */
export const peerRange = supportedHosts.join(' || ')

/** 本地开发与矩阵默认宿主（devDependencies 若引入宿主包一律钉这里）。 */
export const developmentHost = '0.2.1-rc.3'

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
