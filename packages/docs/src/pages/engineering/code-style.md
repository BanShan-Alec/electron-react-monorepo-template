---

title: 代码规范与风格（Biome）
description: Biome 统一接管格式化、Lint、导入排序与架构红线，覆盖 TS/JSX/JSON/Markdown/YAML 全格式。
---

# 代码规范与风格（Biome）

> **TL;DR**：全仓用 Biome 单一工具替代 ESLint + Prettier，配置收拢在 `.config/biome.json`；桶文件、`export *`、循环引用、React Compiler 纯度与裸用 `ahooks` `useRequest` 均升级为 `error` 级门禁。

## 1. 边界与统一治理原则

本页负责 `.config/biome.json` 的格式化策略、架构级 Lint 规则、`overrides` 局部豁免，以及本地提交与 CI 门禁命令。React 组件七段式书写结构、Props 接口与文件夹本体约定见 [React 组件编写规范](/architecture/react-conventions) 与 [packages/renderer/AGENTS.md](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/AGENTS.md)；渲染层颜色与字号设计令牌门禁见 [设计规范与令牌](/ui/design-tokens)。

关于 Biome 规则分组语义、`overrides` 匹配顺序与文件排除语法，详见 [Biome 配置参考文档](https://biomejs.dev/reference/configuration/)。

- **单一配置文件**：全仓格式化（TS/JS/JSX、JSON/JSONC、Markdown、YAML）、代码检查与 `organizeImports` 均由 `.config/biome.json` 统一控制，排除 `dist`、`node_modules` 与 `.config` 目录本身。
- **架构红线升格为编译期阻断**：将 `noBarrelFile`、`noReExportAll`、`noImportCycles`、`useReactCompiler` 与 `style.noRestrictedImports` 全部设为 `error`，避免反模式进入代码库。

## 2. 核心规则与门禁配置

### 架构红线规则与局部豁免

注意 `noRestrictedImports` 属于 **`style` 分组**（非 `correctness`）；为允许封装层本身引入 `useRequest`，`overrides` 显式对 `packages/renderer/src/hooks/useManualRequest.ts` 关闭该规则，同时放宽测试文件的部分检查：

→ 源码：[.config/biome.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/biome.json)

```json
// 节选：linter 核心架构红线与 overrides 豁免
"linter": {
  "enabled": true,
  "rules": {
    "preset": "recommended",
    "nursery": { "useReactCompiler": "error" },
    "performance": { "noBarrelFile": "error", "noReExportAll": "error" },
    "style": {
      "noRestrictedImports": {
        "level": "error",
        "options": {
          "paths": {
            "ahooks": {
              "message": "禁用直接引用 ahooks useRequest；请求一律使用 src/hooks/useManualRequest.ts",
              "importNames": ["useRequest"]
            }
          }
        }
      }
    },
    "suspicious": { "noImportCycles": "error", "noExplicitAny": "warn" }
  }
},
"overrides": [
  {
    "includes": ["packages/renderer/src/hooks/useManualRequest.ts"],
    "linter": { "rules": { "style": { "noRestrictedImports": "off" } } }
  }
]
```

### 命令行入口与 Git 暂存拦截

根 `package.json` 显式通过 `--config-path=.config` 指向收敛目录，本地 `husky` + `lint-staged` 在提交前对暂存区受支持文件自动修复，CI 执行全量 `pnpm lint`：

→ 源码：[package.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/package.json)

```json
// 节选：lint 脚本与 lint-staged 配置
"lint": "biome check --config-path=.config .",
"lint:fix": "biome check --write --config-path=.config .",
"format": "biome format --write --config-path=.config .",
"lint-staged": {
  "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc,md,yml,yaml}": [
    "biome check --write --config-path=.config --no-errors-on-unmatched"
  ]
}
```

## 3. 校验判据与避坑清单

- **可执行校验判据**：提交前在仓库根目录运行 `pnpm lint`（只读全量检查）或 `pnpm lint:fix`（自动修复格式与导入排序），退出码为 `0` 且无 `error` 级诊断即通过。
- **格式化基准约定**：全局采用 2 空格缩进、100 列宽、JS 单引号（`quoteStyle: "single"`）、JSX 双引号、强制分号与全尾逗号；Markdown 与 YAML 同样受 `biome check` 与 `lint-staged` 拦截。
- **目录排除与测试豁免**：`files.includes` 显式排除 `dist`、`node_modules`、`build/resources` 与 `.config` 自身；测试文件（`e2e/**/*`、`*.spec.ts`、`*.test.ts`）通过 `overrides` 关闭 `useDomNodeTextContent` 与 `noExplicitAny`。
- **桶文件判定边界**：`noBarrelFile` 与 `noReExportAll` 不设白名单，禁止新增只做重导出的 `index.ts` 或 `export *`；形如 `Xxx/index.tsx` 的一组件一文件夹本体实现不构成桶文件（详见 [React 组件编写规范](/architecture/react-conventions)）。
- **豁免只加在唯一封装点**：严禁在业务文件通过 `biome-ignore` 绕过 `noRestrictedImports`；所有请求统一走 [useIpc / useManualRequest](/architecture/react-conventions)，仅 `useManualRequest.ts` 本体享有 `overrides` 豁免。
- **IDE 插件识别配置**：因配置文件不在仓库根目录，若编辑器 Biome 插件未自动生效，需在编辑器配置中显式指定配置目录 `.config`。
