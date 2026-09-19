import type React from 'react';
import { Button, Card } from '../../../components/ui';
import type { AppConfig } from '../types';

interface SettingsCardProps {
  appConfig: AppConfig | null;
  onUpdate: (partial: Partial<AppConfig>) => void;
  onReset: () => void;
  isLoading: boolean;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  appConfig,
  onUpdate,
  onReset,
  isLoading,
}) => {
  return (
    <Card
      title="应用偏好设置 (ConfigStore)"
      subtitle="类型安全主进程本地持久化存储与动态生效"
      icon="⚙️"
      headerAction={
        <Button size="sm" variant="outline" onClick={onReset} isLoading={isLoading}>
          恢复默认值
        </Button>
      }
    >
      {appConfig ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* 主题模式 */}
          <div className="flex flex-col gap-1.5 bg-background-secondary/40 p-3 rounded-lg border border-border">
            <label htmlFor="theme-select" className="text-foreground-secondary font-medium">
              外观主题 (Theme)
            </label>
            <select
              id="theme-select"
              value={appConfig.theme}
              onChange={(e) => onUpdate({ theme: e.target.value as 'system' | 'light' | 'dark' })}
              className="bg-background-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus-ring"
            >
              <option value="system">跟随系统 (System)</option>
              <option value="light">浅色模式 (Light)</option>
              <option value="dark">深色模式 (Dark)</option>
            </select>
          </div>

          {/* 默认语言 */}
          <div className="flex flex-col gap-1.5 bg-background-secondary/40 p-3 rounded-lg border border-border">
            <label htmlFor="lang-select" className="text-foreground-secondary font-medium">
              界面语言 (Language)
            </label>
            <select
              id="lang-select"
              value={appConfig.language}
              onChange={(e) => onUpdate({ language: e.target.value })}
              className="bg-background-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus-ring"
            >
              <option value="zh-CN">简体中文 (zh-CN)</option>
              <option value="en-US">English (en-US)</option>
              <option value="ja-JP">日本語 (ja-JP)</option>
            </select>
          </div>

          {/* 最小化到托盘 */}
          <div className="flex items-center justify-between bg-background-secondary/40 p-3 rounded-lg border border-border">
            <div>
              <span className="text-foreground font-medium block">点击关闭时最小化到托盘</span>
              <span className="text-[11px] text-foreground-muted block mt-0.5">
                保持后台常驻与托盘图标交互
              </span>
            </div>
            <input
              type="checkbox"
              checked={appConfig.minimizeToTray}
              onChange={(e) => onUpdate({ minimizeToTray: e.target.checked })}
              className="w-4 h-4 rounded border-border text-primary focus-ring cursor-pointer"
            />
          </div>

          {/* 自动检查更新 */}
          <div className="flex items-center justify-between bg-background-secondary/40 p-3 rounded-lg border border-border">
            <div>
              <span className="text-foreground font-medium block">自动检查新版本</span>
              <span className="text-[11px] text-foreground-muted block mt-0.5">
                后台轮询与版本下载通知
              </span>
            </div>
            <input
              type="checkbox"
              checked={appConfig.autoCheckUpdate}
              onChange={(e) => onUpdate({ autoCheckUpdate: e.target.checked })}
              className="w-4 h-4 rounded border-border text-primary focus-ring cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-foreground-muted text-xs">
          正在读取偏好设置...
        </div>
      )}
    </Card>
  );
};
