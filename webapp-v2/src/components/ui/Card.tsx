import { useMagneticHover } from '@/app/hooks/useMagneticHover';
import { cx } from '@/utils/cx.ts';
import { ComponentChildren } from 'preact';
import type { JSX } from 'preact';
import { Surface } from './Surface';
import { Typography } from './Typography';

interface CardProps {
    title?: string;
    subtitle?: string;
    children: ComponentChildren;
    onClick?: () => void;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    variant?: 'base' | 'muted' | 'inverted' | 'glass';
    'data-testid'?: string;
    /**
     * Enable magnetic hover effect (follows cursor).
     * Only works on Aurora theme (disabled on Brutalist).
     * Default: false
     */
    magnetic?: boolean;
}

export function Card({ title, subtitle, children, onClick, className = '', padding = 'md', variant = 'base', 'data-testid': dataTestId, magnetic = false }: CardProps) {
    // Apply magnetic hover effect if enabled (automatically disabled on Brutalist theme)
    const magneticRef = useMagneticHover<HTMLDivElement>({
        strength: 0.25, // Slightly subtler than buttons
    });

    // Only use magnetic ref if enabled
    const cardRef = magnetic ? magneticRef : undefined;

    const headingBlock = (title || subtitle) && (
        <div className='mb-4 space-y-1'>
            {title && (
                <Typography as='h3' variant='heading'>
                    {title}
                </Typography>
            )}
            {subtitle && (
                <Typography variant='caption' className='text-text-muted'>
                    {subtitle}
                </Typography>
            )}
        </div>
    );

    const handleKeyDown: JSX.KeyboardEventHandler<HTMLDivElement> = (event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <Surface
            ref={cardRef}
            variant={variant}
            padding={padding}
            shadow='sm'
            border='default'
            interactive={!!onClick}
            className={cx('space-y-4', className)}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={handleKeyDown}
            data-testid={dataTestId}
        >
            {headingBlock}
            {children}
        </Surface>
    );
}
