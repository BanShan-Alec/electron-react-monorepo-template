---

title: 提交信息规范（Commitlint）
description: Commitlint 强制 Conventional Commits 与中文 subject 约束，并与 changelogen 更新日志小节映射对齐。
---

# 提交信息规范（Commitlint）

> **TL;DR**：每次提交必须满足 Conventional Commits 格式且 `subject` 包含简体中文，由 Husky `commit-msg` 钩子强制拦截；`changelogen` 会按提交 `type` 自动归类生成对应小节并判定 SemVer 修订级别。

## 1. 边界与格式原则

本页负责 Git 提交信息的格式校验、`subject-chinese` 自定义插件规则以及提交类型到 `CHANGELOG.md` 小节的映射约定。版本 Tag 推进、GitHub Release 创建与发版工作流编排见 [发版流水线](/delivery/release-pipeline)。

标准的 `type(scope): subject` 语法与 Breaking Change 标记规范详见 [Conventional Commits 规范](https://www.conventionalcommits.org/)。

- **标准前缀 + 中文说明**：`type` 必须落在 `type-enum` 枚举内，`subject` 必须包含至少一个中文字符（`/[\u4e00-\u9fa5]/`），且关闭 `subject-case` 大小写限制以便中英混排。
- **禁止跳过钩子**：本地提交一律经过 `.husky/commit-msg`；AI 协作者产出提交文案时也必须严格满足该格式。

## 2. 核心规则与映射配置

### Commitlint 规则与中文自定义插件

→ 源码：[.config/commitlint.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/commitlint.config.ts)

```ts
// 节选：commitlint 中文插件与规则配置（type-enum 允许 11 种标准前缀，含 revert）
const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-chinese': (parsed) => {
          const { subject } = parsed;
          if (!subject) {
            return [false, '提交说明（subject）不能为空'];
          }
          const hasChinese = /[\u4e00-\u9fa5]/.test(subject);
          return [
            hasChinese,
            '提交说明（subject）必须包含简体中文描述，例如: feat: 增加系统托盘功能',
          ];
        },
      },
    },
  ],
  rules: {
    'subject-chinese': [RuleConfigSeverity.Error, 'always'],
    'subject-case': [RuleConfigSeverity.Disabled],
  },
};
```

### Git 钩子触发链路

→ 源码：[.husky/commit-msg](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.husky/commit-msg)

```sh
pnpm exec commitlint --config .config/commitlint.config.ts --edit "$1"
```

### Changelogen 类型映射与 SemVer 规则

`.config/changelog.config.ts` 显式为 `feat`、`fix`、`perf`、`refactor`、`docs`、`build`、`chore`、`test`、`style`、`ci` 全部 10 种类型分别建立带 Emoji 的 `CHANGELOG.md` 小节（**不会自动折叠** `chore` / `style` 等变更），并定义各类型对应的 SemVer 升降级策略（仅 `feat` 为 `minor`，其余为 `patch`；`revert` 仅用于提交拦截，未列入小节映射）：

→ 源码：[.config/changelog.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/changelog.config.ts)

```ts
export default {
  types: {
    feat: { title: '🚀 新增特性 (Features)', semver: 'minor' },
    fix: { title: '🩹 缺陷修复 (Bug Fixes)', semver: 'patch' },
    perf: { title: '⚡ 性能优化 (Performance)', semver: 'patch' },
    refactor: { title: '💅 代码重构 (Refactoring)', semver: 'patch' },
    docs: { title: '📖 文档更新 (Documentation)', semver: 'patch' },
    build: { title: '📦 构建与依赖 (Build & Deps)', semver: 'patch' },
    chore: { title: '🏡 工程维护 (Chores)', semver: 'patch' },
    test: { title: '✅ 测试相关 (Testing)', semver: 'patch' },
    style: { title: '🎨 代码风格 (Styles)', semver: 'patch' },
    ci: { title: '🤖 持续集成 (CI/CD)', semver: 'patch' },
  },
};
```

## 3. 校验判据与避坑清单

- **本地手动验证命令**：提交前可通过管道快速验证消息合规性：`echo "feat(tray): 增加系统托盘快捷退出逻辑" | pnpm exec commitlint --config .config/commitlint.config.ts`，退出码为 `0` 即放行。
- **正反例速查**：
  - 合规：`feat(tray): 增加系统托盘快捷退出逻辑`、`fix(csp): 收紧生产环境脚本白名单`
  - 拦截：`feat: add system tray`（缺中文，触发 `subject-chinese`）、`修复闪退问题`（缺标准前缀，触发 `type-empty`）
- **保持提交说明面向上下游可读**：由于 `docs`、`chore`、`refactor`、`ci` 等提交都会直接进入对应发版小节并写入 `CHANGELOG.md`，撰写 `subject` 时应避免无意义的 `update` 或调试碎词。
- **发版脚本消费同一真源**：`pnpm changelog` 与 `pnpm release:*` 会直接读取 `.config/changelog.config.ts` 的 `semver` 映射决定版本号步进；`type-enum` 中仅 `revert` 未在 `changelog.config.ts` 配置独立小节。
