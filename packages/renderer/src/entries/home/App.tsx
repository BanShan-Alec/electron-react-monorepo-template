import { memo } from 'react';
import { Redirect, Route, Switch } from 'wouter';
import { Header } from '@/components/layout/Header';
import { ArchitectureFeature } from '@/features/architecture';
import { DashboardFeature } from '@/features/dashboard';

/**
 * 应用主界面内容编排（传统 Switch/Route 声明式切换）。
 * 壳层 Provider 已由 AppProviders 与 Router 统包。
 */
const _App = (_props: IProps) => {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* App Header & Navigation */}
      <Header />

      {/* Main Content Area */}
      {/* 滚动容器必须全宽：max-w/mx-auto 一旦挂回 main，宽窗口下滚动条会随内容区一起被居中推离窗口右缘 */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto stable-scrollbar">
        <div className="max-w-7xl mx-auto p-6">
          <Switch>
            <Route path="/dashboard">
              <DashboardFeature />
            </Route>
            <Route path="/architecture">
              <ArchitectureFeature />
            </Route>
            {/* 默认与未知路径重定向到 /dashboard */}
            <Route path="/">
              <Redirect to="/dashboard" replace />
            </Route>
            <Route>
              <Redirect to="/dashboard" replace />
            </Route>
          </Switch>
        </div>
      </main>
    </div>
  );
};

// props 类型定义
type IProps = Record<string, never>;

const App = memo(_App);

export { App };
export default App;
