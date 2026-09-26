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
    <div className="flex flex-col min-w-0">
      <span className="text-base font-semibold text-foreground tracking-tight truncate">
        {icon ? `${icon} ` : ''}
        {title}
      </span>
      {subtitle && (
        <span className="text-xs text-foreground-secondary mt-0.5 font-normal truncate">
          {subtitle}
        </span>
      )}
    </div>
  );
};

// props 类型定义
interface ICardTitleProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

const CardTitle = memo(_CardTitle);

export { CardTitle };
export default CardTitle;
