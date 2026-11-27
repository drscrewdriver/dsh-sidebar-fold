# Changelog

## 0.1.19 (2026-11-27)

**修复：设置面板失活三版本（0.1.16–0.1.18）的根因 + 设置卡片页底排序。**

- 发版节奏：`0.1.19-rc.1` 先行（CI 成功、npm `rc` dist-tag 指向 rc.1、`latest` 保持 0.1.18），rc 验证通过后转正式 `0.1.19`。本段即正式版说明。

- 根因：`settings-card.ts` 用 `./star-row-copy.ts` 的符号，但拼接式 bundle 的 `MODULES` 清单漏了该副本；`stripRelativeImports` 删掉 import 后 bundle 照样能 parse、单测全绿，浏览器半体却在运行时抛 `ReferenceError`，宿主把崩掉的 slot 塞进 `data-slot-error` —— 页面只表现为「设置卡片整段不出现」。已把 `star-row-copy.ts` 补进 `MODULES`（leaf-first），插件详情页设置卡片恢复渲染。
- 防复发：build 期新增「相对 import ⊆ MODULES」闸，凡被 `./x.ts` 引用却未拼接的模块直接 build 失败；已做破坏自证（移除该模块 → exit 1 并点名 `star-row-copy.ts`，还原 → exit 0，产物 `lib/client.js` 7 modules / 130749 chars）。
- 设置卡片位置：宿主把详情页 section 写死为 `README → config → components → version → source`，卡片夹在 README 与组件列表之间；容器 `detailSections` 是 flex column，纯 CSS `order:99`（`section[data-plugin-config]`，避开行详情页的 div 容器）把配置卡片压到页底，不碰宿主 DOM。
- rc 实测（farm 3121，装 rc.1）：插件详情页设置卡片恢复渲染并落在页底（`section[data-plugin-config]` computed `order=99`），star-row 出现，拖「自动化任务↔插件」视觉序翻转成功且 F5 持久，三档按钮点击不受影响，`data-slot-error` 0 个。
- 门禁：lint / typecheck / 58 tests / build / verify / surface-classes 全绿。

## 0.1.18 (2026-11-27)

**修复：0.1.17 真机回归——「更多」飘到列首、拖动方向反 / 拖不动。**

- 缺陷 1（更多飘顶）：「更多」按钮的父节点是 `span.moreAnchor`，不是 `div._panelEntry`，`foldTarget()` 原样返回 button；rank 写在 button 上无效，而真正的 flex item（span）留在 `order:0`，比其它行的 `1..N` 都小 → 顶到列首。改法：新增 `flexItemOf()` 从 `foldTarget` 结果向上走到 `.panelList` 的直接子节点，rank 落在真 flex item；并把列内非本行的 chrome（moreAnchor 等）补 `rank = 行数 + 1`，不再留默认 `order:0`。
- 缺陷 2/3（方向反 / 拖不动）：`drop` 用 `rowsOf(nav)` 的 DOM 序算新序，但用户按视觉序（`style.order`）拖；两序相反时移动量互相抵消。改法：`drop` 改从 `orderedRows(all, config.orderLabels)`（当前屏幕所见）算 `reorderLabels`。
- 回归测试：`tests/order-apply.test.ts` 新增 `nested()` 桩（DOM 序与视觉序互逆 + header 在 span 里）与 3 条断言（moreAnchor 拿最大 rank 且 button 不写、互逆序下拖动能换序、清空时含 chrome 全部撤 rank）。共 58/58 通过。
- 真机复验（farm 0.2.2-rc.3 / 3121）：moreAnchor `order=3`、`top=184`（列内最大，稳在列尾）；拖「插件→自动化任务」视觉序 `[自动化任务,插件]→[插件,自动化任务]`，拖回可还原；F5 刷新后顺序保持；控制台 0 错误。

## 0.1.17 (2026-11-27)

**修复：拖动排序只有反馈、顺序不变。**

