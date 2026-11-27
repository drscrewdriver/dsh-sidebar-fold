# Changelog

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