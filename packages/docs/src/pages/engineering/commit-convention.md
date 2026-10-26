# 提交信息规范（Commitlint）

> **TL;DR**：commitlint 强制 Conventional Commits，并用自定义规则要求 subject 含简体中文

## 要解决的坑

- 提交信息 `fix`、`修改bug`、`asdf` 随意写，changelog 没法自动生成，版本管理退化成手工记账

## 本仓库的解法

### 6. commitlint 强制 Conventional Commits + 中文描述

→ 源码：[.config/commitlint.config.ts](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.config/commitlint.config.ts)

```ts
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
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-chinese': [RuleConfigSeverity.Error, 'always'],
    'subject-case': [RuleConfigSeverity.Disabled],
  },
};
```

标准 Conventional Commits（type-enum 白名单：`feat`/`fix`/`docs`/`refactor`/……）之上，用自定义插件规则要求 subject 必须含简体中文——提交类型保持机器可解析，描述对团队成员可读，changelogen 自动生成 changelog 依赖的正是这套格式。钩子挂在 husky：

→ 源码：[.husky/commit-msg](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/.husky/commit-msg)

```sh
pnpm exec commitlint --config .config/commitlint.config.ts --edit "$1"
```

规则文件直接用 TypeScript 写（走 `@commitlint/types` 类型检查），由 `pnpm exec` 现场执行，不需要单独的编译步骤；与 Biome 一样收在 `.config/` 里，配置不分家。

## 怎么抄

1. **commitlint**：`extends config-conventional` + 自定义中文 subject 规则，husky `commit-msg` 钩子调用

注意点：

- Biome 与 commitlint 的配置都在 `.config/`，从默认位置挪走之后，所有调用点（脚本、husky、CI）都要显式带路径，漏一处本地与 CI 行为就不一致
