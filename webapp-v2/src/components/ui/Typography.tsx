import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, JSX } from 'preact';

type TypographyVariant = 'body' | 'bodyStrong' | 'caption' | 'button' | 'eyebrow' | 'heading' | 'display';

type TypographyElement = keyof JSX.IntrinsicElements;

interface TypographyProps {
    as?: TypographyElement;
    variant?: TypographyVariant;
    children: ComponentChildren;
    className?: string;
    id?: string;
    role?: JSX.AriaRole;
    title?: string;
    'data-testid'?: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
}

const defaultElement: Record<TypographyVariant, TypographyElement> = {
    body: 'p',
    bodyStrong: 'p',
    caption: 'p',
    button: 'span',
    eyebrow: 'span',
    heading: 'h3',
    display: 'h2',
};

const variantClasses: Record<TypographyVariant, string> = {
    body: 'text-base text-text-primary',
    bodyStrong: 'text-base font-semibold text-text-primary',
    caption: 'text-sm text-text-muted',
    button: 'text-sm uppercase tracking-wide text-text-primary',
    eyebrow: 'text-xs font-semibold uppercase tracking-[0.12em] text-text-muted',
    heading: 'text-xl font-semibold text-text-primary',
    display: 'text-3xl font-bold text-text-primary',
};

export function Typography({ as, variant = 'body', children, className = '', id, role, title, 'data-testid': dataTestId, ariaLabel, ariaDescribedBy }: TypographyProps) {
    const Component = (as || defaultElement[variant]) as TypographyElement;

    return (
        <Component
            id={id}
            role={role}
            title={title}
            data-testid={dataTestId}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            className={cx(variantClasses[variant], className)}
        >
            {children}
        </Component>
    );
}
