# Changelog

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
