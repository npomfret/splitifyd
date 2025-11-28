import { useDebounce } from '@/utils/debounce.ts';
import type { Ref } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

interface UseDropdownSelectorOptions<T> {
    items: T[];
    onSelect: (item: T) => void;
    filterFn?: (item: T, searchTerm: string) => boolean;
    debounceMs?: number;
    /**
     * Optional function to get items in navigation order.
     * Used when display order differs from filtered order (e.g., grouped currencies).
     * If not provided, filteredItems is used for navigation.
     */
    getNavigationItems?: (filteredItems: T[]) => T[];
    /**
     * Mode of operation:
     * - 'dropdown': Button trigger with separate search input inside dropdown (default)
     * - 'combobox': Text input IS the trigger and search field
     */
    mode?: 'dropdown' | 'combobox';
    /**
     * External search term for combobox mode.
     * In combobox mode, the search term comes from the input's value prop.
     */
    externalSearchTerm?: string;
    /**
     * Whether arrow keys wrap around at list boundaries.
     * Default: false for dropdown, true for combobox
     */
    wrapNavigation?: boolean;
}

interface UseDropdownSelectorReturn<T> {
    // State
    isOpen: boolean;
    searchTerm: string;
    highlightedIndex: number;
    filteredItems: T[];

    // Refs
    dropdownRef: Ref<HTMLDivElement>;
    searchInputRef: Ref<HTMLInputElement>;
    triggerRef: Ref<HTMLButtonElement>;

    // Actions
    open: () => void;
    close: () => void;
    toggle: () => void;
    setHighlightedIndex: (index: number) => void;
    selectItem: (item: T) => void;
    handleKeyDown: (e: KeyboardEvent) => void;
    handleSearchChange: (e: Event) => void;
}

/**
 * Base hook for dropdown selector components.
 * Handles common functionality: open/close state, search filtering,
 * keyboard navigation, click-outside detection, and focus management.
 *
 * Supports two modes:
 * - 'dropdown': Button trigger with separate search input (currency/payer selectors)
 * - 'combobox': Text input IS the trigger and search field (label suggestion input)
 *
 * Used by: useCurrencySelector, usePayerSelector, LabelSuggestionInput
 */
export function useDropdownSelector<T>({
    items,
    onSelect,
    filterFn,
    debounceMs = 0,
    getNavigationItems,
    mode = 'dropdown',
    externalSearchTerm,
    wrapNavigation,
}: UseDropdownSelectorOptions<T>): UseDropdownSelectorReturn<T> {
    const [isOpen, setIsOpen] = useState(false);
    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // In combobox mode, use external search term; in dropdown mode, use internal
    const searchTerm = mode === 'combobox' && externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
    const debouncedSearchTerm = debounceMs > 0 ? useDebounce(searchTerm, debounceMs) : searchTerm;

    // Default wrap behavior: combobox wraps, dropdown doesn't
    const shouldWrap = wrapNavigation ?? (mode === 'combobox');

    // Reset highlighted index when external search term changes (combobox mode)
    useEffect(() => {
        if (mode === 'combobox') {
            setHighlightedIndex(-1);
        }
    }, [externalSearchTerm, mode]);

    // Filter items based on search term
    const filteredItems = useMemo(() => {
        if (!filterFn || !debouncedSearchTerm.trim()) {
            return items;
        }
        return items.filter((item) => filterFn(item, debouncedSearchTerm));
    }, [items, debouncedSearchTerm, filterFn]);

    // Items in navigation order (may differ from filtered order for grouped displays)
    const navigationItems = useMemo(() => {
        return getNavigationItems ? getNavigationItems(filteredItems) : filteredItems;
    }, [filteredItems, getNavigationItems]);

    // Click-outside detection
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
            const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
            const isOutsideSearch = searchInputRef.current && !searchInputRef.current.contains(target);

            if (isOutsideDropdown && isOutsideTrigger && isOutsideSearch) {
                close();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-focus search input when dropdown opens (only in dropdown mode)
    // In combobox mode, the input is already focused since it's the trigger
    useEffect(() => {
        if (mode === 'dropdown' && isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, mode]);

    const open = useCallback(() => {
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        // Only clear internal search term in dropdown mode
        // In combobox mode, the search term is controlled externally
        if (mode === 'dropdown') {
            setInternalSearchTerm('');
        }
        setHighlightedIndex(-1);
    }, [mode]);

    const toggle = useCallback(() => {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }, [isOpen, open, close]);

    const selectItem = useCallback(
        (item: T) => {
            onSelect(item);
            close();
        },
        [onSelect, close],
    );

    const handleSearchChange = useCallback((e: Event) => {
        const target = e.target as HTMLInputElement;
        setInternalSearchTerm(target.value);
        setHighlightedIndex(-1);
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isOpen) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    open();
                }
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex((prev) => {
                        if (prev < navigationItems.length - 1) {
                            return prev + 1;
                        }
                        // At end: wrap to start if enabled, otherwise stay
                        return shouldWrap ? 0 : prev;
                    });
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex((prev) => {
                        if (prev > 0) {
                            return prev - 1;
                        }
                        // At start: wrap to end if enabled, otherwise go to -1 (search field in dropdown mode)
                        return shouldWrap ? navigationItems.length - 1 : -1;
                    });
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex >= 0 && highlightedIndex < navigationItems.length) {
                        selectItem(navigationItems[highlightedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    close();
                    // In dropdown mode, return focus to trigger button
                    if (mode === 'dropdown') {
                        triggerRef.current?.focus();
                    }
                    break;
                case 'Tab':
                    close();
                    break;
            }
        },
        [isOpen, navigationItems, highlightedIndex, open, close, selectItem, shouldWrap, mode],
    );

    return {
        // State
        isOpen,
        searchTerm,
        highlightedIndex,
        filteredItems,

        // Refs
        dropdownRef,
        searchInputRef,
        triggerRef,

        // Actions
        open,
        close,
        toggle,
        setHighlightedIndex,
        selectItem,
        handleKeyDown,
        handleSearchChange,
    };
}
