import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { useCallback, useMemo } from 'preact/hooks';
import { type Currency, CurrencyService } from '../services/currencyService';
import { useDropdownSelector } from './useDropdownSelector';

interface UseCurrencySelectorOptions {
    onCurrencyChange: (currency: CurrencyISOCode) => void;
    recentCurrencies?: string[];
    permittedCurrencies?: string[]; // If provided, only show these currencies
}

/**
 * Hook that manages currency selection dropdown logic.
 * Wraps useDropdownSelector with currency-specific filtering and grouping.
 */
export function useCurrencySelector({ onCurrencyChange, recentCurrencies = [], permittedCurrencies }: UseCurrencySelectorOptions) {
    const currencyService = CurrencyService.getInstance();
    const allCurrencies = currencyService.getCurrencies();

    // If permittedCurrencies is provided, filter to only those currencies
    const currencies = useMemo(() => {
        if (!permittedCurrencies || permittedCurrencies.length === 0) {
            return allCurrencies;
        }
        return allCurrencies.filter((c) => permittedCurrencies.includes(c.acronym));
    }, [allCurrencies, permittedCurrencies]);

    const filterFn = (currency: Currency, searchTerm: string) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            currency.symbol.toLowerCase().includes(searchLower)
            || currency.acronym.toLowerCase().includes(searchLower)
            || currency.name.toLowerCase().includes(searchLower)
            || currency.countries.some((country) => country.toLowerCase().includes(searchLower))
        );
    };

    // Navigation order: recent -> common -> others (grouped order)
    const getNavigationItems = useCallback(
        (filteredItems: Currency[]) => {
            const grouped = currencyService.groupCurrencies(filteredItems, recentCurrencies);
            return currencyService.getFlatCurrencyArray(grouped);
        },
        [currencyService, recentCurrencies],
    );

    const dropdown = useDropdownSelector({
        items: currencies,
        onSelect: (currency) => {
            onCurrencyChange(currency.acronym);
            currencyService.addToRecentCurrencies(currency.acronym);
        },
        filterFn,
        debounceMs: 200,
        getNavigationItems,
    });

    // Currency-specific: group filtered items for display
    const groupedCurrencies = useMemo(
        () => currencyService.groupCurrencies(dropdown.filteredItems, recentCurrencies),
        [dropdown.filteredItems, recentCurrencies, currencyService],
    );

    return {
        // State from base hook
        isOpen: dropdown.isOpen,
        searchTerm: dropdown.searchTerm,
        highlightedIndex: dropdown.highlightedIndex,

        // Data
        filteredCurrencies: dropdown.filteredItems,
        groupedCurrencies,

        // Refs
        dropdownRef: dropdown.dropdownRef,
        searchInputRef: dropdown.searchInputRef,
        currencyButtonRef: dropdown.triggerRef,

        // Handlers
        handleCurrencySelect: dropdown.selectItem,
        handleCurrencyClick: dropdown.toggle,
        handleSearchChange: dropdown.handleSearchChange,
        handleKeyDown: dropdown.handleKeyDown,
        setHighlightedIndex: dropdown.setHighlightedIndex,
        closeDropdown: dropdown.close,
    };
}
