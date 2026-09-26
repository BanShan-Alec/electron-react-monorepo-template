import { Button, Card } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';
import { statusBoxClass } from '@/lib/classNames';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _DialogCard = (props: IDialogCardProps) => {
  // 变量声明、解构
  const {
    selectedPath,
    statusMessage,
    isLoading,
    onOpenFile,
    onOpenDirectory,
    onSaveFile,
    onShowInFolder,
  } = props;

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
          icon="📂"
          title="原生对话框与文件定位 (Native Dialogs)"
          subtitle="经由安全 Controller & Preload 调起系统文件管理器与访达"
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="small" loading={isLoading} onClick={onOpenFile}>
            📄 选择文件
          </Button>
          <Button size="small" loading={isLoading} onClick={onOpenDirectory}>
            📁 选择目录
          </Button>
          <Button size="small" loading={isLoading} onClick={onSaveFile}>
            💾 另存为
          </Button>
          <Button disabled={!selectedPath} onClick={onShowInFolder}>
            🔍 在资源管理器中定位
          </Button>
        </div>

        {statusMessage && <div className={statusBoxClass({ breakAll: true })}>{statusMessage}</div>}
      </div>
    </Card>
  );
};

// props 类型定义
interface IDialogCardProps {
  selectedPath: string;
  statusMessage: string;
  isLoading: boolean;
  onOpenFile: () => void;
  onOpenDirectory: () => void;
  onSaveFile: () => void;
  onShowInFolder: () => void;
}

const DialogCard = memo(_DialogCard);

export { DialogCard };
export default DialogCard;
