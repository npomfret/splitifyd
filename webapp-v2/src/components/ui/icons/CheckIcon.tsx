import type { IconProps } from './types';

export function CheckIcon({ size = 20, className = '' }: IconProps) {
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
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
        </svg>
    );
}
