# dsh-sidebar-fold

把 DSH 左侧栏的「加项入口」收进宿主的 **「更多」行**。

左侧栏的「全局面板」列表会随安装变长：自动化任务、agent 团队、插件市场、上下文页……
本插件在宿主「更多」行右端挂一个 **28×28 的方形箭头按钮**。点一下把这些加项行整体收纳，
只剩「更多」一行；箭头由 ▲（可收起）翻成 ▼（可展开），再点复原。

- **非侵入** —— 纯 client 插件，只新增 DOM。不打宿主补丁、不碰 `app.asar`；卸载后侧边栏
  与原版逐行一致（自持的 `<style>` 标签与 `data-dshsf-*` 标记一并清除）。
- **结构化定位头行** —— 头行 = 「全局面板」nav 内带 `aria-haspopup="menu"` 的 `panelRow`。
  不依赖任何文案，也不依赖插件注册顺序。
- **状态按窗口持久化** —— 折叠/展开记录在 `localStorage`，刷新后保持。
- **对齐可切换** —— 被管理的入口行（含「更多」行）的文字与图标可整体**左对齐 / 居中 / 右对齐**；
  右对齐时折叠钮自动镜像到行左端，不压文字。覆盖层只用宿主的 `justify-content` 长属性，
  不动行的 `display`/`gap`/高度。
- **可配置** —— 默认态、保持可见的行、行对齐都在插件设置卡里改（宿主 `Config` + `.volatile()`，
  保存即生效，不用重启）。
- **窄栏友好** —— 侧边栏收成 36px 图标栏时自动摘掉按钮并显示全部行：不挤压、不留半隐藏态。
- **静默降级** —— 宿主 DOM 漂移导致锚点找不到时，插件不注入、不改坏侧边栏；控制台会出现
  `dsh-sidebar-fold: fold installed { mounted: false }` 告知未挂载。

## 安装

```sh
# npm 通道（发版后）
dsh plugin --profile <profile> add dsh-sidebar-fold

# 本地构建
npm run build && npm run verify
npm pack --pack-destination .
dsh plugin --profile <profile> add ./dsh-sidebar-fold-0.1.0.tgz
```

装完把 `dsh-sidebar-fold` 补进 profile 的 `dsh.profile.bundles`（或在应用内启用该
bundle）再重启。**desktop profile 必须先关停 Electron 应用**再改它的 `package.json`——
运行中的桌面端会按自身内存态重写该文件并回滚外部修改。

## 设置

打开 **插件 → dsh-sidebar-fold**（配置卡注册在 `plugins.bundle.config` 席位，
key 为包名）：

| 字段 | 含义 | 默认 |
|---|---|---|
| 默认折叠 | 窗口在没有本地记录时采用的初始状态 | 关 |
| 文字与图标对齐 | 三档分段控件（左 / 居中 / 右）；作用于被折叠管理的入口行，「更多」行跟随同一档 | 左 |
| 保持可见的入口 | **按当前侧边栏实时读出的行逐个开关**；打开的行在折叠时保留可见 | 仅 `插件` / `Plugins` |

行清单在打开卡片时从 DOM 读取，所以之后新装的入口会自动出现在列表里；如果全部都打开了，
折叠钮会自动置灰并报 `aria-disabled="true"`，不会出现“箭头动了但什么都没变”。

## 开发

```sh
npm run build        # scripts/build-client.mjs -> lib/client.js（模块加载器 bundle）
npm run verify       # 门禁：loader id === 包名、双清单同串、无模块请求、
                     #       不引宿主 primitives、9 语词典、无机器绝对路径
npm test             # node --test，覆盖纯逻辑面（头行/分组划分、nav 回退链）
npm run hosts:check  # 与 scripts/hosts.mjs 的枚举漂移检查（--write 修复）
```

`prepack` 会串起 build + verify，过期的 `lib/client.js` 发不出去。

## 支持宿主

逐 rc 精确枚举（禁用宽区间），唯一事实源 `scripts/hosts.mjs`：
`0.1.0-rc.8 || 0.1.1-rc.2 || 0.1.2-rc.1 || 0.1.5-rc.3 || 0.1.7-rc.2 || 0.2.0-rc.2 || 0.2.1-rc.3`。

DOM 锚点只在 **0.2.1-rc.3** 上实测过（host-farm 格 + 真实浏览器取证）。其余线属于声明面，
须逐格跑自己的浏览器冒烟；不过就从表里删掉，不能让 semver 巧合放行未测宿主。

## 升级护栏

宿主 CSS-module hash 每次构建都会漂移（rc.2 是 `wtg9ga_`，rc.3 运行时是 `hHd-Xa_`），
所以所有选择器只匹配**片段**（`_panelList`、`_panelRow`、`_moreAnchor`、`_collapsed`）。
**宿主换代后必须重跑浏览器冒烟**再认定折叠仍在挂载：插件按设计静默降级，回归表现为
“什么都没发生”，不是报错。

## 目录

```
src/index.js                 宿主半：Config schema + 空 apply（无需构建）
src/client/constants.ts      实测锚点、属性标记、注入的样式表
src/client/locales.ts        9 部运行时词典（zh 键集为真理源）
src/client/fold.ts           nav 定位、头行/分组划分、按钮挂载、折叠状态
src/client/settings-card.ts  bundle 详情页配置卡（纯 DOM）
src/client/index.ts          apply：先装折叠，再各自带守卫地接设置腰
scripts/                     build-client / verify / sync-hosts / hosts / gen-locale-meta
```

## 许可

MIT
