import { Clickable } from '@/components/ui/Clickable';
import * as browserLogger from '@/utils/browser-logger';
import { fireEvent, render } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/browser-logger', () => ({
    logUserAction: vi.fn(),
}));

describe('Clickable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('should render children correctly', () => {
            const { getByText } = render(
                <Clickable onClick={() => {}}>
                    <div>Click me</div>
                </Clickable>,
            );

            expect(getByText('Click me')).toBeInTheDocument();
        });

        it('should render as span by default', () => {
            const { container } = render(
                <Clickable onClick={() => {}}>Content</Clickable>,
            );

            expect(container.querySelector('span')).toBeInTheDocument();
        });

        it('should render as specified element when using "as" prop', () => {
            const { container } = render(
                <Clickable onClick={() => {}} as='div'>
                    Content
                </Clickable>,
            );

            expect(container.querySelector('div')).toBeInTheDocument();
            expect(container.querySelector('span')).not.toBeInTheDocument();
        });

        it('should apply className prop', () => {
            const { container } = render(
                <Clickable onClick={() => {}} className='test-class'>
                    Content
                </Clickable>,
            );

            expect(container.querySelector('.test-class')).toBeInTheDocument();
        });

        it('should apply id prop', () => {
            const { container } = render(
                <Clickable onClick={() => {}} id='test-id'>
                    Content
                </Clickable>,
            );

            expect(container.querySelector('#test-id')).toBeInTheDocument();
        });

        it('should apply dataTestId prop', () => {
            const { getByTestId } = render(
                <Clickable onClick={() => {}} dataTestId='clickable-element'>
                    Content
                </Clickable>,
            );

            expect(getByTestId('clickable-element')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should apply aria-label', () => {
            const { container } = render(
                <Clickable onClick={() => {}} aria-label='Click to open'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span');
            expect(element).toHaveAttribute('aria-label', 'Click to open');
        });

        it('should set aria-disabled when disabled', () => {
            const { container } = render(
                <Clickable onClick={() => {}} disabled>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span');
            expect(element).toHaveAttribute('aria-disabled', 'true');
        });

        it('should not set aria-disabled when not disabled', () => {
            const { container } = render(
                <Clickable onClick={() => {}}>Content</Clickable>,
            );

            const element = container.querySelector('span');
            expect(element).toHaveAttribute('aria-disabled', 'false');
        });
    });

    describe('Click Handling', () => {
        it('should call onClick handler when clicked', () => {
            const handleClick = vi.fn();
            const { container } = render(
                <Clickable onClick={handleClick}>Content</Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('should not call onClick when disabled', () => {
            const handleClick = vi.fn();
            const { container } = render(
                <Clickable onClick={handleClick} disabled>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(handleClick).not.toHaveBeenCalled();
        });

        it('should pass event to onClick handler', () => {
            const handleClick = vi.fn();
            const { container } = render(
                <Clickable onClick={handleClick}>Content</Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
            expect(handleClick.mock.calls[0][0]).toHaveProperty('type', 'click');
        });

        it('should stop propagation when disabled', () => {
            const handleClick = vi.fn();
            const parentClick = vi.fn();
            const { container } = render(
                <div onClick={parentClick}>
                    <Clickable onClick={handleClick} disabled>
                        Content
                    </Clickable>
                </div>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(handleClick).not.toHaveBeenCalled();
            expect(parentClick).not.toHaveBeenCalled();
        });
    });

    describe('Analytics Logging', () => {
        it('should log user action when clicked', () => {
            const handleClick = vi.fn();
            const { container } = render(
                <Clickable onClick={handleClick} aria-label='Test action'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledTimes(1);
        });

        it('should log with default event name', () => {
            const { container } = render(
                <Clickable onClick={() => {}} aria-label='Test'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.any(Object),
            );
        });

        it('should log with custom event name', () => {
            const { container } = render(
                <Clickable onClick={() => {}} eventName='custom_action'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'custom_action',
                expect.any(Object),
            );
        });

        it('should include buttonText from aria-label in payload', () => {
            const { container } = render(
                <Clickable onClick={() => {}} aria-label='Close dialog'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    buttonText: 'Close dialog',
                }),
            );
        });

        it('should include buttonText from id when aria-label is not provided', () => {
            const { container } = render(
                <Clickable onClick={() => {}} id='close-btn'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    buttonText: 'Element#close-btn',
                }),
            );
        });

        it('should use fallback buttonText when neither aria-label nor id provided', () => {
            const { container } = render(<Clickable onClick={() => {}}>Content</Clickable>);

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    buttonText: 'Clickable',
                }),
            );
        });

        it('should include page in payload', () => {
            const { container } = render(<Clickable onClick={() => {}}>Content</Clickable>);

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    page: expect.any(String),
                }),
            );
        });

        it('should include id in payload when provided', () => {
            const { container } = render(
                <Clickable onClick={() => {}} id='test-element'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    id: 'test-element',
                }),
            );
        });

        it('should include className in payload when provided', () => {
            const { container } = render(
                <Clickable onClick={() => {}} className='test-class'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    className: 'test-class',
                }),
            );
        });

        it('should include custom eventProps in payload', () => {
            const { container } = render(
                <Clickable
                    onClick={() => {}}
                    eventProps={{ cardId: '123', action: 'expand' }}
                >
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).toHaveBeenCalledWith(
                'element_click',
                expect.objectContaining({
                    cardId: '123',
                    action: 'expand',
                }),
            );
        });

        it('should not log when disabled', () => {
            const { container } = render(
                <Clickable onClick={() => {}} disabled>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(browserLogger.logUserAction).not.toHaveBeenCalled();
        });

        it('should log before calling onClick handler', () => {
            const callOrder: string[] = [];
            const handleClick = vi.fn(() => callOrder.push('onClick'));
            vi.mocked(browserLogger.logUserAction).mockImplementation(() => callOrder.push('log'));

            const { container } = render(
                <Clickable onClick={handleClick}>Content</Clickable>,
            );

            const element = container.querySelector('span')!;
            fireEvent.click(element);

            expect(callOrder).toEqual(['log', 'onClick']);
        });
    });

    describe('Ref Forwarding', () => {
        it('should forward ref to the underlying element', () => {
            const ref = { current: null as HTMLElement | null };
            render(
                <Clickable onClick={() => {}} ref={ref}>
                    Content
                </Clickable>,
            );

            expect(ref.current).toBeInstanceOf(HTMLElement);
            expect(ref.current?.tagName).toBe('SPAN');
        });

        it('should forward ref with custom element type', () => {
            const ref = { current: null as HTMLElement | null };
            render(
                <Clickable onClick={() => {}} as='div' ref={ref}>
                    Content
                </Clickable>,
            );

            expect(ref.current).toBeInstanceOf(HTMLElement);
            expect(ref.current?.tagName).toBe('DIV');
        });
    });

    describe('Additional HTML Attributes', () => {
        it('should pass through additional HTML attributes', () => {
            const { container } = render(
                <Clickable onClick={() => {}} title='Tooltip text' tabIndex={0}>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            expect(element).toHaveAttribute('title', 'Tooltip text');
            expect(element).toHaveAttribute('tabIndex', '0');
        });

        it('should handle aria-describedby attribute', () => {
            const { container } = render(
                <Clickable onClick={() => {}} aria-describedby='description-id'>
                    Content
                </Clickable>,
            );

            const element = container.querySelector('span')!;
            expect(element).toHaveAttribute('aria-describedby', 'description-id');
        });
    });
});
