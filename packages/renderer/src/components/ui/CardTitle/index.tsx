import { Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { memo, useEffect, useRef, useState } from 'react';

// 可抽离的逻辑处理函数/组件

const TITLE_CLASS =
  'text-base font-semibold text-foreground tracking-tight truncate leading-tight min-w-0';
const SUBTITLE_CLASS = 'text-xs text-foreground-secondary mt-0.5 font-normal truncate min-w-0';

/**
 * 单行省略 + 仅在实际被截断时悬停出 Tooltip。
 * 是否截断取决于容器宽度（窗口缩放、中英切换都会改变），用 ResizeObserver 实时判断，
 * 避免未截断的短标题也弹提示。
 */
function EllipsisText(props: { children: ReactNode; tooltip?: string; className: string }) {
  const { children, tooltip, className } = props;
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => setTruncated(element.scrollWidth > element.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  return (
    <Tooltip title={truncated && tooltip ? tooltip : undefined}>
      <span ref={ref} className={className}>
        {children}
      </span>
    </Tooltip>
  );
}

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
        <EllipsisText
          className={TITLE_CLASS}
          tooltip={typeof title === 'string' ? title : undefined}
        >
          {title}
        </EllipsisText>
        {subtitle && (
          <EllipsisText
            className={SUBTITLE_CLASS}
            tooltip={typeof subtitle === 'string' ? subtitle : undefined}
          >
            {subtitle}
          </EllipsisText>
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
