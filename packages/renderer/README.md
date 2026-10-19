# @app/renderer

渲染进程（Vite 8 + React 19 + antd + TailwindCSS + LinguiJS + zustand + ahooks），通过 preload 暴露的 `window.api` 与主进程进行类型安全的 IPC 通信。

> 🤖 **AI 协作者**：本包的目录结构 / Feature 规范 / 请求层 / 组件约定已收敛至 [AGENTS.md](./AGENTS.md)，动手前必读；视觉规范见 [docs/DESIGN.md](./docs/DESIGN.md)；全局红线与全仓任务路由见 [根 AGENTS.md](../../AGENTS.md)。

```bash
pnpm --filter @app/renderer dev        # 本地开发（由根目录 pnpm start 统一编排）
pnpm --filter @app/renderer build      # 生产打包（含类型检查与按需 Chunk 分割）
pnpm --filter @app/renderer extract    # 一键提取自然中文词条至 PO 字典
pnpm --filter @app/renderer typecheck  # TypeScript 类型检查
pnpm --filter @app/renderer lint       # Biome 代码规范与格式化检查
```

## 分层依据（为什么这样切）

**第一层：按所有权切**——只服务一个业务域的代码进 `features/<domain>/`；被两个以上域共用的才上提到 `components/`、`hooks/`、`lib/`、`stores/`。
`components/` 属于"跨域 UI"，`hooks/`、`lib/` 属于"跨域能力"，`stores/` 属于"跨域状态"。

**第二层：按有无副作用切**——`features/<domain>/hooks/` 持有状态与 IPC 副作用，返回 view model（`{ state, handlers }`）；
`features/<domain>/components/` 纯展示，只靠 props 进入、callback 出去，不碰 IPC、不持有跨卡片状态。

**依赖方向单向**：`entries → features → 跨域层`；feature 之间禁止互相 import（可独立删除/新增），唯一合法例外是 `dashboard` 组合编排域。

## 已知取舍

- **dashboard 常驻 + `hidden` 切换**：hook 已随 feature 收敛，若 tab 切换时卸载面板，counter 等本地状态会丢失、
  system-info/settings 会重复请求。因此两个面板都保持挂载，仅切换显隐。
- **已接入 wouter 声明式路由**：主窗口经 `/dashboard`、`/architecture` 两个面板编排（Header 导航），
  不引入大型路由库；全局业务 store 仍保持按需下沉——当前 11 个域无跨域共享 state，出现第二个消费者再下沉。
- **不建第二份 API map**：类型全部从 `ElectronApi`（`@shared/types/api`）推导，避免手写表与真实契约漂移。

## 跨包与文档关联

- 多语言架构深度指南：参见 [docs/i18n/architecture.md](../../docs/i18n/architecture.md)
- 多语言日常实操 SOP：参见 [docs/i18n/guide.md](../../docs/i18n/guide.md)
- 契约源头：参见 [packages/shared/README.md](../shared/README.md)
- 安全桥接：参见 [packages/preload/README.md](../preload/README.md)
- 主进程实现：参见 [packages/main/README.md](../main/README.md)
- 工程与提交规范：参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)
- 返回根目录：[README.md](../../README.md)
