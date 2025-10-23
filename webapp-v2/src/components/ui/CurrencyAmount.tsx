import type { Amount } from '@splitifyd/shared';
import { Tooltip } from './Tooltip';
import { formatCurrency, type FormatOptions } from '@/utils/currency';
import type { JSX } from 'preact';

type SpanAttributes = JSX.HTMLAttributes<HTMLSpanElement>;

interface CurrencyAmountProps extends Omit<SpanAttributes, 'children'> {
    amount: Amount | number;
    currency: string;
    displayOptions?: FormatOptions;
    tooltipOptions?: FormatOptions;
    tooltipPlacement?: 'top' | 'bottom';
    as?: 'span' | 'div' | 'p';
}

export function CurrencyAmount({
    amount,
    currency,
    displayOptions,
    tooltipOptions,
    tooltipPlacement,
    className,
    as: Tag = 'span',
    ...rest
}: CurrencyAmountProps) {
    const formatted = formatCurrency(amount, currency, displayOptions);
    const tooltipContent = formatCurrency(amount, currency, {
        ...tooltipOptions,
        includeCurrencyCode: true,
    });

    const content = (
        <Tag className={className} {...rest as any}>
            {formatted}
        </Tag>
    );

    return (
        <Tooltip content={tooltipContent} placement={tooltipPlacement}>
            {content}
        </Tooltip>
    );
}
