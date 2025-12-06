import type { IconProps } from './types';

interface CurrencyIconProps extends IconProps {
    symbol: string;
}

export function CurrencyIcon({ symbol, size = 24, className = '' }: CurrencyIconProps) {
    // Determine font size based on symbol length
    let fontSize = 14;
    if (symbol.length === 1) fontSize = 16;
    else if (symbol.length === 2) fontSize = 14;
    else if (symbol.length === 3) fontSize = 12;
    else if (symbol.length >= 4) fontSize = 10;

    // Adjust for specific symbols that need more space (RTL and wide symbols)
    const wideSymbols = ['Bs.S', 'MOP$', 'ج.س.', 'ل.ل.', '.د.ب', 'د.إ', 'د.ج', 'د.ع'];
    if (wideSymbols.includes(symbol)) fontSize = 8;

    // Scale font size proportionally to icon size
    const scaledFontSize = (fontSize * size) / 24;

    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox='0 0 24 24'
            fill='none'
            aria-hidden='true'
            focusable='false'
        >
            <text
                x='12'
                y='16'
                fontFamily='system-ui, -apple-system, sans-serif'
                fontSize={scaledFontSize}
                fontWeight='500'
                fill='currentColor'
                textAnchor='middle'
            >
                {symbol}
            </text>
        </svg>
    );
}
