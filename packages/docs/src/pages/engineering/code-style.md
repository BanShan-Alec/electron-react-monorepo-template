# 代码规范与风格（Biome）

> **TL;DR**：Biome 一份配置接管格式、检查与 import 排序，桶文件、`export *`、循环导入直接报错

## 要解决的坑

- Prettier 管格式、ESLint 管检查，import 排序还得再配一个插件，三套配置互相打架，规则形同虚设

## 本仓库的解法

### 5. Biome 单工具：格式、检查、import 排序三合一

→ 源码：[.config/biome.json](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/biome.json)

```json
"linter": {
  "enabled": true,
  "rules": {
    "preset": "recommended",
    "performance": {
      "noBarrelFile": "error",
      "noReExportAll": "error"
    },
    "suspicious": {
      "noImportCycles": "error"
      // ...其余为个别规则的开关项（noExplicitAny、noConfusingVoidType 等）
    }
  }
},
"assist": {
  "enabled": true,
  "actions": {
    "source": {
      "organizeImports": "on"
    }
  }
}
```

Prettier + ESLint + import 插件的三套配置换成 Biome 一份 JSON：缩进、引号、行宽在 `formatter` 段，架构红线升到 `error` 级——桶文件（`noBarrelFile`）、`export *`（`noReExportAll`）、循环导入（`noImportCycles`）直接编译不过关。检查规则还能承载架构约束，比如禁掉绕过统一请求层的 hook：

```json
"noRestrictedImports": {
  "options": {
    "paths": {
      "ahooks": {
        "message": "禁用直接引用 ahooks useRequest；请求一律使用 src/hooks/useManualRequest.ts",
        "importNames": ["useRequest"]
      }
    }
  }
}
```

工具约定俗成放 `.config/` 目录而不是仓库根，根目录只留业务与发布配置；因为配置不在默认位置，所有命令显式带 `--config-path`：

```json
"lint": "biome check --config-path=.config .",
"lint:fix": "biome check --write --config-path=.config ."
```

本地防护靠 husky + lint-staged：`pre-commit` 钩子执行 `pnpm exec lint-staged`，只对暂存文件跑 `biome check --write`，提交即修复；同一套命令在 CI 的 lint job 里全量复跑，本地跳过钩子也绕不过门禁。

## 怎么抄

1. **Biome**：配置放 `.config/biome.json`，命令带 `--config-path`，husky + lint-staged 管提交、CI 管兜底

注意点：

- Biome 与 commitlint 的配置都在 `.config/`，从默认位置挪走之后，所有调用点（脚本、husky、CI）都要显式带路径，漏一处本地与 CI 行为就不一致
