import { ComponentChildren } from 'preact';
import type { JSX } from 'preact';
import { cx } from '@/utils/cx.ts';
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
}

export function Card({ title, subtitle, children, onClick, className = '', padding = 'md', variant = 'base', 'data-testid': dataTestId }: CardProps) {
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
