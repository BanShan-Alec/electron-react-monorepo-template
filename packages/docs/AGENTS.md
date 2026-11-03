# @app/docs AGENTS.md — 文档站规则（AI 必读）

> 全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。
> 本文件是该包规则的唯一真源：页面结构、写作口径、导航登记与站点约束都以此为准。

## 1. 站点形态与目录

Vocs 2 构建的纯静态站（`renderStrategy: 'full-static'`），部署在 GitHub Pages 的
`/electron-react-monorepo-template/` 前缀下。内容按 9 个维度分目录，一篇页面 = 一个
1-2 屏极简速查清单（选型理由 + 核心配置代码 + 桌面端避坑注意事项）。

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

### 2. 页面骨架：极简速查清单三段式

全站页面统一采用「选型理由 + 核心配置代码 + 桌面端避坑注意事项」三段式，篇幅严格控制在 1-2 屏（约 40-90 行）：

````md
---
title: <中文名>（<English-tag>）
description: <一句话结论，与正文 TL;DR 严格一致>
---

# <title 与 frontmatter 完全一致>

> **TL;DR**：<一句话结论：技术选型核心取舍与解决痛点>

## 1. 选型理由

<阐述为什么选型该方案，痛点、决策背景与架构动因，直切核心不写长篇大论>

## 2. 核心配置代码

### <机制/配置模块名>

→ 源码：[packages/.../file.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/.../file.ts)

```ts
// 从仓库源码真实摘录，突出关键配置/实现（严禁凭记忆臆造）
```

## 3. 桌面端避坑注意事项

<!-- 形式一：包含事故表现与方案对比时，优先采用三列表格 -->
| 避坑要点 | 事故表现与原因 | 本仓库对齐方案 |
| :--- | :--- | :--- |
| **<要点名>** | <具体事故现象与底层诱因> | <本工程落地的刚性解法与防线> |

<!-- 形式二：概念、规则或边界条件陈述时，可采用加粗要点列表 -->
- **<要点名>**：
  - <背景解释与具体桌面端规避要求>
````

- **结构纪律**：一律以 `## 1. 选型理由`、`## 2. 核心配置代码`、`## 3. 桌面端避坑注意事项` 为一级小节编号。
- **篇幅控制**：拒绝臃肿理论推演，高密度浓缩，让读者与 AI 协作者能在 1-2 屏内秒级完成速查。
- **表现约定**：三列表格与加粗要点列表灵活选用。凡涉及「事故表现与对齐方案」对比的场景优先采用三列表格；规则与机制注意事项陈述优先采用要点列表。

### 3. 源码与链接（单一真源）

- 每个核心代码块紧邻其对应的源码直链：`→ 源码：[仓库相对路径](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/<path>)`。
- 代码片段必须从源码真实摘录（可用 `// ...` 合理省略无关细节），**严禁凭空伪造模块、伪造契约类型或虚构测试断言**。
- 站内链接写根相对路径：`/ui/i18n`。带 `/electron-react-monorepo-template/` 前缀、尾斜杠或本地绝对路径（`file:///...`）会被 Vocs 判为死链并阻断构建；带 `.md` 后缀构建不拦，但 GitHub Pages 上没有对应文件，线上会 404。
- 外链写完整 URL；GitHub 源码统一使用 `blob/main/` 分支绝对链接。

### 4. 写作口径

- 三类读者（模板使用者 / 按关键词搜解法的人 / AI 协作者）共用一份正文：先结论、后论证，一节只讲一件事。
- 规则只引用不复制：根 AGENTS.md 与配置文件是铁律真源，本站负责解释动机、给索引与源码入口；同一段规则不在这里维护第二份。
- 版本号、文件数量、目录清单这类会过期的信息，能从源码或命令查到的就不抄；必须写时随代码同 PR 更新。
- 术语沿用站内既有写法（IPC 契约、首屏编排、发版级、坑位），新概念先定义再使用。

## 3. 新增 / 修改页面 SOP

1. **定位**：先搜现有维度页能否扩展；确需新页时选维度目录与 kebab-case slug（目录=维度，文件=页面）。
2. **写正文**：按 §2 落 frontmatter、TL;DR 与「选型理由 + 核心配置代码 + 桌面端避坑注意事项」三段式速查清单，源码片段与直链成对出现。
3. **登记导航**：在 `src/navigation.ts` 的 `SIDEBAR_GROUPS` 增加条目——侧栏与首页目录都读这一份，漏登记页面就不可达。完成判据：`SIDEBAR_GROUPS` 里有且只有一条该 `link`。
4. **改路径**：重命名 / 删除页面时，同一 PR 内更新 `navigation.ts` 与所有入站链接（构建会报死链）。
5. **验证**：`pnpm docs:build` 退出码 0，目标路由出现在 `dist/public/<dimension>/<slug>/index.html` 与 `dist/public/llms.txt`。完成判据：两个产物都能找到该页。
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

- **未登记导航**：新页只落文件、不登记 `src/navigation.ts`，导致侧栏与首页均不可达。
- **死链与非法链接**：站内链接带 basePath 或尾斜杠导致构建报死链；带 `.md` 导致线上 404；使用 `file:///...` 等本地绝对路径。
- **规则正文硬拷贝**：把 AGENTS.md / 配置里的规则正文抄进页面，导致规则漂移与过期。
- **凭记忆重写代码或伪造契约**：代码块脱离源码实际实现，伪造不存在的 schema 路径或随意修改测试断言阈值。
- **篇幅臃肿拖沓**：篇幅远超 1-2 屏，堆砌冗长概念说明，偏离极简速查清单定位。
- **产物入库**：提交 `dist/` 或 `pages.gen.ts` 的改动，与构建引擎产生冲突。
