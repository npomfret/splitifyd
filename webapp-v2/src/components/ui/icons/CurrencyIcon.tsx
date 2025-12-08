import type { IconProps } from './types';

interface CurrencyIconProps extends IconProps {
    symbol: string;
}

export function CurrencyIcon({ symbol, size = 24, className = '' }: CurrencyIconProps) {
    // Scale font size based on symbol length
    // Base sizes optimized for 24px icon - made larger for better readability
    let baseFontSize: number;
    if (symbol.length === 1) {
        baseFontSize = 24;
    } else if (symbol.length === 2) {
        baseFontSize = 20;
    } else if (symbol.length === 3) {
        baseFontSize = 16;
    } else {
        baseFontSize = 12;
    }

    // Wide/complex symbols need smaller font
    const wideSymbols = ['Bs.S', 'MOP$', 'ج.س.', 'ل.ل.', '.د.ب', 'د.إ', 'د.ج', 'د.ع'];
    if (wideSymbols.includes(symbol)) {
        baseFontSize = 10;
    }

    // Scale proportionally to icon size
    const fontSize = (baseFontSize * size) / 24;

    return (
        <span
            className={`inline-flex items-center justify-center shrink-0 ${className}`}
            style={{
                width: size,
                height: size,
                fontSize: `${fontSize}px`,
                fontWeight: 600,
                lineHeight: 1,
            }}
            aria-hidden='true'
        >
            {symbol}
        </span>
    );
}
