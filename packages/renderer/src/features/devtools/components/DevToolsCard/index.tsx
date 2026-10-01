import { CodeOutlined, GithubOutlined, StopOutlined, ToolOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button, Card } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';
import { statusBoxClass } from '@/lib/classNames';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _DevToolsCard = (props: IDevToolsCardProps) => {
  useLingui();
  // 变量声明、解构
  const { actionMessage, onToggleDevTools, onOpenDocs, onOpenBlockedUrl } = props;

  // 组件状态

  // 网络IO

  // 数据转换

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={
        <CardTitle
          icon={<ToolOutlined />}
          title={t`调试与系统外链 (Security Filter)`}
          subtitle={t`严格协议白名单校验 (仅允许 http/https) 与 DevTools 控制`}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="primary" size="small" icon={<CodeOutlined />} onClick={onToggleDevTools}>
            {t`开关 DevTools`}
          </Button>
          <Button size="small" icon={<GithubOutlined />} onClick={onOpenDocs}>
            {t`打开 GitHub 页面`}
          </Button>
          <Button
            size="small"
            icon={<StopOutlined className="text-danger" />}
            onClick={onOpenBlockedUrl}
          >
            {t`非白名单外链 (example.com)`}
          </Button>
        </div>

        {actionMessage && <div className={statusBoxClass()}>{actionMessage}</div>}
      </div>
    </Card>
  );
};

// props 类型定义
interface IDevToolsCardProps {
  actionMessage: string;
  onToggleDevTools: () => void;
  onOpenDocs: () => void;
  onOpenBlockedUrl: () => void;
}

const DevToolsCard = memo(_DevToolsCard);

export { DevToolsCard };
export default DevToolsCard;
