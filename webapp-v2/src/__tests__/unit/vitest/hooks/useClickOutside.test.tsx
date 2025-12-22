import { useClickOutside } from '@/app/hooks/useClickOutside';
import { cleanup, render } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Test component that uses the hook
function TestComponent({
    onClickOutside,
    enabled = true,
    withExcludeRef = false,
}: {
    onClickOutside: () => void;
    enabled?: boolean;
    withExcludeRef?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const excludeRef = useRef<HTMLButtonElement>(null);

    useClickOutside(containerRef, onClickOutside, {
        enabled,
        excludeRef: withExcludeRef ? excludeRef : undefined,
    });

    return (
        <div>
            <div ref={containerRef} data-testid='container'>
                <span data-testid='inside'>Inside content</span>
            </div>
            <button ref={excludeRef} data-testid='exclude-button'>
                Toggle
            </button>
            <div data-testid='outside'>Outside content</div>
        </div>
    );
}

describe('useClickOutside', () => {
    let mockCallback: () => void;

    beforeEach(() => {
        mockCallback = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    describe('basic functionality', () => {
        it('calls callback when clicking outside the container', async () => {
            const { getByTestId } = render(<TestComponent onClickOutside={mockCallback} />);

            // Advance past the setTimeout delay
            vi.advanceTimersByTime(1);

            // Click outside
            const outside = getByTestId('outside');
            outside.click();

            expect(mockCallback).toHaveBeenCalledTimes(1);
        });

        it('does not call callback when clicking inside the container', async () => {
            const { getByTestId } = render(<TestComponent onClickOutside={mockCallback} />);

            vi.advanceTimersByTime(1);

            // Click inside
            const inside = getByTestId('inside');
            inside.click();

            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('does not call callback when clicking on the container itself', async () => {
            const { getByTestId } = render(<TestComponent onClickOutside={mockCallback} />);

            vi.advanceTimersByTime(1);

            const container = getByTestId('container');
            container.click();

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('enabled option', () => {
        it('does not attach listener when enabled is false', () => {
            const { getByTestId } = render(
                <TestComponent onClickOutside={mockCallback} enabled={false} />,
            );

            vi.advanceTimersByTime(1);

            const outside = getByTestId('outside');
            outside.click();

            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('attaches listener when enabled changes to true', () => {
            const { getByTestId, rerender } = render(
                <TestComponent onClickOutside={mockCallback} enabled={false} />,
            );

            vi.advanceTimersByTime(1);

            // Click while disabled - should not trigger
            getByTestId('outside').click();
            expect(mockCallback).not.toHaveBeenCalled();

            // Re-render with enabled=true
            rerender(<TestComponent onClickOutside={mockCallback} enabled={true} />);
            vi.advanceTimersByTime(1);

            // Click outside - should trigger now
            getByTestId('outside').click();
            expect(mockCallback).toHaveBeenCalledTimes(1);
        });

        it('removes listener when enabled changes to false', () => {
            const { getByTestId, rerender } = render(
                <TestComponent onClickOutside={mockCallback} enabled={true} />,
            );

            vi.advanceTimersByTime(1);

            // Verify it works initially
            getByTestId('outside').click();
            expect(mockCallback).toHaveBeenCalledTimes(1);

            // Re-render with enabled=false
            rerender(<TestComponent onClickOutside={mockCallback} enabled={false} />);

            // Click outside - should not trigger anymore
            getByTestId('outside').click();
            expect(mockCallback).toHaveBeenCalledTimes(1); // Still 1 from before
        });
    });

    describe('excludeRef option', () => {
        it('does not call callback when clicking on excluded element', () => {
            const { getByTestId } = render(
                <TestComponent onClickOutside={mockCallback} withExcludeRef={true} />,
            );

            vi.advanceTimersByTime(1);

            const excludeButton = getByTestId('exclude-button');
            excludeButton.click();

            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('still calls callback when clicking other outside elements', () => {
            const { getByTestId } = render(
                <TestComponent onClickOutside={mockCallback} withExcludeRef={true} />,
            );

            vi.advanceTimersByTime(1);

            const outside = getByTestId('outside');
            outside.click();

            expect(mockCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('setTimeout delay', () => {
        it('does not trigger callback before setTimeout fires', () => {
            const { getByTestId } = render(<TestComponent onClickOutside={mockCallback} />);

            // Don't advance timers - listener should not be attached yet
            const outside = getByTestId('outside');
            outside.click();

            expect(mockCallback).not.toHaveBeenCalled();
        });

        it('triggers callback after setTimeout delay', () => {
            const { getByTestId } = render(<TestComponent onClickOutside={mockCallback} />);

            // Advance past the setTimeout(0) delay
            vi.advanceTimersByTime(1);

            const outside = getByTestId('outside');
            outside.click();

            expect(mockCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup', () => {
        it('removes listener on unmount', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

            const { unmount } = render(<TestComponent onClickOutside={mockCallback} />);

            vi.advanceTimersByTime(1);

            expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true);

            unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                true,
            );

            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });

        it('clears timeout on unmount before it fires', () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

            const { unmount } = render(<TestComponent onClickOutside={mockCallback} />);

            // Unmount before setTimeout fires
            unmount();

            // Advance timers
            vi.advanceTimersByTime(100);

            // Listener should never have been added
            expect(addEventListenerSpy).not.toHaveBeenCalled();

            addEventListenerSpy.mockRestore();
        });
    });

    describe('multiple clicks', () => {
        it('calls callback on each outside click', () => {
            const { getByTestId } = render(<TestComponent onClickOutside={mockCallback} />);

            vi.advanceTimersByTime(1);

            const outside = getByTestId('outside');
            outside.click();
            outside.click();
            outside.click();

            expect(mockCallback).toHaveBeenCalledTimes(3);
        });
    });
});
