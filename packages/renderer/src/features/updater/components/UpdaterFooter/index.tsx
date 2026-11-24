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

  // ③ 网络IO / 异步操作

  // ④ 数据转换 / 派生
  // 保存失败就地把说明行换成错误提示（Motrix 同款：不加行、不跳版）
  const hint = autoCheck.failed ? t`无法保存此设置` : t`应用启动时`;

  // ⑤ 逻辑处理函数

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <footer className="shrink-0 border-t border-border/60 bg-background-sunken px-6 py-3.5 flex items-center justify-between gap-4 select-none">
      <div className="flex min-w-0 items-center gap-2.5">
        <Switch
          id="updater-auto-check"
          size="small"
          checked={autoCheck.checked}
          disabled={!autoCheck.ready}
          onChange={(checked) => {
            void autoCheck.handleChange(checked);
          }}
          aria-describedby="updater-auto-check-hint"
        />
        <div className="min-w-0">
          <label
            htmlFor="updater-auto-check"
            className="block cursor-pointer select-none text-xs font-medium text-foreground leading-4"
          >
            {t`自动检查更新`}
          </label>
          <p
            id="updater-auto-check-hint"
            aria-live="polite"
            className={`truncate text-xs leading-4 m-0 ${autoCheck.failed ? 'text-danger' : 'text-foreground-secondary'}`}
          >
            {hint}
          </p>
        </div>
      </div>

      <Button className="min-w-20" onClick={onClose}>
        {t`关闭`}
      </Button>
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
