import type { JSX } from 'preact';
import { cloneElement, isValidElement } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';

export type TooltipPlacement = 'top' | 'bottom';

interface TooltipProps {
    content: string;
    children: JSX.Element;
    placement?: TooltipPlacement;
    className?: string;
}

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

export function Tooltip({ content, children, placement = 'top', className }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const idRef = useRef<string>();

    if (!idRef.current) {
        idRef.current = `tooltip-${Math.random().toString(36).slice(2, 9)}`;
    }

    const tooltipId = idRef.current;

    const show = () => setIsVisible(true);
    const hide = () => setIsVisible(false);

    const tooltipChild = isValidElement(children)
        ? cloneElement(children, {
            'aria-describedby': tooltipId,
            onFocus: composeEventHandlers(children.props.onFocus, show),
            onBlur: composeEventHandlers(children.props.onBlur, hide),
        })
        : children;

    const positionClasses = placement === 'bottom'
        ? 'top-full mt-2'
        : 'bottom-full mb-2';

    const wrapperClasses = ['relative inline-flex', className].filter(Boolean).join(' ');

    return (
        <span
            className={wrapperClasses}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {tooltipChild}
            <span
                id={tooltipId}
                role='tooltip'
                className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-xs font-medium text-white shadow-lg transition-opacity duration-150 ${positionClasses} ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden={!isVisible}
            >
                {content}
            </span>
        </span>
    );
}
