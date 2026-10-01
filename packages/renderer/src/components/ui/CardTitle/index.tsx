import type { ReactNode } from 'react';
import { memo } from 'react';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _CardTitle = (props: ICardTitleProps) => {
  // 变量声明、解构
  const { icon, title, subtitle } = props;

  // 组件状态

  // 网络IO

  // 数据转换

  // 逻辑处理函数

  // 组件Effect

  // 组件渲染
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && (
        <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 text-base">
          {icon}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-base font-semibold text-foreground tracking-tight truncate leading-tight">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-foreground-secondary mt-0.5 font-normal truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

// props 类型定义
interface ICardTitleProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}

const CardTitle = memo(_CardTitle);

export { CardTitle };
export default CardTitle;
