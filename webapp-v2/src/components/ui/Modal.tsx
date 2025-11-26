import { cx } from '@/utils/cx.ts';
import { AnimatePresence, motion } from 'framer-motion';
import type { ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';

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
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        // Check for reduced motion preference
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    if (typeof document === 'undefined') {
        return null;
    }

    const handleBackdropClick: JSX.MouseEventHandler<HTMLDivElement> = (event) => {
        if (event.target === event.currentTarget) {
            onClose?.();
        }
    };

    // Backdrop animation variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    // Modal animation variants with spring physics
    const modalVariants = prefersReducedMotion
        ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
        }
        : {
            hidden: { opacity: 0, scale: 0.95, y: 20 },
            visible: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: {
                    type: 'spring',
                    damping: 25,
                    stiffness: 300,
                },
            },
        };

    const content = (
        <AnimatePresence mode='wait'>
            {open && (
                <motion.div
                    className='fixed inset-0 z-50 flex items-center justify-center px-4 py-8'
                    style={{
                        backgroundColor: 'var(--semantics-colors-surface-overlay, rgba(0, 0, 0, 0.4))',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={handleBackdropClick}
                    data-testid={dataTestId}
                    variants={backdropVariants}
                    initial='hidden'
                    animate='visible'
                    exit='hidden'
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby={labelledBy}
                        aria-describedby={describedBy}
                        className={cx(
                            'w-full rounded-2xl border border-border-default bg-surface-base text-text-primary shadow-2xl',
                            sizeClasses[size],
                            className,
                        )}
                        onClick={(event: any) => event.stopPropagation()}
                        variants={modalVariants}
                        initial='hidden'
                        animate='visible'
                        exit='hidden'
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
}
