# 工程化基座

多包工程的底座：让「多包不漂移、配置不复制、依赖不越界」由工具保证，而不是靠人肉约定。

这套基座用 pnpm workspace + catalog、依赖白名单门禁、tsconfig 继承包、单链路环境变量注入、Biome 单工具和 commitlint 钩子，把这五类问题变成「机器说不通过」而不是「靠自觉」。

## 收录的解法

- [依赖管理（monorepo）](/engineering/dependency-management)：pnpm workspace + catalog 收拢公共工具链版本，根目录依赖白名单由 CI 门禁守住，Node 与 pnpm 版本一并钉死
- [环境变量管理（dotenv）](/engineering/env-vars)：根 `.env` 单一加载入口，白名单快照经窗口启动参数注入，渲染层拿到冻结的 `__APP_ENV__`
- [编译配置继承（tsconfig）](/engineering/tsconfig-inheritance)：`@app/tsconfig` 提供 base/node/react 三档，各包 tsconfig 只剩 extends 与 include
- [代码规范与风格（Biome）](/engineering/code-style)：Biome 一份配置接管格式、检查与 import 排序，桶文件、`export *`、循环导入直接报错
- [提交信息规范（commitlint）](/engineering/commit-convention)：commitlint 强制 Conventional Commits，并用自定义规则要求 subject 含简体中文

## 建议阅读顺序

以「给一个新 monorepo 搭这套底座」为例，按依赖顺序六步：

1. [依赖管理（monorepo）](/engineering/dependency-management)——含第 1 步 workspace 骨架与第 3 步依赖白名单
2. [编译配置继承（tsconfig）](/engineering/tsconfig-inheritance)——第 2 步
3. [环境变量管理（dotenv）](/engineering/env-vars)——第 4 步
4. [代码规范与风格（Biome）](/engineering/code-style)——第 5 步
5. [提交信息规范（commitlint）](/engineering/commit-convention)——第 6 步
