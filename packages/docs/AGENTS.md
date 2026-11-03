# @app/docs AGENTS.md — 文档站规则（AI 必读）

> 全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。
> 本文件是该包规则的唯一真源：页面结构、写作口径、导航登记与站点约束都以此为准。

## 1. 站点形态与目录

Vocs 2 构建的纯静态站（`renderStrategy: 'full-static'`），部署在 GitHub Pages 的
`/electron-react-monorepo-template/` 前缀下。内容按 9 个维度分目录，一篇页面 = 一个
「坑 → 解法 → 怎么抄」的解法，或一份机制 / 规范说明。

```
packages/docs/
├── vocs.config.ts              # basePath / title / full-static / sidebar 接线
├── src/
│   ├── navigation.ts           # 侧栏 + 首页目录的唯一数据源（BASE_PATH 也在这里）
│   ├── pages/                  # 路由：目录=维度，文件=页面
│   │   ├── _slots.tsx          # 侧栏品牌位
│   │   ├── _root.css           # 站点级样式覆盖（Tailwind 源扫描限 docs/src）
│   │   └── <dimension>/<slug>.md
│   └── components/PageDirectory.tsx
├── scripts/vocs-windows-fix.*  # Windows 专属 Vocs 补丁（§5）
└── public/icon.png
```

- 本地预览 `pnpm docs:dev`（端口 5174）；构建 `pnpm docs:build`。
- `src/pages.gen.ts` 与 `dist/` 是构建产物：不入库、不手改。

## 2. 页面规范

### 1. 元信息：title / description / TL;DR 三件套

- frontmatter 必须有 `title` 与 `description`（中文）。`title` 形如「中文名（English-tag）」，
  括号里的英文标签沿用既有维度词（`Electron-builder`、`Zod + ContextBridge`），供搜索与按标题切片检索。
- `description` 是一句话结论，与正文 TL;DR 同义——它同时进入 `llms.txt`、搜索索引与页面 meta / 分享卡片。
- 正文第一行 `# <title>` 与 frontmatter 完全一致，随后紧接 `> **TL;DR**：<一句话结论>`。
- 新页默认用 `.md`；需要 JSX / React 组件时用 `.mdx`（如首页 `index.mdx`）。

### 2. 解法页骨架：坑 → 解法 → 怎么抄

````md
## 要解决的坑

<读者真实遇到的失败现场>

## 本仓库的解法

### <机制名>：<一句话结论>

→ 源码：[packages/.../file.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/.../file.ts)

```ts
// 从该文件真实摘录
```

<为什么这样定，以及代价>

## 怎么抄

1. **<步骤名>**：<可执行动作>
2. ...

注意点：

- <易错点>
````

- 「坑」写症状与后果，不写泛泛的收益；「解法」按机制分 `###`，每节先结论、再源码证据、最后取舍。
- 「怎么抄」编号从 1 开始且连续；派生应用可裁剪的部分在步骤里明说（如「小项目可先砍掉跨进程段」）。
- `注意点：` 默认跟在「怎么抄」末尾；内容多时再升为 `## 注意点`。需要时追加 `## 怎么验证`（可跑的检查）、
  `## FAQ`、`## 指针`（相关页链接）。
- 机制 / 规范页（[首屏体验](src/pages/ui/first-screen.md)、[国际化文案规范](src/pages/ui/i18n-copy.md)）可裁小节，
  但「为什么有这个问题」不能省；短页（[组件库](src/pages/ui/antd.md)）也必须有「怎么抄」。

### 3. 源码与链接

- 每个解法页至少一条 `→ 源码：[仓库相对路径](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/<path>)`；
  代码块紧邻其对应的源码链接，片段从该文件真实摘录（可 `// ...` 省略），不凭记忆重写。
- 站内链接写根相对路径：`/ui/i18n`。带 `/electron-react-monorepo-template/` 前缀或尾斜杠会被 Vocs
  判为死链、构建失败；带 `.md` 后缀构建不拦，但 GitHub Pages 上没有对应文件，线上 404。
- 外链写完整 URL；GitHub 源码统一 `blob/main/`。

### 4. 写作口径

