import type { IconProps } from './types';

export function ArrowRightIcon({ size = 20, className = '' }: IconProps) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            aria-hidden='true'
            focusable='false'
        >
            <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 7l5 5m0 0l-5 5m5-5H6'
            />
        </svg>
    );
}
