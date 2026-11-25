import { CheckOutlined, CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { App, Button, Dropdown } from 'antd';
import { memo } from 'react';
import type { UseAutoCheckSettingResult } from '../../hooks/useAutoCheckSetting';

// 私有常量
/** 溢出菜单项 key（当前只有一项，用常量避免字面量散落） */
const MORE_MENU_AUTO_CHECK = 'auto-check';

/** 头部工具条按钮共用样式：静音图标按钮，hover 才升到正文色 */
const TOOL_BUTTON_CLASS = 'h-8 w-8 text-foreground-muted hover:text-foreground';

// 可抽离的逻辑处理函数/组件

const _HeaderActions = (props: HeaderActionsProps) => {
  useLingui();

  // ① 变量声明、解构
  const { autoCheck, isDownloading, onClose } = props;
  const { message, modal } = App.useApp();

  // ② 组件状态

  // ③ 网络IO / 异步操作（无通信 Hook：偏好读写封装在 useAutoCheckSetting 内）

  // ④ 数据转换 / 派生
  const autoCheckLabel = t`启动时自动检查更新`;
  const menuItems = [
    {
      key: MORE_MENU_AUTO_CHECK,
      // 勾选状态自己表达：antd v6（@rc-component/menu）的 selectedKeys 只加类名、不渲染勾，
      // 也不产出 aria-checked。视觉用勾号，读屏用 sr-only 文本，保证不只靠颜色/图形传状态
      label: (
        <span className="flex items-center gap-3">
          {autoCheckLabel}
          {autoCheck.checked ? <CheckOutlined aria-hidden className="text-primary" /> : null}
          <span className="sr-only">{autoCheck.checked ? t`已开启` : t`已关闭`}</span>
        </span>
      ),
      // 配置尚未拉回时不放行，避免默认值被当成用户真实偏好写回
      disabled: !autoCheck.ready,
    },
  ];

  // ⑤ 逻辑处理函数
  const handleToggleAutoCheck = async () => {
    const saved = await autoCheck.handleChange(!autoCheck.checked);
    if (!saved) {
      message.error(t`无法保存此设置`);
    }
  };

  /** 关闭：下载中先确认（用户可能误以为会中断），其余状态直接关 */
  const handleClose = () => {
    if (!isDownloading) {
      onClose();
      return;
    }
    modal.confirm({
      title: t`关闭更新窗口？`,
      // 只承诺「不取消下载」这一确定事实：是否留在后台还取决于托盘常驻设置
      content: t`下载不会被取消，重新打开本窗口即可查看进度。`,
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
        // 浮层落在信息区拖拽区矩形内：`no-drag` 必须挂 popup 根节点才能点到（AGENTS §4.3）
        rootClassName="no-drag"
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
          className={TOOL_BUTTON_CLASS}
        />
      </Dropdown>

      <Button
        type="text"
        size="small"
        aria-label={t`关闭`}
        icon={<CloseOutlined />}
        onClick={handleClose}
        className={TOOL_BUTTON_CLASS}
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
