import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface ApprovalBadgeProps {
  status?: 'pending_approval' | 'pending_delete' | 'approved' | string;
  className?: string;
}

export function ApprovalBadge({ status, className = '' }: ApprovalBadgeProps) {
  if (!status || status === 'approved') return null;

  if (status === 'pending_approval') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${className}`}>
        <Clock size={12} className="animate-spin" />
        Chờ duyệt tạo
      </span>
    );
  }

  if (status === 'pending_delete') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 ${className}`}>
        <AlertTriangle size={12} />
        Chờ duyệt xoá
      </span>
    );
  }

  return null;
}
