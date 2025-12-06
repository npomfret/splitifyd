import type { IconProps } from './types';

export function PlusIcon({ size = 20, className = '' }: IconProps) {
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
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
        </svg>
    );
}
