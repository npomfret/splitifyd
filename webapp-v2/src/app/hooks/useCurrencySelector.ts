import { useDebounce } from '@/utils/debounce.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Currency, CurrencyService } from '../services/currencyService';

interface UseCurrencySelectorOptions {
    onCurrencyChange: (currency: string) => void;
    recentCurrencies?: string[];
}

/**
 * Hook that manages currency selection dropdown logic
 * Uses the CurrencyService for all data operations
 */
export function useCurrencySelector({ onCurrencyChange, recentCurrencies = [] }: UseCurrencySelectorOptions) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const currencyButtonRef = useRef<HTMLButtonElement>(null);

    const debouncedSearchTerm = useDebounce(searchTerm, 200);
    const currencyService = CurrencyService.getInstance();

    // Currencies are now available synchronously
    const currencies = currencyService.getCurrencies();

    // Filter currencies based on search using service
    const filteredCurrencies = useMemo(() => {
        return currencyService.filterCurrencies(currencies, debouncedSearchTerm);
    }, [debouncedSearchTerm, currencies, currencyService]);

    // Group currencies for display using service
    const groupedCurrencies = useMemo(() => {
        return currencyService.groupCurrencies(filteredCurrencies, recentCurrencies);
    }, [filteredCurrencies, recentCurrencies, currencyService]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && !currencyButtonRef.current?.contains(event.target as Node)) {
                closeDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
    }, []);

    const handleCurrencySelect = useCallback(
        (currency: Currency) => {
            onCurrencyChange(currency.acronym);
            // Add to recent currencies
            currencyService.addToRecentCurrencies(currency.acronym);
            closeDropdown();
        },
        [onCurrencyChange, currencyService, closeDropdown],
    );

    const handleCurrencyClick = useCallback(() => {
        setIsOpen(!isOpen);
    }, [isOpen]);

    const handleSearchChange = useCallback((e: Event) => {
        const target = e.target as HTMLInputElement;
        setSearchTerm(target.value);
        setHighlightedIndex(-1);
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isOpen) return;

            const allCurrencies = currencyService.getFlatCurrencyArray(groupedCurrencies);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex((prev) => (prev < allCurrencies.length - 1 ? prev + 1 : prev));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex >= 0 && highlightedIndex < allCurrencies.length) {
                        handleCurrencySelect(allCurrencies[highlightedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeDropdown();
                    break;
            }
        },
        [isOpen, highlightedIndex, groupedCurrencies, currencyService, handleCurrencySelect, closeDropdown],
    );

    return {
        // State
        isOpen,
        searchTerm,
        highlightedIndex,

        // Data
        filteredCurrencies,
        groupedCurrencies,

        // Refs
        dropdownRef,
        searchInputRef,
        currencyButtonRef,

        // Handlers
        handleCurrencySelect,
        handleCurrencyClick,
        handleSearchChange,
        handleKeyDown,
        setHighlightedIndex,
        closeDropdown,
    };
}