- 三类读者（模板使用者 / 按关键词搜解法的人 / AI 协作者）共用一份正文：先结论、后论证，一节只讲一件事。
- 规则只引用不复制：AGENTS.md 与配置文件是铁律真源，本站负责解释动机、给索引与源码入口；
  同一段规则不在这里维护第二份。
- 版本号、文件数量、目录清单这类会过期的信息，能从源码或命令查到的就不抄；必须写时随代码同 PR 更新。
- 术语沿用站内既有写法（IPC 契约、首屏编排、发版级、坑位），新概念先定义再使用。

## 3. 新增 / 修改页面 SOP

1. **定位**：先搜现有维度页能否扩展；确需新页时选维度目录与 kebab-case slug（目录=维度，文件=页面）。
2. **写正文**：按 §2 落 frontmatter、TL;DR 与三段式，源码片段与链接成对出现。
3. **登记导航**：在 `src/navigation.ts` 的 `SIDEBAR_GROUPS` 增加条目——侧栏与首页目录都读这一份，
   漏登记页面就不可达。完成判据：`SIDEBAR_GROUPS` 里有且只有一条该 `link`。
4. **改路径**：重命名 / 删除页面时，同一 PR 内更新 `navigation.ts` 与所有入站链接（构建会报死链）。
5. **验证**：`pnpm docs:build` 退出码 0，目标路由出现在 `dist/public/<dimension>/<slug>/index.html`
   与 `dist/public/llms.txt`。完成判据：两个产物都能找到该页。
6. **合并**：CI `docs` job 会再跑一次构建；main 上 `packages/docs/**` 变更触发 GitHub Pages 部署。

## 4. 站点硬约束

| 约束 | 原因 / 做法 |
| --- | --- |
| 导航单一真源 | `navigation.ts` 同时喂 `vocs.config.ts` 的 sidebar 与首页 `PageDirectory`；页面里不再维护目录 |
| basePath 只补页面路由 | 站内页面链接写 `/ui/i18n`；`vocs.config.ts` 的 `iconUrl`、`_slots.tsx` 的图片地址、`public/` 资源必须自带 `/electron-react-monorepo-template/` 前缀 |
| 不配 redirects | `redirects` 是 Waku 运行时中间件，GitHub Pages 静态托管执行不到；保旧 URL 用 `public/<path>/index.html` 物理页 |
| 品牌名两处同步 | `vocs.config.ts` 的 `title` 与 `_slots.tsx` 的品牌文本 / `alt`；应用品牌真源是根 `package.json` 的 `productName` |
| 不 import 应用包 | docs 是独立包，不依赖 `@app/*`；页面用源码链接指向实现，不复制运行时依赖 |
| 产物不入库 | `src/pages.gen.ts`、`dist/` 由 Vocs 生成，不手改、不提交 |

## 5. Windows 补丁

`scripts/vocs-windows-fix.mjs` 以 `node --import` 预加载 `vocs-windows-fix.loader.mjs`，在 win32 上修
Vocs 的四处路径分隔符 bug（MDX layout、slots、userStyles、llms.txt）。`dev` / `build` 脚本必须保留这层
预加载；Linux / CI 不注册补丁、完全走原版 Vocs。升级 Vocs 后先跑 `pnpm docs:build` 确认四个补丁仍匹配，
上游修复（wevm/vocs#674）落地后删除。

## 6. 提交前门禁

`pnpm docs:build`。Markdown 不在 Biome 覆盖范围（`.md` 被忽略），typecheck 只覆盖 `src/**/*.ts(x)`；
页面格式、站内死链与 MDX 编译都由这次构建把关。

## 7. Anti-Patterns

- 新页只落文件、不登记 `src/navigation.ts`：侧栏与首页都看不到。
- 站内链接带 basePath 或尾斜杠：构建报死链；带 `.md`：构建放行，线上 404。
- 把 AGENTS.md / 配置里的规则正文抄进页面：改一处漏一处，读者拿到过期副本。
- 代码块凭记忆重写：与仓库实现漂移，读者照抄即错。
- 提交 `dist/` 或 `pages.gen.ts` 的改动：产物入库会与构建结果冲突。
