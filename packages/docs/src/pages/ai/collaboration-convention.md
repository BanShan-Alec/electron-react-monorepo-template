---
title: AI 协作者约定（Agents.md）
description: 根目录管全局红线与任务路由，各包管局部铁律，单一真源与全自动代码自检。
---

# AI 协作者约定（Agents.md）

> **TL;DR**：建立根目录与子包两层 `AGENTS.md` 体系。根目录统一收敛技术栈底座、全局红线与跨包任务路由；各子包 `AGENTS.md` 承载本包唯一真源。让 AI 助手进场即可按图索骥，无需猜测工程结构。

## 1. 选型理由

- **消除规则冲突与上下文丢失**：大型 Monorepo 规则若散落在不同包的 README 中，AI 进场极易产生幻觉（例如在渲染层导入 Node 原生模块）。
- **任务路由按需指引**：AI 在执行特定任务（如新增 IPC 业务域、修改打包配置）时，通过任务路由表直接获取阅读顺序与深档指针，避免一次性吞入过多无用上下文。
- **全局红线一句话硬判定**：用简单有力的单句判定，并严格绑定自动化门禁工具。

## 2. 核心配置与实现

### 根目录任务路由表（全局指引）

→ 源码：[AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/AGENTS.md)

| 任务类型 | 第一步（先读） | 第二步（深查真源） |
| :--- | :--- | :--- |
| **新增跨端业务域** | `shared` → `preload` → `main` → `renderer` 的 `AGENTS.md` | [架构分层与责任边界](/architecture/layering) |
| **主进程模块生命周期** | `packages/main/AGENTS.md` | [主进程模块化生命周期](/architecture/module-lifecycle) |
| **渲染层组件与状态** | `packages/renderer/AGENTS.md` | [React 组件编写规范](/architecture/react-conventions) |
| **打包与安装包构建** | `packages/main/AGENTS.md` | [应用打包（Electron-builder）](/delivery/packaging) |
| **日志与链路追踪** | `.agents/rules/logging-specification.md` | [主进程日志分级管理](/main/logging) |

### 三大全局红线（机器硬拦截）

#### 红线 1：根目录严禁新增业务依赖

```json
// package.json: dependencies 只能且仅能包含 @app/main
"dependencies": {
  "@app/main": "workspace:*"
}
```
*门禁验证*：`pnpm verify:prebuild` 静态扫描，发现任何非 `@app/main` 的根业务依赖立即退出并报错。

#### 红线 2：严禁新增桶文件（Barrel Files）

```json
// .config/biome.json
{
  "linter": {
    "rules": {
      "performance": {
        "noBarrelFile": "error",
        "noReExportAll": "error"
      }
    }
  }
}
```
*澄清说明*：不得新增只做重导出的 `index.ts`，严禁 `export *`。组件自身的 `Button/index.tsx`（一组件一文件夹本体实现）非桶文件，属于合规例外。

#### 红线 3：路径推导基于模块锚点

```ts
// build/lib/repo-paths.ts: 严禁强依赖不稳定且存在工作目录偏移的 process.cwd()
export function findRepoRoot(startDir: string): string {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    current = path.dirname(current);
  }
  throw new Error('未找到仓库根目录');
}
```

## 3. 桌面端避坑注意事项

| 避坑要点 | 事故表现与原因 | 本仓库对齐方案 |
| :--- | :--- | :--- |
| **渲染层偷渡 Node 原生模块** | AI 在 `packages/renderer` 中擅自引入 `node:fs` 或 `__dirname`，开发态可能不报错，打包后立即白屏崩溃。 | `packages/tsconfig/react.json` 严格限制类型定义；Preload 桥接是与操作系统交互的唯一合法出口。 |
| **子包规则重复维护** | 在根目录和子包 README 同时写了一套分层说明，修改时不同步导致 AI 读到过期指示。 | 子包 `AGENTS.md` 为该包唯一真源；根目录仅做链接和任务路由，杜绝内容冗余。 |
| **快捷方式启动工作目录偏移** | 桌面快捷方式启动时 `process.cwd()` 指向 Windows System32 或桌面，代码依赖相对路径导致文件丢失。 | 统一通过 `findRepoRoot(import.meta.dirname)` 向上物理锁定根目录。 |