- 根因：0.1.16 的 `applyOrder` 用 `parent.insertBefore(row, next)` 搬 DOM 节点。宿主 0.2.2 起每行按钮各自包在 `div._panelEntry` 里（`SidebarRoot.tsx:78`），`next` 属于另一个父节点 → DOM 抛 `NotFoundError` → 被 `try` 静默吞掉 → 拖动高亮有、松手列顺序没变；顺序落盘了也永远不生效。
- 改法：改用 CSS `order`，写在每行 **wrapper** 上（`.panelList` 是 `display:flex;flex-direction:column`）。不搬宿主节点、React 重渲染后依然成立、只在值变化时写，`orderLabels` 清空即撤掉，卸载/HMR 一并清理；「更多」header 的 rank 恒为最大值，仍是折叠开关。
- 拖动绑定从按钮挪到行 wrapper（该行就是 flex item，落在右侧 pin 留白上也能命中），并在`drop` 时清掉 source 再算新序。
- 设置卡同一处修复：原来 drop 后把新行 append 到卡片末尾（旧行还在 → 列表看着「没变」且重复），现在统一走 `applyConfig({orderLabels})` → `paint()` → `commit({orderLabels})`；卡片行的类从「拖动反馈」换成拖柄类（此前每行常驻 `opacity:.45`，读起来像禁用）。
- 新增 `tests/order-apply.test.ts`（5 条，锁「只写 rank、不搬节点、幂等、清空可撤」）+ `tests/order.test.ts` 反回归断言（`fold.ts` 运行代码里不得出现 `insertBefore`）。

## 0.1.16 (2026-11-27)

**侧边栏入口行排序：除「更多」外全部可拖，顺序持久化到 Config。**

- `orderLabels`（volatile Config 字段，缺省 `[]` = 宿主 DOM 原序）：侧边栏行内 DnD 与设置卡片 DnD 两面共享同一来源与写路径。
- 新增纯函数 `reorderLabels` / `orderedRows`；`applyFold` 用幂等 `insertBefore` 重排，抗 MutationObserver 自激；「更多」header 恒固定末尾，折叠开关不变。
- 设置卡入口行加拖柄，drop 后 `commit({orderLabels})`；`index.ts` 把侧栏拖动经 `subscribeOrder` 桥接回同一 scope 落盘。
- 10 语字典 + locale 元数据同步新增 `settings.rowDrag` / `rowDragHint`；新增 `scripts/check-surface-classes.mjs` 并接进 prepack。
- **发版事故记录**：本版本的 CI release 运行以 `npm error 409 Cannot publish over previously staged version "0.1.16"` 失败
  （同一版本一旦进入 npm staged 状态，重推同 tag 必失败），最终由本地 `npm publish` 补发、GitHub Release 事后回填。
  0.1.15 同型。→ 结论：修发版失败必须换版本号，不要重推已有 tag（v0.1.17 即由此而来）。

## 0.1.15

- 设置面新增 star 快车道行（单源 _tools/star-row 生成，10 语；GitHub 单色图标 + 仓库直达链接 + 一句工程话术，整行可点，无弹窗无打断）。
- 附带 CI 修复：本包无线标签时直接收工，不再空等读侧滞后。

## 0.1.14

- **CI 发版通道**：新增 `.github/workflows/release.yml`，打 tag 后由 GitHub Actions 依次完成
  版本对齐、门禁、`npm pack --dry-run`、幂等检查、`npm publish`、`dsh-*` 线标签同步与
  GitHub Release（带 `Latest` 徽标）。
- **`scripts/release-notes.mjs`**：Release 正文生成器，优先级
  `RELEASE-NOTES-v<ver>.md` > `CHANGELOG.md` 版本节 > tag 提交信息；正文短于 80 字符或命中
  空壳标记时拒绝写入，避免发布空壳 Release。
- **README 新增 Releases 一节**：写清本地 6 步与 CI 4 步的分界、dry_run 预演方式，以及
  幂等重跑与线标签降级行为。
- 本文件为首次引入；之后每个版本在顶部新增一节，CI 从该节取 Release 正文。

## 0.1.13

- 折叠标记落在 panelEntry 包装层，避免与宿主行级 class 冲突（issue #2）。
- 新增第 10 种 runtime 字典 `pt`（巴西葡萄牙语），locale 文件与门禁同步到 10 种。
- README.pt.md 镜像翻译，`files[]` 收录。