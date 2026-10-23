import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'
  | 'secondary';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-blue-50 text-[#1B4998] border-blue-200',
    outline: 'bg-transparent text-slate-700 border-slate-300',
    secondary: 'bg-slate-200 text-slate-900 border-slate-300'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case 'available':
    case 'active':
    case 'matched':
    case 'online':
    case 'enrolled':
    case 'good':
      return (
        <Badge variant="success">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="capitalize">{status.replace('_', ' ')}</span>
        </Badge>
      );
    case 'issued':
    case 'returned':
    case 'waiting_device':
    case 'fair':
      return (
        <Badge variant="info">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="capitalize">{status.replace('_', ' ')}</span>
        </Badge>
      );
    case 'overdue':
    case 'pending':
    case 'needs_repair':
      return (
        <Badge variant="warning">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="capitalize">{status.replace('_', ' ')}</span>
        </Badge>
      );
    case 'damaged':
    case 'inactive':
    case 'not_found':
    case 'error':
    case 'offline':
    case 'failed':
      return (
        <Badge variant="danger">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="capitalize">{status.replace('_', ' ')}</span>
        </Badge>
      );
    case 'maintenance':
      return (
        <Badge variant="warning">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <span className="capitalize">Maintenance</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <span className="capitalize">{status}</span>
        </Badge>
      );
  }
}
