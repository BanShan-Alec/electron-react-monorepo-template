# 架构组织

主进程与渲染进程各自的代码组织方式：加功能是加模块、加目录，不是改祖传代码。

## 收录的解法

- [多窗口入口（MPA）](/architecture/multi-window)：home 与 updater 各有独立 `index.html` 入口，主进程只按 URL 或物理路径加载，更新窗口不背主应用的路由与卡片。
- [功能域组织（features 目录）](/architecture/feature-domains)：渲染层一个业务域一个自包含目录，域间禁止互相 import，删功能就是删目录。
- [组件目录结构（一组件一文件夹）](/architecture/component-structure)：组件一律 `Xxx/index.tsx`，组件私有的 hook、lib、样式住同一文件夹，目录即组件边界。
- [React 组件编写规范（代码分区与 hooks 约定）](/architecture/react-conventions)：组件与 hook 共用一套分区注释，状态与 IPC 副作用收在 hook，展示组件只收 props 与回调。
- [模块生命周期（ModuleRunner）](/architecture/module-lifecycle)：每个系统能力实现只含 `enable()` 的模块，由 ModuleRunner 串成顺序 Promise 链，删一行即整体退场。
- [分层架构（Controller/Service）](/architecture/layering)：IPC 事件只进 Controller，业务住 Service，纯逻辑服务不 import Electron，可在 node 环境直接单测。

这套结构用物理边界回答以上问题：窗口按入口切、渲染层按业务域切、主进程按模块和分层切——边界落成目录，编译器和评审都看得见。
