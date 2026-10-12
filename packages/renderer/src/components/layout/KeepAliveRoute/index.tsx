import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { useLocation } from 'wouter';

/**
 * 路由保活容器组件：通过 CSS hidden 控制显隐，
 * 保证非激活页面保持挂载，避免组件卸载导致状态丢失及重复发起 IPC 请求。
 * 支持单路径或路径数组（别名匹配）。
 */
const _KeepAliveRoute: FC<IKeepAliveRouteProps> = ({ path, children, className }) => {
  const [location] = useLocation();
  const isMatch = Array.isArray(path) ? path.includes(location) : location === path;

  return (
    <div className={`${isMatch ? '' : 'hidden'}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
};

// props 类型定义
interface IKeepAliveRouteProps {
  path: string | readonly string[];
  children: ReactNode;
  className?: string;
}

const KeepAliveRoute = memo(_KeepAliveRoute);

export { KeepAliveRoute };
export default KeepAliveRoute;
