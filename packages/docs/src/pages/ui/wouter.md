# 路由（wouter）

→ 源码：[packages/renderer/src/entries/home/index.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/entries/home/index.tsx)

```tsx
import { Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
// ...
<Router hook={useHashLocation}>
  <StartupReadyNotifier />
  <App />
</Router>
```

打包后页面经 `loadFile` 从 `file://` 加载（见[原生窗口体验（WCO）](/ui/wco)），History API 的路径路由在 `file://` 下没有服务器配合 rewrite 必然失效；hash 路由只改 `#` 后缀、不触发真实导航，`file://` 下照常工作。

路由声明本身极简，根路径与未知路径统一收敛：

→ 源码：[packages/renderer/src/entries/home/App.tsx](https://github.com/BanShan-Alec/electron-react-monorepo-template/blob/main/packages/renderer/src/entries/home/App.tsx)

```tsx
<Switch>
  <Route path="/dashboard">
    <DashboardFeature />
  </Route>
  <Route path="/architecture">
    <ArchitectureFeature />
  </Route>
  {/* 默认根路径与未知路径统一重定向到 /dashboard */}
  <Route path="/*">
    <Redirect to="/dashboard" replace />
  </Route>
</Switch>
```

路由变化同时是排障叙事的一部分：

```tsx
function NavigationLogger() {
  const [location] = useLocation();
  useEffect(() => {
    logger.info('Route changed', { path: location });
  }, [location]);
  return null;
}
```

「崩溃前用户翻到过哪页」是定位问题的关键线索，主进程看不到这条线——这里的 `logger` 是 preload 暴露的全局日志桥（见[本地日志（electron-log）](/main/logging)）。

## 怎么抄

以「新增一个功能页面」为例：

1. **路由**：`App.tsx` 的 `Switch` 里加一个 `Route`；未知路径已被兜底重定向，不用处理
