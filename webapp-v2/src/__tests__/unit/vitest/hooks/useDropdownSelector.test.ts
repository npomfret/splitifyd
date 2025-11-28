import { useDropdownSelector } from '@/app/hooks/useDropdownSelector';
import { act, renderHook } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface TestItem {
    id: string;
    name: string;
}

const createTestItems = (): TestItem[] => [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
];

describe('useDropdownSelector', () => {
    let mockOnSelect: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockOnSelect = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('initializes with closed state', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            expect(result.current.isOpen).toBe(false);
            expect(result.current.searchTerm).toBe('');
            expect(result.current.highlightedIndex).toBe(-1);
        });

        it('returns all items when no filter is applied', () => {
            const items = createTestItems();
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items,
                    onSelect: mockOnSelect,
                }),
            );

            expect(result.current.filteredItems).toEqual(items);
        });
    });

    describe('open/close state', () => {
        it('opens dropdown via open()', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });

            expect(result.current.isOpen).toBe(true);
        });

        it('closes dropdown via close()', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.close();
            });

            expect(result.current.isOpen).toBe(false);
        });

        it('toggles dropdown state', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.toggle();
            });
            expect(result.current.isOpen).toBe(true);

            act(() => {
                result.current.toggle();
            });
            expect(result.current.isOpen).toBe(false);
        });

        it('clears search term when closing in dropdown mode', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                    mode: 'dropdown',
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.handleSearchChange({ target: { value: 'test' } } as unknown as Event);
            });
            expect(result.current.searchTerm).toBe('test');

            act(() => {
                result.current.close();
            });
            expect(result.current.searchTerm).toBe('');
        });
    });

    describe('filtering', () => {
        it('filters items based on search term', () => {
            const filterFn = (item: TestItem, term: string) => item.name.toLowerCase().includes(term.toLowerCase());

            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                    filterFn,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.handleSearchChange({ target: { value: 'ali' } } as unknown as Event);
            });

            expect(result.current.filteredItems).toHaveLength(1);
            expect(result.current.filteredItems[0].name).toBe('Alice');
        });

        it('returns all items when search term is empty', () => {
            const filterFn = (item: TestItem, term: string) => item.name.toLowerCase().includes(term.toLowerCase());

            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                    filterFn,
                }),
            );

            expect(result.current.filteredItems).toHaveLength(3);
        });

        it('uses external search term in combobox mode', () => {
            const filterFn = (item: TestItem, term: string) => item.name.toLowerCase().includes(term.toLowerCase());

            const { result, rerender } = renderHook(
                ({ externalSearchTerm }) =>
                    useDropdownSelector({
                        items: createTestItems(),
                        onSelect: mockOnSelect,
                        filterFn,
                        mode: 'combobox',
                        externalSearchTerm,
                    }),
                { initialProps: { externalSearchTerm: '' } },
            );

            expect(result.current.filteredItems).toHaveLength(3);

            rerender({ externalSearchTerm: 'bob' });

            expect(result.current.filteredItems).toHaveLength(1);
            expect(result.current.filteredItems[0].name).toBe('Bob');
        });
    });

    describe('selection', () => {
        it('calls onSelect and closes dropdown when item is selected', () => {
            const items = createTestItems();
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items,
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.selectItem(items[1]);
            });

            expect(mockOnSelect).toHaveBeenCalledWith(items[1]);
            expect(result.current.isOpen).toBe(false);
        });
    });

    describe('keyboard navigation', () => {
        it('opens dropdown on ArrowDown when closed', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.isOpen).toBe(true);
        });

        it('moves highlight down on ArrowDown', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });

            const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.highlightedIndex).toBe(0);

            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.highlightedIndex).toBe(1);
        });

        it('moves highlight up on ArrowUp', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(2);
            });

            const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.highlightedIndex).toBe(1);
        });

        it('does not wrap in dropdown mode by default', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                    mode: 'dropdown',
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(2);
            });

            const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.highlightedIndex).toBe(2);
        });

        it('wraps in combobox mode by default', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                    mode: 'combobox',
                    externalSearchTerm: '',
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(2);
            });

            const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.highlightedIndex).toBe(0);
        });

        it('selects highlighted item on Enter', () => {
            const items = createTestItems();
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items,
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(1);
            });

            const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(mockOnSelect).toHaveBeenCalledWith(items[1]);
        });

        it('does not select on Enter when no item is highlighted', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });

            const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(mockOnSelect).not.toHaveBeenCalled();
        });

        it('closes dropdown on Escape', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });

            const event = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.isOpen).toBe(false);
        });

        it('closes dropdown on Tab', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });

            const event = { key: 'Tab', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(result.current.isOpen).toBe(false);
        });
    });

    describe('highlighted index management', () => {
        it('resets highlighted index when search term changes', () => {
            const filterFn = (item: TestItem, term: string) => item.name.toLowerCase().includes(term.toLowerCase());

            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                    filterFn,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(2);
            });

            expect(result.current.highlightedIndex).toBe(2);

            act(() => {
                result.current.handleSearchChange({ target: { value: 'a' } } as unknown as Event);
            });

            expect(result.current.highlightedIndex).toBe(-1);
        });

        it('resets highlighted index when dropdown closes', () => {
            const { result } = renderHook(() =>
                useDropdownSelector({
                    items: createTestItems(),
                    onSelect: mockOnSelect,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(1);
            });
            act(() => {
                result.current.close();
            });

            expect(result.current.highlightedIndex).toBe(-1);
        });
    });

    describe('navigation items', () => {
        it('uses getNavigationItems for keyboard navigation when provided', () => {
            const items = createTestItems();
            const reversedItems = [...items].reverse();

            const { result } = renderHook(() =>
                useDropdownSelector({
                    items,
                    onSelect: mockOnSelect,
                    getNavigationItems: () => reversedItems,
                }),
            );

            act(() => {
                result.current.open();
            });
            act(() => {
                result.current.setHighlightedIndex(0);
            });

            const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
            act(() => {
                result.current.handleKeyDown(event);
            });

            expect(mockOnSelect).toHaveBeenCalledWith(reversedItems[0]);
        });
    });
});
