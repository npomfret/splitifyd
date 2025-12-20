import type { JSX } from 'preact';
import { cloneElement, createPortal, isValidElement } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export type TooltipPlacement = 'top' | 'bottom';

interface TooltipProps {
    content: string;
    children: JSX.Element;
    placement?: TooltipPlacement;
    className?: string;
    /** Show tooltip when trigger receives focus. Defaults to true for accessibility.
     * Set to false for elements where focus-triggered tooltip is distracting (e.g., modal close buttons
     * that receive auto-focus) - ensure the element has aria-label for accessibility. */
    showOnFocus?: boolean;
}

interface TooltipPosition {
    top: number;
    left: number;
    actualPlacement: TooltipPlacement;
}

const TOOLTIP_OFFSET = 8; // Gap between trigger and tooltip

// Utility to compose existing event handlers without dropping them
function composeEventHandlers<T extends Event>(
    originalHandler: ((event: T) => void) | undefined,
    newHandler: (event: T) => void,
): (event: T) => void {
    return (event: T) => {
        if (originalHandler) {
            originalHandler(event);
        }
        newHandler(event);
    };
}

export function Tooltip({ content, children, placement = 'top', className, showOnFocus = true }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<TooltipPosition | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLSpanElement>(null);
    const idRef = useRef<string>();

    if (!idRef.current) {
        idRef.current = `tooltip-${Math.random().toString(36).slice(2, 9)}`;
    }

    const tooltipId = idRef.current;

    const calculatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Calculate horizontal center
        let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

        // Clamp to viewport bounds with padding
        const horizontalPadding = 8;
        left = Math.max(horizontalPadding, Math.min(left, viewportWidth - tooltipRect.width - horizontalPadding));

        // Determine vertical placement with auto-flip
        let actualPlacement = placement;
        let top: number;

        if (placement === 'top') {
            top = triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET;
            // Flip to bottom if not enough room above
            if (top < 0) {
                actualPlacement = 'bottom';
                top = triggerRect.bottom + TOOLTIP_OFFSET;
            }
        } else {
            top = triggerRect.bottom + TOOLTIP_OFFSET;
            // Flip to top if not enough room below
            if (top + tooltipRect.height > viewportHeight) {
                actualPlacement = 'top';
                top = triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET;
            }
        }

        setPosition({ top, left, actualPlacement });
    }, [placement]);

    // Recalculate position when visible or on scroll/resize
    useLayoutEffect(() => {
        if (!isVisible) return;

        calculatePosition();

        window.addEventListener('scroll', calculatePosition, true);
        window.addEventListener('resize', calculatePosition);

        return () => {
            window.removeEventListener('scroll', calculatePosition, true);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [isVisible, calculatePosition]);

    // Reset position when hidden
    useEffect(() => {
        if (!isVisible) {
            setPosition(null);
        }
    }, [isVisible]);

    const show = () => setIsVisible(true);
    const hide = () => setIsVisible(false);

    const tooltipChild = isValidElement(children)
        ? cloneElement(children, {
            'aria-describedby': tooltipId,
            ...(showOnFocus && {
                onFocus: composeEventHandlers(children.props.onFocus, show),
                onBlur: composeEventHandlers(children.props.onBlur, hide),
            }),
        })
        : children;

    const wrapperClasses = ['inline-flex', className].filter(Boolean).join(' ');

    // SSR safety check
    if (typeof document === 'undefined') {
        return (
            <span className={wrapperClasses}>
                {tooltipChild}
            </span>
        );
    }

    const tooltipElement = (
        <span
            ref={tooltipRef}
            id={tooltipId}
            role='tooltip'
            className={`pointer-events-none fixed z-[100] max-w-xs rounded-md border border-border-strong bg-surface-popover px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-md transition-opacity duration-150 backdrop-blur-xs ${
                isVisible && position ? 'opacity-100' : 'opacity-0'
            }`}
            style={position ? { top: `${position.top}px`, left: `${position.left}px` } : { top: '-9999px', left: '-9999px' }}
            aria-hidden={!isVisible}
        >
            {content}
        </span>
    );

    return (
        <>
            <span
                ref={triggerRef}
                className={wrapperClasses}
                onMouseEnter={show}
                onMouseLeave={hide}
                {...(showOnFocus && { onFocus: show, onBlur: hide })}
            >
                {tooltipChild}
            </span>
            {createPortal(tooltipElement, document.body)}
        </>
    );
}
