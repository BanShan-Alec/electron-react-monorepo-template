import { memo, useState } from 'react';
import { Header, type HeaderTab } from '@/components/layout/Header';
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
const DEFAULT_TAB: HeaderTab = 'dashboard';

/**
 * 应用主界面内容编排（tab 状态、面板摆放）。
 * 壳层 Provider 已由 AppProviders 统包。
 */
const _App = (_props: IProps) => {
  const [activeTab, setActiveTab] = useState<HeaderTab>(DEFAULT_TAB);
  const isDashboard = activeTab === 'dashboard';

  return (
    <div className="h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* App Header & Navigation */}
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 p-6 max-w-7xl mx-auto w-full overflow-y-auto stable-scrollbar">
        {/* 两块面板均保持挂载、仅切换显隐：卸载会丢失域内状态并重复发起 IPC（README「已知取舍」） */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5${isDashboard ? '' : ' hidden'}`}>
          <PingFeature />
          <SystemInfoFeature />
          <CounterFeature />
          <CalculatorFeature />
          <SettingsFeature />
          <NativeDialogsFeature />
          <LoggingFeature />
          <DevToolsFeature />
        </div>

        <div className={isDashboard ? 'hidden' : undefined}>
          <ArchitectureFeature />
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
