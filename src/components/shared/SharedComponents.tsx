import { type ReactNode } from 'react';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ icon = '📦', title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="text-5xl mb-4">{icon}</span>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm">{description}</p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h1>
                {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
    );
}
