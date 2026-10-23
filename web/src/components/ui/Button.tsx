import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-[#1B4998] hover:bg-[#153a7a] text-white shadow-xs focus-visible:ring-[#1B4998] active:bg-[#112d5f]',
      secondary:
        'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs focus-visible:ring-slate-400 active:bg-slate-100',
      outline:
        'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-300 focus-visible:ring-slate-400',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus-visible:ring-rose-500 active:bg-rose-800',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-300',
      link:
        'bg-transparent text-[#1B4998] hover:underline underline-offset-4 p-0 h-auto'
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-4 py-2 gap-2 h-9',
      lg: 'text-base px-5 py-2.5 gap-2.5 h-11',
      icon: 'h-9 w-9 p-0'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
