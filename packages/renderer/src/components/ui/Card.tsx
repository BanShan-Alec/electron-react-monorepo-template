import type React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  headerAction,
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`glass-card rounded-xl p-5 shadow-lg shadow-black/10 flex flex-col transition-all duration-200 hover:border-border/80 ${className}`}
      {...props}
    >
      {(title || subtitle || icon || headerAction) && (
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <div className="text-xl flex-shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && (
                <h3 className="text-base font-semibold text-foreground tracking-tight truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-foreground-secondary mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
};
