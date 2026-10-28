import type { CardProps } from 'antd';
import { Card } from 'antd';
import { clsx } from 'clsx';
import { memo } from 'react';

// 私有常量

// 可抽离的逻辑处理函数/组件

const _AppCard = (props: IAppCardProps) => {
  // 变量声明、解构
  const { className, ...rest } = props;

  // 组件渲染
  return (
    <Card
      {...rest}
      className={clsx('app-card flex flex-col hover:border-primary/40', className)}
      classNames={{ body: 'flex flex-1 flex-col' }}
    />
  );
};

// props 类型定义
type IAppCardProps = Omit<CardProps, 'classNames' | 'styles'>;

const AppCard = memo(_AppCard);

export { AppCard };
export default AppCard;
