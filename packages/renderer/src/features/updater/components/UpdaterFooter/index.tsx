import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button, Switch } from 'antd';
import { memo } from 'react';
import type { UseAutoCheckSettingResult } from '../../hooks/useAutoCheckSetting';

// 可抽离的逻辑处理函数/组件

const _UpdaterFooter = (props: UpdaterFooterProps) => {
  useLingui();

  // ① 变量声明、解构
  const { autoCheck, onClose } = props;

  // ② 组件状态

  // ③ [已脱敏]IO / 异步操作

  // ④ 数据转换 / 派生

  // ⑤ 逻辑处理函数

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <footer className="shrink-0 border-t border-border bg-background px-5 py-3 flex items-center justify-between gap-3 select-none">
      <div className="min-w-0 flex items-start gap-2.5">
        <Switch
          id="updater-auto-check"
          size="small"
          className="mt-0.5"
          checked={autoCheck.checked}
          disabled={!autoCheck.ready}
          onChange={(checked) => {
            void autoCheck.handleChange(checked);
          }}
        />
        {/* 次级行固定占位：文案有无不改变高度，避免保存失败时底栏跳版 */}
        <label
          htmlFor="updater-auto-check"
          className="cursor-pointer select-none text-xs text-foreground-secondary leading-4 m-0"
        >
          <span className="block">{t`启动时自动检查更新`}</span>
          <span className="block min-h-4 mt-0.5">
            {autoCheck.failed ? (
              <span className="text-danger">{t`保存失败，请重试`}</span>
            ) : (
              <span className="invisible" aria-hidden="true">
                {t`保存失败，请重试`}
              </span>
            )}
          </span>
        </label>
      </div>

      <Button onClick={onClose}>{t`关闭`}</Button>
    </footer>
  );
};

// 4. Props 类型定义
export interface UpdaterFooterProps {
  /** 自动检查偏好设置状态与切换处理器 */
  autoCheck: UseAutoCheckSettingResult;
  /** 关闭窗口（隐藏到后台，下载继续） */
  onClose: () => void;
}

// 5. 导出与 Memo
export const UpdaterFooter = memo(_UpdaterFooter);
