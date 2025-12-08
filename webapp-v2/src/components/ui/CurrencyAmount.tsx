import { formatCurrency, formatCurrencyParts, type FormatOptions } from '@/utils/currency';
import { type Amount, toAmount, toCurrencyISOCode } from '@billsplit-wl/shared';
import type { JSX } from 'preact';
import { CurrencyIcon } from './icons';
import { Tooltip } from './Tooltip';

type SpanAttributes = JSX.HTMLAttributes<HTMLSpanElement>;

interface CurrencyAmountProps extends Omit<SpanAttributes, 'children'> {
    amount: Amount | number;
    currency: string;
    displayOptions?: FormatOptions;
    tooltipOptions?: FormatOptions;
    tooltipPlacement?: 'top' | 'bottom';
    as?: 'span' | 'div' | 'p';
    iconSize?: number;
}

export function CurrencyAmount({
    amount,
    currency,
    displayOptions,
    tooltipOptions,
    tooltipPlacement,
    className,
    as: Tag = 'span',
    iconSize = 16,
    ...rest
}: CurrencyAmountProps) {
    const parts = formatCurrencyParts(toAmount(amount), toCurrencyISOCode(currency), displayOptions);
    const tooltipContent = formatCurrency(toAmount(amount), toCurrencyISOCode(currency), {
        ...tooltipOptions,
        includeCurrencyCode: true,
    });

    // If symbol is same as currency code (e.g. CHF), show empty space instead of icon for alignment
    const symbolMatchesCode = parts.symbol.toUpperCase() === parts.currencyCode.toUpperCase();
    const showCurrencyCode = displayOptions?.includeCurrencyCode !== false;

    const content = (
        <Tag className={`inline-flex items-center ${className ?? ''}`} {...rest as any}>
            {parts.sign}
            {symbolMatchesCode
                ? <span style={{ width: iconSize, height: iconSize }} className='shrink-0' />
                : <CurrencyIcon symbol={parts.symbol} size={iconSize} className='shrink-0' />}
            {parts.formattedNumber}
            {showCurrencyCode && ` ${parts.currencyCode}`}
        </Tag>
    );

    return (
        <Tooltip content={tooltipContent} placement={tooltipPlacement}>
            {content}
        </Tooltip>
    );
}
