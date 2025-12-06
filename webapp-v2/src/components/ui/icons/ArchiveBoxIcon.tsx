import type { IconProps } from './types';

export function ArchiveBoxIcon({ size = 20, className = '' }: IconProps) {
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
                d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
            />
        </svg>
    );
}
