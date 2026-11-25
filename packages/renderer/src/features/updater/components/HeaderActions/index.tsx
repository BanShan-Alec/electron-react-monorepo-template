import { CheckOutlined, CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { App, Button, Dropdown } from 'antd';
import { memo } from 'react';
import type { UseAutoCheckSettingResult } from '../../hooks/useAutoCheckSetting';

// 私有常量
/** 溢出菜单项 key（当前只有一项，用常量避免字面量散落） */
const MORE_MENU_AUTO_CHECK = 'auto-check';

// 可抽离的逻辑处理函数/组件

const _HeaderActions = (props: HeaderActionsProps) => {
  useLingui();

  // ① 变量声明、解构
  const { autoCheck, isDownloading, onClose } = props;

  // ② 组件状态
  const { message, modal } = App.useApp();

  // ③ 网络IO / 异步操作：保存偏好失败给一次性提示（菜单点完即关，没有内联失败位）
  const handleToggleAutoCheck = async () => {
    const next = !autoCheck.checked;
    const saved = await autoCheck.handleChange(next);
    if (!saved) {
      message.error(t`无法保存此设置`);
      return;
    }
    message.success(next ? t`已开启启动时自动检查` : t`已关闭启动时自动检查`);
  };

  // ④ 数据转换 / 派生
  const menuItems = [
    {
      key: MORE_MENU_AUTO_CHECK,
      // 自带勾选图标：antd 的 selectedKeys 只加类名，不会给选中项渲染勾，
      // 而菜单点完即关，用户只能靠这一下勾选确认状态
      label: (
        <span className="flex items-center justify-between gap-8">
          {t`启动时自动检查更新`}
          {autoCheck.checked ? <CheckOutlined className="text-primary" /> : null}
        </span>
      ),
      // 配置尚未拉回时不放行，避免默认值被当成用户真实偏好写回
      disabled: !autoCheck.ready,
    },
  ];

  // ⑤ 逻辑处理函数
  /** 关闭：下载中先确认（用户可能误以为会中断），其余状态直接关 */
  const handleClose = () => {
    if (!isDownloading) {
      onClose();
      return;
    }
    modal.confirm({
      title: t`关闭更新窗口？`,
      content: t`下载会在后台继续，重新打开窗口即可查看进度。`,
      okText: t`关闭窗口`,
      cancelText: t`继续下载`,
      onOk: onClose,
    });
  };

  // ⑥ 组件 Effect

  // ⑦ 组件渲染
  return (
    <div className="no-drag absolute top-2 right-2 flex items-center gap-1">
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: menuItems,
          onClick: ({ key }) => {
            if (key === MORE_MENU_AUTO_CHECK) {
              void handleToggleAutoCheck();
            }
          },
        }}
      >
        <Button
          type="text"
          size="small"
          aria-label={t`更多`}
          aria-haspopup="menu"
          icon={<MoreOutlined />}
          className="h-8 w-8 text-foreground-muted hover:text-foreground"
        />
      </Dropdown>

      <Button
        type="text"
        size="small"
        aria-label={t`关闭`}
        icon={<CloseOutlined />}
        onClick={handleClose}
        className="h-8 w-8 text-foreground-muted hover:text-foreground"
      />
    </div>
  );
};

// 4. Props 类型定义
export interface HeaderActionsProps {
  /** 自动检查偏好（菜单项状态与切换） */
  autoCheck: UseAutoCheckSettingResult;
  /** 是否处于下载中：决定关闭要不要二次确认 */
  isDownloading: boolean;
  /** 关闭窗口（隐藏到后台，下载继续） */
  onClose: () => void;
}

// 5. 导出与 Memo
export const HeaderActions = memo(_HeaderActions);
