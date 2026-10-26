# 主进程运行时

界面、可观测性、桌面原生能力三块现成基建，拿来即用。本维度收录可观测性与桌面原生能力两块在主进程侧的解法；界面部分见 [界面与交互](/ui)。

## 收录的解法

- [全链路追踪（W3C trace）](/main/tracing)：W3C traceparent 从 preload 贯穿主进程，日志前缀、`traces.ndjson` 与 `Result.traceId` 三个出口串起两端。
- [本地日志（electron-log）](/main/logging)：主进程、每个渲染窗口、遥测拓扑分文件落盘并独立轮转，作用域前缀与渲染层日志桥双写。
- [崩溃上报（Sentry）](/main/crash-reporting)：只在打包后且配置 DSN 时启用，渲染进程崩溃由主进程代报。
- [托盘常驻与单实例（Tray + 单实例锁）](/main/tray-single-instance)：单实例锁挡住多开，关闭行为分流到托盘常驻，托盘提供复活与退出入口。
- [配置持久化（electron-store）](/main/config-persistence)：运行期配置落盘到 userData，zod 校验兜住坏文件与非法更新。
