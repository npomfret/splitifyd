import { usePayerSelector } from '@/app/hooks/usePayerSelector';
import type { ExpenseFormMember } from '@/components/expense-form/types';
import { ExpenseFormMemberBuilder } from '@billsplit-wl/test-support';
import { act, renderHook } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createTestMembers = (): ExpenseFormMember[] => [
    new ExpenseFormMemberBuilder()
        .withUid('user-1')
        .withGroupDisplayName('Alice Smith')
        .withDisplayName('Alice')
        .build(),
    new ExpenseFormMemberBuilder()
        .withUid('user-2')
        .withGroupDisplayName('Bob Jones')
        .withDisplayName('Bob')
        .build(),
    new ExpenseFormMemberBuilder()
        .withUid('user-3')
        .withGroupDisplayName('Charlie Brown')
        .withDisplayName(null)
        .build(),
];

describe('usePayerSelector', () => {
    let mockOnPayerChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockOnPayerChange = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('initializes with all members available', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            expect(result.current.filteredMembers).toEqual(members);
            expect(result.current.isOpen).toBe(false);
        });
    });

    describe('filtering', () => {
        it('filters members by groupDisplayName', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.handleSearchChange({ target: { value: 'alice' } } as unknown as Event);
            });

            expect(result.current.filteredMembers).toHaveLength(1);
            expect(result.current.filteredMembers[0].groupDisplayName).toBe('Alice Smith');
        });

        it('filter is case-insensitive', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.handleSearchChange({ target: { value: 'BOB' } } as unknown as Event);
            });

            expect(result.current.filteredMembers).toHaveLength(1);
            expect(result.current.filteredMembers[0].groupDisplayName).toBe('Bob Jones');
        });

        it('returns empty array when no members match', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.handleSearchChange({ target: { value: 'xyz' } } as unknown as Event);
            });

            expect(result.current.filteredMembers).toHaveLength(0);
        });

        it('matches partial groupDisplayName', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.handleSearchChange({ target: { value: 'own' } } as unknown as Event);
            });

            expect(result.current.filteredMembers).toHaveLength(1);
            expect(result.current.filteredMembers[0].groupDisplayName).toBe('Charlie Brown');
        });
    });

    describe('selection', () => {
        it('calls onPayerChange with user ID when member is selected', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.selectItem(members[1]);
            });

            expect(mockOnPayerChange).toHaveBeenCalledWith('user-2');
        });

        it('closes dropdown after selection', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            expect(result.current.isOpen).toBe(true);

            act(() => {
                result.current.selectItem(members[0]);
            });
            expect(result.current.isOpen).toBe(false);
        });
    });

    describe('keyboard navigation', () => {
        it('navigates through members with arrow keys', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });

            const downEvent = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(downEvent);
            });
            expect(result.current.highlightedIndex).toBe(0);

            act(() => {
                result.current.handleKeyDown(downEvent);
            });
            expect(result.current.highlightedIndex).toBe(1);
        });

        it('selects highlighted member on Enter', () => {
            const members = createTestMembers();
            const { result } = renderHook(() =>
                usePayerSelector({
                    members,
                    onPayerChange: mockOnPayerChange,
                })
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(2);
            });

            const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(enterEvent);
            });

            expect(mockOnPayerChange).toHaveBeenCalledWith('user-3');
        });
    });

    describe('empty state', () => {
        it('handles empty members array', () => {
            const { result } = renderHook(() =>
                usePayerSelector({
                    members: [],
                    onPayerChange: mockOnPayerChange,
                })
            );

            expect(result.current.filteredMembers).toHaveLength(0);
        });
    });
});
