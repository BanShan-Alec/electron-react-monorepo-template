# 项目贡献与工程规范指南 (Engineering Standards)

本项目采用严格的现代工程规范，通过自动化工具链保障代码质量、提交历史一致性与版本发布的规范性。

---

## 一、代码风格与静态检查规范 (Biome)

本项目使用 **[Biome](https://biomejs.dev/)** 作为统一的代码格式化器与静态检查器（Formatter & Linter），单二进制极速运行，替代繁重的 ESLint + Prettier。

### 1. 核心格式约定
- **缩进**：2 个空格（Space）
- **单行宽度**：100 字符
- **引号风格**：JS/TS 统一使用单引号（`single`），JSX 属性使用双引号（`double`）
- **语句结尾**：强制显式分号（`semicolons: "always"`）
- **尾随逗号**：多行自动补充（`trailingCommas: "all"`）
- **Import 组织**：自动按依赖类型与字典序整理导入顺序

### 2. 常用开发指令
```bash
# 检查整个项目的代码风格与规范
npm run lint

# 自动修复所有可修复的格式与 Lint 问题
npm run lint:fix

# 仅执行全局代码格式化
npm run format
```

---

## 二、Git Commit 提交规范 (Conventional Commits)

本项目遵循国际通用的 **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/)** 规范，并通过 **Commitlint** 与 **Husky** 在本地提交时进行自动化硬校验。

### 1. 提交信息结构
```text
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### 2. 允许的 Type 类型与中文示例
| Type | 说明 | 示例 |
| :--- | :--- | :--- |
| `feat` | 新增功能 / 新特性 | `feat(router): 增加系统托盘与原生交互能力` |
| `fix` | 修复缺陷或 Bug | `fix(window): 解决应用启动时的白屏闪烁问题` |
| `refactor` | 重构（既不新增功能，也不修复 Bug 的代码变动） | `refactor(scripts): 将启动与打包脚本迁移至 TypeScript` |
| `perf` | 性能提升与优化 | `perf(renderer): 优化仪表盘硬件信息的渲染性能` |
| `style` | 不影响代码逻辑的样式/格式变动 | `style: 依据 Biome 规范调整代码格式` |
| `docs` | 仅文档变动 | `docs: 完善项目规范与版本发布指南` |
| `test` | 增加或修改测试用例 | `test: 增加 tRPC 路由模块单元测试` |
| `build` | 构建系统、打包配置或外部依赖变动 | `build: 升级 electron-builder 构建配置` |
| `ci` | CI/CD 持续集成配置变更 | `ci: 优化 GitHub Actions 缓存机制` |
| `chore` | 日常维护、辅助工具或杂项 | `chore: 接入 changelogen 自动化版本管理` |
| `revert` | 回滚先前的提交 | `revert: 回滚提交 32cb089` |

### 3. 硬性要求
- **提交说明强制使用简体中文**：`description`（Subject 部分）**必须包含简体中文**，杜绝使用英文或无意义拼音敷衍，否则会被 Commitlint 钩子硬拦截；
- `type` 必须全小写；
- 冒号 `:` 后面必须有一个英文空格；
- 示例：`feat: 增加文件选择原生对话框` 或 `fix(ipc): 修复外部链接协议未校验的安全隐患`。

---

## 三、Git 自动化工作流 (Husky + lint-staged)

代码提交时将自动触发两道质量守卫：

1. **Pre-commit 钩子 (`.husky/pre-commit`)**：
   - 触发 `lint-staged`，对本次暂存区（Git Staged）的文件运行 `biome check --write`。
   - 自动格式化被修改的文件，若存在无法自动修复的语法/Lint 报错则中断提交。
2. **Commit-msg 钩子 (`.husky/commit-msg`)**：
   - 触发 `commitlint` 检验提交信息：必须符合 Conventional Commits 规范且**必须包含简体中文说明**。

---

## 四、版本号与 CHANGELOG 自动化管理 (changelogen)

本项目采用 **[changelogen](https://github.com/unjs/changelogen)** 自动化解析 Git 提交记录、智能推导版本演进并生成美观的变更日志。

### 1. 常用版本管理指令
```bash
# 1. 预览即将生成的 CHANGELOG（不修改任何文件）
npm run changelog

# 2. 自动根据 Commit 历史推导语义化版本（feat 触发 minor，fix 触发 patch），
#    并自动更新 package.json、生成 CHANGELOG.md、执行 git commit 以及创建 git tag
npm run release

# 3. 显式指定版本步长进行 Release：
npm run release:patch   # 补丁升级（如 3.1.0 -> 3.1.1）
npm run release:minor   # 次版本升级（如 3.1.0 -> 3.2.0）
npm run release:major   # 主版本升级（如 3.1.0 -> 4.0.0）
```

### 2. 发布流程规范
1. 确保工作区无未提交的代码：`git status` 为 clean；
2. 确保所有质量检查通过：`npm run lint` 与 `npm run typecheck` 均为 0 错误；
3. 运行对应的 Release 命令（如 `npm run release:minor`）；
4. 推送代码与版本标签至远程仓库：
   ```bash
   git push origin main --follow-tags
   ```
5. GitHub Actions 将监听推送到远端的版本 Tag（如 `v3.2.0`），自动构建 Windows、macOS 与 Linux 原生安装包并发布到 GitHub Releases。

---

## 五、工程配置文件收拢规范 (.config/ 与 build/)

为保持项目根目录极致清爽，工具链配置与构建资产按职责收拢存放。

`.config/` —— Lint 与版本发布工具链配置：
- [`.config/biome.json`](.config/biome.json)：Biome 代码格式化与 Lint 校验规则
- [`.config/commitlint.config.ts`](.config/commitlint.config.ts)：Conventional Commits 校验与简体中文要求插件
- [`.config/changelog.config.ts`](.config/changelog.config.ts)：changelogen 变更日志分类映射与版本推导配置

`build/` —— 生产构建与打包域：
- [`build/electron-builder.ts`](build/electron-builder.ts)：Electron 生产环境打包配置与过滤规则
- [`build/resources/`](build/resources)：打包资源（应用图标、签名 entitlements 等），经 `extraResources` 复制进安装包


