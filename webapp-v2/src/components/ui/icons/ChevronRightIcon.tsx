import type { IconProps } from './types';

export function ChevronRightIcon({ size = 20, className = '' }: IconProps) {
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
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
        </svg>
    );
}
