import { DownloadOutlined, RedoOutlined, ReloadOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { UpdaterSnapshot } from '@shared/types/updater';
import { Alert, Button } from 'antd';
import type React from 'react';
import { memo } from 'react';
import {
  getStatusDescription,
  getStatusHeader,
  getUpdaterActions,
  type UpdaterAction,
  type UpdaterActionHandlers,
  type UpdaterActionIcon,
} from '../../status-mapping';

// 可抽离的逻辑处理函数/组件

/** 动作图标：语义键 → antd 图标（本模块只做映射，语义键由状态映射层给出） */
const ACTION_ICONS: Record<UpdaterActionIcon, React.ReactNode> = {
  refresh: <ReloadOutlined />,
  download: <DownloadOutlined />,
  restart: <RedoOutlined />,
};

/** 只读数值读数：占动作按钮的版式位但不借用 disabled 按钮
 * （antd disabled 色板把读数压到 1.8:1，百分比是状态数据，必须保持正文对比度）
 */
function renderReadOnly(action: UpdaterAction, key: string): React.ReactNode {
  return (
    <span
      key={key}
      className="inline-flex h-7 items-center gap-1.5 rounded-md bg-background-sunken px-2 font-mono text-xs tabular-nums text-foreground"
    >
      {action.icon && (
        <span aria-hidden="true" className="text-foreground-secondary">
          {ACTION_ICONS[action.icon]}
        </span>
      )}
      {action.label}
    </span>
  );
}

/** 单个动作按钮：loading/disabled/aria-label/mono/icon 均由状态映射层给出
 * 尺寸对齐 Motrix 的小号动作按钮（h-7 px-2 text-xs）：状态行与按钮必须能同排放下
 */
function renderAction(action: UpdaterAction, key: string): React.ReactNode {
  if (action.readOnly) {
    return renderReadOnly(action, key);
  }

  return (
    <Button
      key={key}
      size="small"
      type={action.variant === 'primary' ? 'primary' : 'default'}
      icon={action.icon ? ACTION_ICONS[action.icon] : undefined}
      loading={action.loading}
      disabled={action.disabled}
      aria-busy={action.loading}
      onClick={action.onClick}
      className={action.mono ? 'h-7 px-2 text-xs font-mono tabular-nums' : 'h-7 px-2 text-xs'}
    >
      {action.label}
    </Button>
  );
}

const _StatusSection = (props: StatusSectionProps) => {
  useLingui();

  // ① 变量声明、解构
  const { snapshot, handlers } = props;

  // ② 组件状态

  // ③ 网络IO / 异步操作

  // ④ 数据转换 / 派生
  const { title, subtitle } = getStatusHeader(snapshot);
  const actions = getUpdaterActions(snapshot, handlers);
  // 语义结论进 Alert 主文案，原始报文降级为描述行（DESIGN §4：错误原文必须可选中复制）
  const errorDescription = getStatusDescription(snapshot);
  const rawError = snapshot.error;

  // ⑤ 逻辑处理函数

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <section aria-live="polite" className="shrink-0">
      <p className="text-xs font-medium text-foreground-secondary m-0">{t`应用更新`}</p>

      <div className="mt-3 flex items-start justify-between gap-4">
        {/* 高度下限保证按钮换行/文案长短变化时状态行不跳版 */}
        <div className="min-h-16 min-w-0 flex-1 pt-0.5">
          <h3 className="text-base leading-5 font-semibold tracking-tight text-foreground m-0">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-normal text-foreground-secondary m-0">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions.primary && renderAction(actions.primary, 'primary')}
          {actions.secondary && renderAction(actions.secondary, 'secondary')}
        </div>
      </div>

      {snapshot.state === 'error' && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          message={errorDescription}
          description={
            rawError ? <span className="break-all select-text">{rawError}</span> : undefined
          }
        />
      )}
    </section>
  );
};

// 4. Props 类型定义
export interface StatusSectionProps {
  /** 更新器状态快照（含 currentVersion） */
  snapshot: UpdaterSnapshot;
  /** 动作路由所需的五个处理器 */
  handlers: UpdaterActionHandlers;
}

// 5. 导出与 Memo
export const StatusSection = memo(_StatusSection);
