import type React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const base = 'inline-flex items-center font-medium rounded-full font-mono select-none';

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
  };

  const variants = {
    primary: 'bg-primary/15 text-primary border border-primary/20',
    success: 'bg-success/15 text-success border border-success/20',
    warning: 'bg-warning/15 text-warning border border-warning/20',
    danger: 'bg-danger/15 text-danger border border-danger/20',
    neutral: 'bg-foreground-secondary/15 text-foreground-secondary border border-border',
  };

  return (
    <span className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
