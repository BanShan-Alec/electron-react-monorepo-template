# 交付门禁

从打包出安装包到用户手上完成升级，中间每一环——产物验真、CI 门禁、版本发布、差分升级、AI 评审——都由脚本或流水线自动把关，人只在结果上做决策。

## 收录的解法

- [应用打包（electron-builder）](/delivery/packaging)：electron-builder 用 TypeScript 写配置，应用身份收敛到根 `package.json`，三平台 target 由同一 CLI 入口分发
- [源码映射隔离（SourceMap）](/delivery/sourcemap)：生产构建用 `hidden` 模式生成 `.map`，Sentry 上传后删除本地文件，asar 再排除映射与类型声明
- [CI 并行门禁（GitHub Actions）](/delivery/ci-gates)：typecheck / lint / test / e2e / docs 五路并行，lint 顺带跑 `verify:prebuild` 做打包前静态拦截
- [应用更新（electron-updater）](/delivery/auto-update)：关掉自动下载与自动安装，改由快照状态机 + IPC 推送 + 孤儿下载看门狗推进
- [发版流水线（changelogen + tag）](/delivery/release-pipeline)：changelogen 本地提版并锁 tag，CI 三平台以 `-p never` 构建，单一 publish job 统一发 Release

产物验真见 [产物冒烟测试（dist 启动验证）](/testing/artifact-smoke)，AI 评审见 [AI 评审闭环（OpenCodeReview + pr-review）](/ai/review-loop)。

这条交付链路把以上每一环都固化成可执行的脚本与流水线，违规配置、坏产物、越权合并都在既定关卡被拦下。

## 建议阅读顺序

原文「怎么抄」给出的依赖顺序（以「从零搭起这条交付链」为例）：

1. [应用打包（electron-builder）](/delivery/packaging)
2. [CI 并行门禁（GitHub Actions）](/delivery/ci-gates)
3. [源码映射隔离（SourceMap）](/delivery/sourcemap)
4. [发版流水线（changelogen + tag）](/delivery/release-pipeline)
5. [应用更新（electron-updater）](/delivery/auto-update)
