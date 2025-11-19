import { cx } from '@/utils/cx.ts';
import type { ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';

interface ModalProps {
    open: boolean;
    onClose?: () => void;
    size?: 'sm' | 'md' | 'lg';
    labelledBy?: string;
    describedBy?: string;
    className?: string;
    children: ComponentChildren;
    'data-testid'?: string;
}

const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
};

export function Modal({ open, onClose, size = 'sm', labelledBy, describedBy, className = '', children, 'data-testid': dataTestId }: ModalProps) {
    if (typeof document === 'undefined' || !open) {
        return null;
    }

    const handleBackdropClick: JSX.MouseEventHandler<HTMLDivElement> = (event) => {
        if (event.target === event.currentTarget) {
            onClose?.();
        }
    };

    const content = (
        <div className='fixed inset-0 z-50 flex items-center justify-center px-4 py-8' style={{ backgroundColor: 'var(--modal-backdrop, rgba(0, 0, 0, 0.4))', backdropFilter: 'blur(4px)' }} onClick={handleBackdropClick} data-testid={dataTestId}>
            <div
                role='dialog'
                aria-modal='true'
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                className={cx(
                    'w-full rounded-2xl border border-border-default bg-surface-base text-text-primary shadow-2xl opacity-100',
                    sizeClasses[size],
                    className,
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
