import type { TooltipPlacement } from './Tooltip';
import { Tooltip } from './Tooltip';
import { formatDateTimeInUserTimeZone, formatDistanceToNow } from '@/utils/dateUtils.ts';

interface RelativeTimeProps {
    date: Date | string | number;
    className?: string;
    tooltipPlacement?: TooltipPlacement;
    fallback?: string;
}

export function RelativeTime({ date, className, tooltipPlacement = 'top', fallback = '-' }: RelativeTimeProps) {
    const dateValue = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(dateValue.getTime())) {
        return <span className={className}>{fallback}</span>;
    }

    const relativeLabel = formatDistanceToNow(dateValue);
    const absoluteLabel = formatDateTimeInUserTimeZone(dateValue);

    return (
        <Tooltip content={absoluteLabel} placement={tooltipPlacement}>
            <span className={className}>{relativeLabel}</span>
        </Tooltip>
    );
}
