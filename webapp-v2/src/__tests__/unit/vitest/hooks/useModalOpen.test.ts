import { useModalOpen, useModalOpenOrChange } from '@/app/hooks/useModalOpen';
import { act, renderHook } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useModalOpen', () => {
    let mockOnOpen: () => void;
    let mockOnClose: () => void;

    beforeEach(() => {
        mockOnOpen = vi.fn();
        mockOnClose = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('onOpen callback', () => {
        it('calls onOpen when modal transitions from closed to open', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onOpen: mockOnOpen }),
                { initialProps: { isOpen: false } },
            );

            expect(mockOnOpen).not.toHaveBeenCalled();

            rerender({ isOpen: true });

            expect(mockOnOpen).toHaveBeenCalledTimes(1);
        });

        it('does not call onOpen when modal is already open', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onOpen: mockOnOpen }),
                { initialProps: { isOpen: true } },
            );

            expect(mockOnOpen).not.toHaveBeenCalled();

            rerender({ isOpen: true });

            expect(mockOnOpen).not.toHaveBeenCalled();
        });

        it('does not call onOpen when modal stays closed', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onOpen: mockOnOpen }),
                { initialProps: { isOpen: false } },
            );

            rerender({ isOpen: false });

            expect(mockOnOpen).not.toHaveBeenCalled();
        });

        it('calls onOpen again when modal reopens after being closed', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onOpen: mockOnOpen }),
                { initialProps: { isOpen: false } },
            );

            rerender({ isOpen: true });
            expect(mockOnOpen).toHaveBeenCalledTimes(1);

            rerender({ isOpen: false });
            expect(mockOnOpen).toHaveBeenCalledTimes(1);

            rerender({ isOpen: true });
            expect(mockOnOpen).toHaveBeenCalledTimes(2);
        });
    });

    describe('onClose callback', () => {
        it('calls onClose when modal transitions from open to closed', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onClose: mockOnClose }),
                { initialProps: { isOpen: true } },
            );

            expect(mockOnClose).not.toHaveBeenCalled();

            rerender({ isOpen: false });

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when modal is already closed', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onClose: mockOnClose }),
                { initialProps: { isOpen: false } },
            );

            rerender({ isOpen: false });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('does not call onClose when modal stays open', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onClose: mockOnClose }),
                { initialProps: { isOpen: true } },
            );

            rerender({ isOpen: true });

            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('both callbacks', () => {
        it('calls correct callback for each transition', () => {
            const { rerender } = renderHook(
                ({ isOpen }) => useModalOpen(isOpen, { onOpen: mockOnOpen, onClose: mockOnClose }),
                { initialProps: { isOpen: false } },
            );

            rerender({ isOpen: true });
            expect(mockOnOpen).toHaveBeenCalledTimes(1);
            expect(mockOnClose).not.toHaveBeenCalled();

            rerender({ isOpen: false });
            expect(mockOnOpen).toHaveBeenCalledTimes(1);
            expect(mockOnClose).toHaveBeenCalledTimes(1);

            rerender({ isOpen: true });
            expect(mockOnOpen).toHaveBeenCalledTimes(2);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });
});

describe('useModalOpenOrChange', () => {
    let mockOnOpenOrChange: () => void;

    beforeEach(() => {
        mockOnOpenOrChange = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('open transition', () => {
        it('calls callback when modal opens', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: false, entityId: 'user-1' } },
            );

            expect(mockOnOpenOrChange).not.toHaveBeenCalled();

            rerender({ isOpen: true, entityId: 'user-1' });

            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(1);
        });

        it('does not call callback when modal starts open', () => {
            renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: true, entityId: 'user-1' } },
            );

            expect(mockOnOpenOrChange).not.toHaveBeenCalled();
        });
    });

    describe('entity change while open', () => {
        it('calls callback when entity changes while modal is open', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: true, entityId: 'user-1' } },
            );

            expect(mockOnOpenOrChange).not.toHaveBeenCalled();

            rerender({ isOpen: true, entityId: 'user-2' });

            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(1);
        });

        it('does not call callback when entity changes while modal is closed', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: false, entityId: 'user-1' } },
            );

            rerender({ isOpen: false, entityId: 'user-2' });

            expect(mockOnOpenOrChange).not.toHaveBeenCalled();
        });

        it('does not call callback when entity stays the same', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: true, entityId: 'user-1' } },
            );

            rerender({ isOpen: true, entityId: 'user-1' });

            expect(mockOnOpenOrChange).not.toHaveBeenCalled();
        });
    });

    describe('combined transitions', () => {
        it('calls callback once when both open and entity change happen together', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: false, entityId: 'user-1' } },
            );

            rerender({ isOpen: true, entityId: 'user-2' });

            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(1);
        });

        it('tracks multiple transitions correctly', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: false, entityId: 'user-1' } },
            );

            rerender({ isOpen: true, entityId: 'user-1' });
            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(1);

            rerender({ isOpen: true, entityId: 'user-2' });
            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(2);

            rerender({ isOpen: false, entityId: 'user-2' });
            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(2);

            rerender({ isOpen: true, entityId: 'user-2' });
            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(3);
        });
    });

    describe('undefined entity handling', () => {
        it('handles undefined entity correctly', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: false, entityId: undefined as string | undefined } },
            );

            rerender({ isOpen: true, entityId: undefined });
            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(1);

            rerender({ isOpen: true, entityId: 'user-1' });
            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(2);
        });

        it('treats undefined to defined as a change', () => {
            const { rerender } = renderHook(
                ({ isOpen, entityId }) => useModalOpenOrChange(isOpen, entityId, mockOnOpenOrChange),
                { initialProps: { isOpen: true, entityId: undefined as string | undefined } },
            );

            rerender({ isOpen: true, entityId: 'user-1' });

            expect(mockOnOpenOrChange).toHaveBeenCalledTimes(1);
        });
    });
});
