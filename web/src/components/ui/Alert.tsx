import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  ...props
}: AlertProps) {
  const icons = {
    info: <Info className="w-5 h-5 text-[#1B4998] shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    danger: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
  };

  const variants = {
    info: 'bg-blue-50/80 border-blue-200 text-blue-900',
    success: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50/80 border-amber-200 text-amber-900',
    danger: 'bg-rose-50/80 border-rose-200 text-rose-900'
  };

  return (
    <div
      role="alert"
      className={cn('p-4 rounded-lg border flex gap-3 text-sm', variants[variant], className)}
      {...props}
    >
      {icons[variant]}
      <div className="space-y-0.5">
        {title && <h5 className="font-semibold text-sm leading-tight">{title}</h5>}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
