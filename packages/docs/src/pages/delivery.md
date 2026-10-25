# 交付门禁与 AI 协同

从打包到发版的最后一公里，加上 AI 参与评审的闭环。

## 收录的解法

| 解法 | 一句话说明 | 状态 |
| --- | --- | --- |
| 动态打包 | electron-builder + TypeScript 配置，按平台出包、产物精确放行 | 待写 |
| 源码防泄露 | SourceMap 多重处理，错误堆栈能定位、源码映射不进安装包 | 待写 |
| 产物验证 | 打包后真实启动 + asar 体积门禁，烂包合入前拦下 | 待写 |
| CI 门禁 | GitHub Actions 类型、规范、单测、E2E 并行，全绿放行 | 待写 |
| 差分热更新 | electron-updater 增量更新，下载量小、升级快 | 待写 |
| AI 评审闭环 | pr-review CLI + OpenCodeReview，PR 评论触发 AI 审查 | 待写 |
