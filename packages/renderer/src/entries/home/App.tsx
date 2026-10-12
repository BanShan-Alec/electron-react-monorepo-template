import { memo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/Header';
import { KeepAliveRoute } from '@/components/layout/KeepAliveRoute';
import { ArchitectureFeature } from '@/features/architecture';
import { CalculatorFeature } from '@/features/calculator';
import { CounterFeature } from '@/features/counter';
import { DevToolsFeature } from '@/features/devtools';
import { LoggingFeature } from '@/features/logging';
import { NativeDialogsFeature } from '@/features/native-dialogs';
import { PingFeature } from '@/features/ping';
import { SettingsFeature } from '@/features/settings';
import { SystemInfoFeature } from '@/features/system-info';

// 私有常量
const VALID_ROUTES = ['/dashboard', '/architecture'] as const;
const DEFAULT_ROUTE = '/dashboard';

/**
 * 应用主界面内容编排（Hash 路由编排、KeepAlive 面板摆放）。
 * 壳层 Provider 已由 AppProviders 与 Router 统包。
 */
const _App = (_props: IProps) => {
  const [location, navigate] = useLocation();

  // 规范重定向：遇到根路径 '/' 或未知 Hash，统一规范化重定向到 /dashboard
  useEffect(() => {
    if (!VALID_ROUTES.includes(location as (typeof VALID_ROUTES)[number])) {
      navigate(DEFAULT_ROUTE, { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* App Header & Navigation */}
      <Header />

      {/* Main Content Area */}
      {/* 滚动容器必须全宽：max-w/mx-auto 一旦挂回 main，宽窗口下滚动条会随内容区一起被居中推离窗口右缘 */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto stable-scrollbar">
        <div className="max-w-7xl mx-auto p-6">
          {/* 两块面板均保持挂载、仅通过 KeepAliveRoute 切换显隐：卸载会丢失域内状态并重复发起 IPC（README「已知取舍」） */}
          <KeepAliveRoute path="/dashboard" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <PingFeature />
            <SystemInfoFeature />
            <CounterFeature />
            <CalculatorFeature />
            <SettingsFeature />
            <NativeDialogsFeature />
            <LoggingFeature />
            <DevToolsFeature />
          </KeepAliveRoute>

          <KeepAliveRoute path="/architecture">
            <ArchitectureFeature />
          </KeepAliveRoute>
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
