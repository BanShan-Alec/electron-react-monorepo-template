import { Button, Card } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';
import { statusBoxClass } from '@/lib/classNames';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _DevToolsCard = (props: IDevToolsCardProps) => {
  // 变量声明、解构
  const { actionMessage, onToggleDevTools, onOpenDocs } = props;

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
          icon="🛠️"
          title="调试与系统外链 (Security Filter)"
          subtitle="严格协议白名单校验 (仅允许 http/https) 与 DevTools 控制"
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="small" onClick={onToggleDevTools}>
            🪟 开关 DevTools
          </Button>
          <Button size="small" onClick={onOpenDocs}>
            🌐 打开 GitHub 页面
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
}

const DevToolsCard = memo(_DevToolsCard);

export { DevToolsCard };
export default DevToolsCard;
