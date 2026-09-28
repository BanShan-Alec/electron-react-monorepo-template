import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { AppConfig } from '@shared/schemas/config';
import { Button, Card, Checkbox, Select, Skeleton, Switch } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';

// 私有常量
const LANGUAGE_OPTIONS = [
  { label: '简体中文 (zh-CN)', value: 'zh-CN' },
  { label: 'English (en-US)', value: 'en-US' },
];

const TOGGLE_ROW_CLASS =
  'settings-toggle-row flex items-center justify-between bg-background-secondary p-3 rounded-lg border border-border';

// 可抽离的逻辑处理函数/组件

const _SettingsCard = (props: ISettingsCardProps) => {
  useLingui();
  // 变量声明、解构
  const { appConfig, onUpdate, onReset, isLoading } = props;

  // 组件状态

  // 网络IO

  // 数据转换
  const showSkeleton = isLoading && appConfig === null;
  const themeOptions = [
    { label: t`跟随系统 (System)`, value: 'system' },
    { label: t`浅色模式 (Light)`, value: 'light' },
    { label: t`深色模式 (Dark)`, value: 'dark' },
  ];

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={
        <CardTitle
          icon="⚙️"
          title={t`应用偏好设置 (ConfigStore)`}
          subtitle={t`类型安全主进程本地持久化存储与动态生效`}
        />
      }
      extra={
        <Button size="small" loading={isLoading} onClick={onReset}>
          {t`恢复默认值`}
        </Button>
      }
    >
      {showSkeleton ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : appConfig ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {/* 主题模式 */}
          <div className="flex flex-col gap-1.5 bg-background-secondary p-3 rounded-lg border border-border">
            <label htmlFor="theme-select" className="text-foreground-secondary font-medium">
              {t`外观主题 (Theme)`}
            </label>
            <Select
              id="theme-select"
              value={appConfig.theme}
              options={themeOptions}
              onChange={(value) => onUpdate({ theme: value as AppConfig['theme'] })}
            />
          </div>

          {/* 默认语言 */}
          <div className="flex flex-col gap-1.5 bg-background-secondary p-3 rounded-lg border border-border">
            <label htmlFor="lang-select" className="text-foreground-secondary font-medium">
              {t`界面语言 (Language)`}
            </label>
            <Select
              id="lang-select"
              value={appConfig.language}
              options={LANGUAGE_OPTIONS}
              onChange={(value) => onUpdate({ language: value as AppConfig['language'] })}
            />
          </div>

          {/* 最小化到托盘 */}
          <div className={TOGGLE_ROW_CLASS}>
            <label htmlFor="tray-switch" className="cursor-pointer select-none flex-1 pr-3">
              <span className="text-foreground font-medium block">{t`点击关闭时最小化到托盘`}</span>
              <span className="text-[11px] text-foreground-muted block mt-0.5">
                {t`保持后台常驻与托盘图标交互`}
              </span>
            </label>
            <Switch
              id="tray-switch"
              checked={appConfig.minimizeToTray}
              onChange={(checked) => onUpdate({ minimizeToTray: checked })}
            />
          </div>

          {/* 自动检查更新 */}
          <div className={TOGGLE_ROW_CLASS}>
            <div>
              <span className="text-foreground font-medium block">{t`自动检查新版本`}</span>
              <span className="text-[11px] text-foreground-muted block mt-0.5">
                {t`后台轮询与版本下载通知`}
              </span>
            </div>
            <Checkbox
              checked={appConfig.autoCheckUpdate}
              onChange={(e) => onUpdate({ autoCheckUpdate: e.target.checked })}
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

// props 类型定义
interface ISettingsCardProps {
  appConfig: AppConfig | null;
  onUpdate: (partial: Partial<AppConfig>) => void;
  onReset: () => void;
  isLoading: boolean;
}

const SettingsCard = memo(_SettingsCard);

export { SettingsCard };
export default SettingsCard;
