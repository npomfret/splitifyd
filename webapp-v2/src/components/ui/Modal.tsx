import { cx } from '@/utils/cx.ts';
import { signal } from '@preact/signals';
import { AnimatePresence, motion } from 'framer-motion';
import type { ComponentChildren, JSX, RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(modalRef: RefObject<HTMLElement>, isOpen: boolean): void {
    useEffect(() => {
        if (!isOpen || !modalRef.current) return;

        const getFocusableElements = () => {
            return modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [];
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement?.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement?.focus();
            }
        };

        // Set initial focus to first focusable element
        // Use setTimeout with a delay to ensure any pending mouse/keyboard events
        // from the previous modal have fully completed before focusing
        // This prevents accidental clicks on the focused element when modals transition
        const focusTimeoutId = setTimeout(() => {
            // Don't steal focus if user is already interacting with an input/textarea
            // This prevents the focus trap from interrupting form filling, which can cause
            // accidental button clicks if a space is typed right after focus moves
            const activeTag = document.activeElement?.tagName?.toUpperCase();
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
                return;
            }

            const focusableElements = getFocusableElements();
            if (focusableElements.length > 0) {
                (focusableElements[0] as HTMLElement).focus();
            }
        }, 100);

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(focusTimeoutId);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, modalRef]);
}

function useFocusRestoration(isOpen: boolean): void {
    const triggerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement as HTMLElement;
        } else if (triggerRef.current) {
            // Check element is still in DOM before focusing
            if (document.body.contains(triggerRef.current)) {
                triggerRef.current.focus();
            }
            triggerRef.current = null;
        }
    }, [isOpen]);
}

interface ModalProps {
    open: boolean;
    onClose?: () => void;
    size?: 'sm' | 'md' | 'lg';
    labelledBy?: string;
    ariaLabel?: string;
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

export function Modal({ open, onClose, size = 'sm', labelledBy, ariaLabel, describedBy, className = '', children, 'data-testid': dataTestId }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Component-local signal - initialized within useState to avoid stale state across instances
    const [prefersReducedMotionSignal] = useState(() => signal(false));

    // Focus management hooks
    useFocusRestoration(open);
    useFocusTrap(modalRef, open);

    useEffect(() => {
        // Check for reduced motion preference
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        prefersReducedMotionSignal.value = mediaQuery.matches;

        const handleChange = (e: MediaQueryListEvent) => {
            prefersReducedMotionSignal.value = e.matches;
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Handle escape key to close modal
    useEffect(() => {
        if (!open || !onClose) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open, onClose]);

    if (typeof document === 'undefined') {
        return null;
    }

    // Use onMouseDown instead of onClick to prevent closing when drag-selecting text
    // that ends outside the modal content but still within the backdrop
    const handleBackdropMouseDown: JSX.MouseEventHandler<HTMLDivElement> = (event) => {
        if (event.target === event.currentTarget && onClose) {
            onClose();
        }
    };

    // Backdrop animation variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    // Modal animation variants with spring physics
    const modalVariants = prefersReducedMotionSignal.value
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
                    role='presentation'
                    onMouseDown={handleBackdropMouseDown}
                    data-testid={dataTestId}
                    variants={backdropVariants}
                    initial='hidden'
                    animate='visible'
                    exit='hidden'
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        ref={modalRef}
                        role='dialog'
                        aria-modal='true'
                        aria-label={ariaLabel}
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
