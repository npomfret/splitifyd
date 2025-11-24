import { logUserAction } from '@/utils/browser-logger.ts';
import { ComponentChildren } from 'preact';
import { forwardRef } from 'preact/compat';

interface ClickableProps {
    /**
     * Click handler to execute after logging
     */
    onClick?: (event: MouseEvent) => void;

    /**
     * Optional event name for analytics (defaults to 'element_click')
     */
    eventName?: string;

    /**
     * Additional properties to include in the analytics payload
     */
    eventProps?: Record<string, unknown>;

    /**
     * Whether the clickable element is disabled
     */
    disabled?: boolean;

    /**
     * Children elements to render
     */
    children: ComponentChildren;

    /**
     * HTML element type to render (defaults to 'span')
     */
    as?: 'span' | 'div' | 'button' | 'a' | 'img';

    /**
     * CSS class name
     */
    className?: string;

    /**
     * Element ID
     */
    id?: string;

    /**
     * Accessibility label for the element
     */
    'aria-label'?: string;

    /**
     * Test ID for testing
     */
    'data-testid'?: string;

    /**
     * Title attribute
     */
    title?: string;

    /**
     * Tab index
     */
    tabIndex?: number;

    /**
     * aria-describedby attribute
     */
    'aria-describedby'?: string;

    /**
     * Any additional HTML attributes
     */
    [key: string]: any;
}

/**
 * Clickable component for wrapping interactive non-button elements.
 * Handles analytics logging consistently with the Button component.
 *
 * @example
 * <Clickable
 *   onClick={handleClick}
 *   eventName="card_click"
 *   eventProps={{ cardId: '123' }}
 *   aria-label="View details"
 * >
 *   <div>Click me</div>
 * </Clickable>
 */
export const Clickable = forwardRef<HTMLElement, ClickableProps>(
    (
        {
            onClick,
            eventName = 'element_click',
            eventProps = {},
            disabled = false,
            children,
            as: Element = 'span',
            className,
            id,
            'aria-label': ariaLabel,
            'data-testid': dataTestId,
            ...rest
        },
        ref,
    ) => {
        const getElementText = (): string => {
            if (ariaLabel) {
                return ariaLabel;
            }
            if (id) {
                return `Element#${id}`;
            }
            return 'Clickable';
        };

        const handleClick = (event: MouseEvent) => {
            if (disabled) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            // Log the interaction before executing the handler
            logUserAction(eventName, {
                buttonText: getElementText(),
                page: window.location.pathname,
                id,
                className,
                ...eventProps,
            });

            // Execute the user's onClick handler
            if (onClick) {
                onClick(event);
            }
        };

        // Filter out custom props before spreading to DOM
        const { eventName: _, eventProps: __, ...domProps } = rest;

        return (
            <Element
                ref={ref as any}
                id={id}
                className={className}
                onClick={handleClick as any}
                aria-label={ariaLabel}
                aria-disabled={disabled}
                data-testid={dataTestId}
                {...domProps}
            >
                {children}
            </Element>
        );
    },
);

Clickable.displayName = 'Clickable';
