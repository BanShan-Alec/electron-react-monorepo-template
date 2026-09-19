# Electron React Monorepo Template

> 基于 **Electron 41 + Vite + React 19 + ContextBridge (Typed IPC) + TailwindCSS + Biome** 构建的现代化、高性能、安全类型友好的桌面应用 Monorepo 模板。

---

## ✨ 核心特性

- 🛡️ **安全的 Typed ContextBridge IPC**：严格遵循 Electron 官方安全最佳实践（`contextIsolation: true` + 沙箱隔离），通过 `@app/shared` 统一管理 IPC 频道常量与 API 强类型接口，在保证最高安全等级的前提下获得极致类型推导。
- 🧱 **高扩展的 ModuleRunner 主进程架构**：主进程采用清晰的模块化设计，统一管理窗口生命周期、安全策略守卫、单实例限制、托盘图标、日志与崩溃守护。
- ⚡ **毫秒级极速开发体验**：基于 Vite 驱动的渲染进程即时热重载（HMR）与主进程/Preload 增量构建。
- 📦 **清晰严谨的 Monorepo 划分**：基于 `pnpm workspace` 划分清晰边界（Main、Preload、Renderer、Shared），各司其职，无循环耦合。
- 🎨 **现代化 React 19 + TailwindCSS 前端**：内置现代化仪表盘界面与丰富原生能力演练（系统信息、原生弹窗、状态持久化、诊断日志）。
- 🧹 **极速工程质量守卫**：全链路采用 [Biome](https://biomejs.dev/) 进行毫秒级代码格式化与 Lint 校验，配合 Husky、lint-staged 与 Commitlint 保障每次提交质量。
- 🚀 **跨平台打包开箱即用**：集成 TypeScript 编写的 `scripts/build.ts` 与收拢的 `build/electron-builder.ts` 配置，支持 Windows、macOS 与 Linux 原生安装包打包。

---

## 📂 项目结构

```text
electron-react-monorepo-template/
├── .config/                  # 工程工具链配置（Biome、Commitlint、changelogen）
├── build/                    # 打包配置与原生静态资源（图标、entitlements 等）
├── docs/                     # 架构文档与开发规范
│   ├── MODULE_RUNNER_ARCHITECTURE.md # 📖 ModuleRunner 模块化主进程架构说明
│   └── CODE_SIGNING_GUIDE.md        # 📖 应用签名与发布指南
├── packages/
│   ├── main/                 # [主进程] 窗口管理、原生系统交互、IPC 监听与模块生命周期
│   ├── preload/              # [Preload] 安全桥接、暴露 window.api 契约
│   ├── renderer/             # [渲染进程] React 19 + TailwindCSS 现代前端应用
│   ├── shared/               # [共享层] 跨进程通用工具、IPC 频道常量与类型定义
│   └── tsconfig/             # 共享的 TypeScript 基础配置
├── scripts/                  # 工程构建与启动脚本（TS 编写）
│   ├── dev.ts                # 开发服务启动与热重启编排
│   └── build.ts              # 跨平台打包构建 CLI
├── pnpm-workspace.yaml       # pnpm monorepo 与依赖 Catalog 配置
├── package.json              # 根项目元数据与通用脚本
└── CONTRIBUTING.md           # 团队工程规范与 Git 提交指南
```

---

## 🚀 快速上手

### 环境要求
- **Node.js**: `>= 22.0.0`
- **pnpm**: `>= 10.0.0`

### 1. 安装依赖
```bash
pnpm install
```

> [!NOTE]
> 本项目根目录已预设 `.npmrc`，内置国内淘宝镜像加速源与 hoisted 软链策略。

### 2. 启动本地开发
```bash
pnpm start
# 或者
npm start
```
执行后将自动启动 Vite Dev Server 并唤起 Electron 窗口。主进程代码改动将自动增量编译并重启应用；前端页面改动享受即时 HMR。

---

## 🛠️ 构建与打包

本项目将打包逻辑收拢于 `scripts/build.ts` 与 `build/electron-builder.ts`：

```bash
# 仅编译各 Package 产物并打包为原生应用目录（快速调试）
pnpm run build:dir

# 打包 Windows 安装程序 (.exe / NSIS)
pnpm run build:win

# 打包 macOS 安装程序 (.dmg)
pnpm run build:mac

# 打包 Linux 安装包 (.deb)
pnpm run build:linux
```

打包生成的可执行文件与安装包将输出至根目录下的 `dist/` 文件夹中。

---

## 💡 进程间通信 (IPC) 最佳实践

本项目采用标准契约分层机制：

### 1. 共享层定义契约 (`packages/shared`)
```ts
// packages/shared/src/ipc/channels.ts
export const IPC_CHANNELS = {
  SYSTEM_GET_INFO: 'system:get-info',
} as const;

// packages/shared/src/ipc/types.ts
export interface ElectronApi {
  system: {
    getSystemInfo: () => Promise<ApiResponse<SystemInfo>>;
  };
}
```

### 2. Preload 暴露安全桥接 (`packages/preload`)
```ts
// packages/preload/src/exposed.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type ElectronApi } from '@app/shared';

export const apiBridge: ElectronApi = {
  system: {
    getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
  },
};

contextBridge.exposeInMainWorld('api', apiBridge);
```

### 3. 前端消费 (`packages/renderer`)
```tsx
// packages/renderer/src/App.tsx
const info = await window.api.system.getSystemInfo();
```

---

## 📋 代码规范与质量保障

- **代码风格与静态检查**：
  ```bash
  pnpm run lint       # 检查格式与规范
  pnpm run lint:fix   # 自动修复可修复的格式与 Lint 问题
  pnpm run typecheck  # 执行全项目 TypeScript 类型检查
  ```
- **提交规范**：遵循 Conventional Commits 规范，提交信息必须包含简体中文说明。详情参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 📄 License

本项目采用 [MIT License](LICENSE) 开源协议。
