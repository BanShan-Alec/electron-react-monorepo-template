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
} from '../../status-mapping';

// 可抽离的逻辑处理函数/组件

/** 单个动作按钮：loading/disabled/aria-label/mono 均由状态映射层给出 */
function renderAction(action: UpdaterAction, key: string): React.ReactNode {
  return (
    <Button
      key={key}
      type={action.variant === 'primary' ? 'primary' : 'default'}
      loading={action.loading}
      disabled={action.disabled}
      aria-label={action.ariaLabel}
      onClick={action.onClick}
      className={action.mono ? 'font-mono tabular-nums' : undefined}
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

  // ③ [已脱敏]IO / 异步操作

  // ④ 数据转换 / 派生
  const { title, subtitle } = getStatusHeader(snapshot);
  const actions = getUpdaterActions(snapshot, handlers);
  // 错误主文案按语义码本地化，原始报错降级为次要行保留排查线索
  const errorDescription = getStatusDescription(snapshot);

  // ⑤ 逻辑处理函数

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <section aria-live="polite" className="shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground m-0 leading-5">{title}</h3>
          <p className="text-xs text-foreground-secondary m-0 mt-0.5 leading-4">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions.secondary && renderAction(actions.secondary, 'secondary')}
          {actions.primary && renderAction(actions.primary, 'primary')}
        </div>
      </div>

      {snapshot.state === 'error' && (
        <div className="mt-3 flex flex-col gap-2">
          <Alert type="error" showIcon message={t`更新发生错误`} description={errorDescription} />
          {snapshot.error && (
            <p className="text-xs text-foreground-secondary m-0 break-all select-text">
              {snapshot.error}
            </p>
          )}
        </div>
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
