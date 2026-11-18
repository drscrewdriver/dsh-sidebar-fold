# dsh-sidebar-fold

[![npm version](https://img.shields.io/npm/v/dsh-sidebar-fold?color=4d6bfe)](https://www.npmjs.com/package/dsh-sidebar-fold)
[![license](https://img.shields.io/npm/l/dsh-sidebar-fold)](https://github.com/drscrewdriver/dsh-sidebar-fold/blob/main/LICENSE)

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
- **三档逐行控制（宿主 0.2.2 起）** —— 设置卡每一行三选一：**显示（一直显示）/ 折叠（允许折叠）/ 隐藏到更多**。
  「隐藏到更多」= 把该行交给宿主自己的「更多」菜单（等价于点宿主的“取消固定”），
  行从侧边栏消失、出现在「更多」列表里，可在里面一键固定回来；插件负责在启动、改配置与
  侧边栏重绘时**反向校准**两边状态，宿主内存态的固定表丢了也能恢复。
- **可配置** —— 默认态、每行三档、行对齐都在插件设置卡里改（宿主 `Config` + `.volatile()`，
  保存即生效，不用重启）。
- **窄栏友好** —— 侧边栏收成 36px 图标栏时自动摘掉按钮并显示全部行：不挤压、不留半隐藏态。
- **静默降级** —— 宿主 DOM 漂移导致锚点找不到时，插件不注入、不改坏侧边栏；控制台会出现
  `dsh-sidebar-fold: fold installed { mounted: false }` 告知未挂载。

## 截图

展开态（各行居中）—— 折叠钮挂在「更多」行，加项行正常列出：

![展开且居中](assets/middle.png)

折叠态 —— 只剩「插件」行与「更多」行：

![折叠](assets/fold.png)

## 安装

```sh
# npm 通道（发版后）
dsh plugin --profile <profile> add dsh-sidebar-fold

# 本地构建
npm run build && npm run verify
npm pack --pack-destination .
dsh plugin --profile <profile> add ./dsh-sidebar-fold-0.1.2.tgz
```

装完把 `dsh-sidebar-fold` 补进 profile 的 `dsh.profile.bundles`（或在应用内启用该
bundle）再重启。**desktop profile 必须先关停 Electron 应用**再改它的 `package.json`——
运行中的桌面端会按自身内存态重写该文件并回滚外部修改。

## 设置

打开 **插件 → dsh-sidebar-fold**（配置卡注册在 `plugins.bundle.config` 席位，
key 为包名）；或点侧栏 **「更多」菜单最下面的「侧栏折叠设置」** 直达——
那一行注册在 `sidebar.panellist.actions` 席位，用宿主的 `pluginNavigation.openBundle(包名)` 跳转，
所以它和菜单自带的键盘走位、关闭行为一致；宿主没提供该服务时退回「选插件面板」。

| 字段 | 含义 | 默认 |
|---|---|---|
| 默认折叠 | 窗口在没有本地记录时采用的初始状态 | 关 |
| 文字与图标对齐 | 三档分段控件（左 / 居中 / 右）；作用于被折叠管理的入口行，「更多」行跟随同一档 | 左 |
| 入口行（逐行） | 每行三选一：**显示**＝一直显示（不折叠）；**折叠**＝允许折叠（默认）；**隐藏到更多**＝移进宿主「更多」菜单 | 折叠 |

行清单在打开卡片时从 DOM 读取，所以之后新装的入口会自动出现在列表里；如果全部都开了「显示」，
折叠钮会自动置灰并报 `aria-disabled="true"`，不会出现“箭头动了但什么都没变”。

「隐藏到更多」依赖宿主 0.2.2 起的行结构（`div._panelEntry` + 行内固定控件）：0.2.1 线上该档
会在卡片里置灰，其余两档照常可用。宿主自己的固定表是**内存态**（重载即空），所以插件在每次
扫瞄时反向校准：该藏的行还在就点“取消固定”，已拉回的行被记住了就把它从隐藏清单里清掉。

## 开发

```sh
npm run build        # scripts/build-client.mjs -> lib/client.js（模块加载器 bundle）
npm run verify       # 门禁：loader id === 包名、双清单同串、无模块请求、
                     #       不引宿主 primitives、10 语词典、无机器绝对路径
npm test             # node --test，覆盖纯逻辑面（头行/分组划分、nav 回退链）
npm run hosts:check  # 与 scripts/hosts.mjs 的枚举漂移检查（--write 修复）
```

`prepack` 会串起 build + verify，过期的 `lib/client.js` 发不出去。

## 支持宿主

**支持 DSH 宿主 `>=0.2.1-rc.3 <0.3.0`**（「更多」行自 0.2.1-rc.3 才出现；0.2.x 线上后续 rc 无需重发版即可安装）。唯一事实源 `scripts/hosts.mjs`：`engines.dsh` 发该有界区间，`peerDependencies` 保持逐 rc 枚举（npm 解析不默认带 `includePrerelease`），`dsh.plugin.json` 镜像区间——全部由它生成，禁止手改。

为什么下限是 0.2.1-rc.3：挂载同时需要侧边栏的**面板列表**与宿主**「更多」行**。逐版本实测
所有已发布的 `dsh-client-ui-sidebar` rc：

| 宿主线 | 面板列表 | 「更多」行 | 行容器 / 行内固定控件 |
|---|---|---|---|
| 0.1.0-rc.8 / 0.1.1-rc.2 / 0.1.2-rc.1 | 无 | 无 | —— |
| 0.1.5-rc.3 / 0.1.7-rc.2 / 0.2.0-rc.2 | 有 | 无 | —— |
| 0.2.1-rc.1 / 0.2.1-rc.2 | 有 | 无 | —— |
| 0.2.1-rc.3 | 有 | **有** | 无 |
| 0.2.2-rc.3（2026-11-14 DOM 实测） | 有 | 有 | **有**（`div._panelEntry` + `button._panelUnpin`，菜单内 `button._pinButton`） |

没有「更多」行的宿主上，插件按设计静默降级——不注入、不改坏侧边栏；声明这类宿主
只会让用户装上一个什么都不做的插件。

**0.2.2 线的两个实测差异（都已在 0.2.2-rc.3 上验证过）**：

1. 行被 `div._panelEntry` 包裹，行内另有宿主自己的「取消固定」图钉控件。所以折叠标记必须
   打在**外层 entry** 上：只隐藏内层 `button._panelRow` 的话，折叠后会留一排 32px 空槽 + 悬停
   就冒出来的图钉（v0.1.6 在高版本上的真实回归）。
2. 宿主的“取消固定”就是「隐藏到更多」：未固定行从 nav 被过滤掉，改由 `sidebar.panellist.actions`
   渲染进「更多」菜单（每行带一个“固定到侧边栏”控件）。宿主这份固定表是内存态、不落盘，
   所以插件以两份 label 清单为真理源（`keepLabels` / `hideLabels`），每次扫瞄反向校准。

宿主换代后先跑浏览器冒烟再扩表：CSS-module hash 每次构建都漂移（rc.2 是
`wtg9ga_`，0.2.1-rc.3 / 0.2.2-rc.3 是 `hHd-Xa_`），只有片段选择器（`_panelList`、`_panelRow`、
`_moreAnchor`、`_collapsed`、`_panelEntry`、`_panelUnpin`、`_pinButton`）是稳的。

## 升级护栏

宿主 CSS-module hash 每次构建都会漂移（rc.2 是 `wtg9ga_`，0.2.1-rc.3 / 0.2.2-rc.3 是 `hHd-Xa_`），
所以所有选择器只匹配**片段**（`_panelList`、`_panelRow`、`_moreAnchor`、`_collapsed`、
`_panelEntry`、`_panelUnpin`、`_pinButton`）。
**宿主换代后必须重跑浏览器冒烟**再认定这三条通路仍在：折叠挂载、三档写入、隐藏/拉回。
插件按设计静默降级或降档，回归表现为“什么都没发生”或“第三档置灰”，不是报错。

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
