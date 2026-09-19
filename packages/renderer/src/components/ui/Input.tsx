import type React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...props }) => {
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-foreground-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full bg-background-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-danger focus-visible:ring-danger' : 'hover:border-border/80'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger font-medium">{error}</span>}
    </div>
  );
};
