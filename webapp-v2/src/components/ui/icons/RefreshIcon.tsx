import type { IconProps } from './types';

export function RefreshIcon({ size = 20, className = '' }: IconProps) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16.023 9.348h4.284m0 0V5.064m0 4.284-2.913-2.913a7.5 7.5 0 10-.255 10.79"
            />
        </svg>
    );
}
