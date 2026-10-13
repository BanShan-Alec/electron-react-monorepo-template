# 阶段四：质量保障、调试与 AI 自动化

本文档指导你如何排查运行日志、执行自动化测试，以及通过 AI 完成代码审查。

## 1. 解决什么问题

在桌面应用交付过程中，开发者经常遇到这三个问题：
- 生产环境发生白屏或异常时，无法获取本地日志。
- 难以针对桌面窗口自动化运行真实的端到端测试。
- 代码审查效率低，代码风格和安全隐患难以自动化闭环。

本模板集成本地日志滚动、Playwright E2E 测试和 AI 审查工作流，解决上述问题。

## 2. 日志记录与排查

应用运行日志自动写入本地磁盘：

- Windows 日志路径：`%USERPROFILE%\AppData\Roaming\<appName>\logs\main.log`
- macOS 日志路径：`~/Library/Logs/<appName>/main.log`
- Linux 日志路径：`~/.config/<appName>/logs/main.log`

### 在主进程中使用日志
使用统一导出的日志工具输出信息：

```typescript
import { logger } from '../utils/logger.ts';

logger.info('设备初始化成功');
logger.error('通信连接失败:', error);
```

生产环境下，项目支持接入 Sentry。只需要在环境变量中配置 `SENTRY_DSN`，即可自动上报未经捕获的崩溃堆栈。

## 3. 自动化测试金字塔

项目包含三层测试验证机制：

| 测试类型 | 工具 | 运行命令 | 验证目标 |
| :--- | :--- | :--- | :--- |
| 代码规范与格式化 | Biome | `pnpm lint` | 检查语法规范、格式和潜在错误 |
| 类型安全检查 | TypeScript | `pnpm typecheck` | 全局无类型报错 |
| 单元测试 | Vitest | `pnpm test` | 验证工具函数与业务计算逻辑 |
| 端到端测试 | Playwright | `pnpm test:e2e` | 启动真实 Electron 窗口验证核心交互 |

## 4. 自动化 PR Review 与 AI 复查闭环

项目内置 `@app/pr-review` 自动化工具，与 GitHub Actions 协同工作：

```bash
# 1. 自动前置检查并创建 Pull Request
pnpm pr-review create

# 2. 查看当前 PR 门禁与 CI 执行状态
pnpm pr-review status

# 3. 下载并生成本地 AI 代码评审看板 (Markdown)
pnpm pr-review pull

# 4. 在 PR 发送 /review 指令触发增量复查
pnpm pr-review trigger

# 5. 校验门禁并安全合并到主干分支
pnpm pr-review merge
```

## 5. 避坑指南

- 编写代码时不要使用 `process.cwd()` 解析路径。桌面应用从快捷方式启动时工作目录会发生偏移，必须使用 `__dirname` 计算相对路径。
- 提交代码前必须确保 `pnpm lint` 与 `pnpm typecheck` 均通过，否则 CI 门禁将拦截合并。
- 严禁在预加载脚本中打印敏感数据日志（如用户密码或设备私钥）。
