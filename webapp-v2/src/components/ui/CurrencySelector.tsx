import { useCallback, useRef, useState, useEffect, useMemo } from 'preact/hooks';
import { CURRENCIES, getCurrency, COMMON_CURRENCIES, type Currency } from '@/utils/currency';
import { useDebounce } from '@/utils/debounce.ts';

interface CurrencySelectorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    error?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    recentCurrencies?: string[];
}

export function CurrencySelector({
    value,
    onChange,
    className = '',
    error,
    label,
    placeholder = 'Select currency...',
    required = false,
    disabled = false,
    recentCurrencies = [],
}: CurrencySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    // Currencies are now available synchronously
    const currencies = CURRENCIES as Currency[];
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputId = `currency-selector-${Math.random().toString(36).substr(2, 9)}`;

    const selectedCurrency = useMemo(() => getCurrency(value), [value]);

    // Debounce search term to avoid excessive filtering
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // No need to load currencies - they're available immediately

    // Prepare currency list with grouping - use debounced search term
    const { groupedCurrencies, flatList } = useMemo(() => {
        const searchLower = debouncedSearchTerm.toLowerCase();

        // Filter currencies based on search
        const filtered = debouncedSearchTerm.trim()
            ? currencies.filter(
                  (currency) =>
                      currency.acronym.toLowerCase().includes(searchLower) ||
                      currency.name.toLowerCase().includes(searchLower) ||
                      currency.countries.some((country) => country.toLowerCase().includes(searchLower)),
              )
            : currencies;

        // Group currencies
        const recent = recentCurrencies.map((code) => filtered.find((c) => c.acronym === code)).filter((c): c is Currency => !!c);

        const common = COMMON_CURRENCIES.map((code) => filtered.find((c) => c.acronym === code)).filter((c): c is Currency => !!c && !recent.some((r) => r.acronym === c.acronym));

        const others = filtered.filter((c) => !recent.some((r) => r.acronym === c.acronym) && !common.some((cm) => cm.acronym === c.acronym));

        const flat: Currency[] = [];
        if (recent.length > 0) flat.push(...recent);
        if (common.length > 0) flat.push(...common);
        if (others.length > 0) flat.push(...others);

        return {
            groupedCurrencies: { recent, common, others },
            flatList: flat,
        };
    }, [debouncedSearchTerm, recentCurrencies, currencies]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && inputRef.current && !dropdownRef.current.contains(event.target as Node) && !inputRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isOpen) {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIsOpen(true);
                }
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex((prev) => (prev < flatList.length - 1 ? prev + 1 : prev));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex >= 0 && highlightedIndex < flatList.length) {
                        handleCurrencySelect(flatList[highlightedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    setIsOpen(false);
                    setSearchTerm('');
                    break;
            }
        },
        [isOpen, highlightedIndex, flatList],
    );

    const handleCurrencySelect = useCallback(
        (currency: Currency) => {
            onChange(currency.acronym);
            setIsOpen(false);
            setSearchTerm('');
            setHighlightedIndex(-1);
            inputRef.current?.focus();
        },
        [onChange],
    );

    const handleInputClick = useCallback(() => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    }, [disabled, isOpen]);

    const handleSearchChange = useCallback((e: Event) => {
        const target = e.target as HTMLInputElement;
        setSearchTerm(target.value);
        setHighlightedIndex(-1);
    }, []);

    const baseInputClasses = [
        'block',
        'w-full',
        'rounded-md',
        'border',
        'px-3',
        'py-2',
        'text-gray-900',
        'shadow-sm',
        'placeholder:text-gray-400',
        'focus:outline-none',
        'focus:ring-2',
        'sm:text-sm',
        'sm:leading-6',
        'transition-colors',
        'duration-200',
        'cursor-pointer',
    ];

    const stateClasses = error ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-600 focus:border-indigo-600';

    const disabledClasses = disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white';

    const inputClasses = [...baseInputClasses, stateClasses, disabledClasses, className].filter(Boolean).join(' ');

    const renderCurrencyGroup = (title: string, currencies: Currency[], startIndex: number) => {
        if (currencies.length === 0) return null;

        return (
            <>
                {title && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</div>}
                {currencies.map((currency, index) => {
                    const globalIndex = startIndex + index;
                    const isHighlighted = highlightedIndex === globalIndex;

                    return (
                        <button
                            key={currency.acronym}
                            type="button"
                            role="option"
                            aria-selected={value === currency.acronym}
                            onClick={() => handleCurrencySelect(currency)}
                            className={`
                w-full text-left px-3 py-2 text-sm
                flex items-center justify-between
                transition-colors duration-100
                ${isHighlighted ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-900'}
              `}
                            onMouseEnter={() => setHighlightedIndex(globalIndex)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-medium" aria-label="Currency symbol">
                                    {currency.symbol}
                                </span>
                                <span className={isHighlighted ? 'text-white' : 'text-gray-900'} aria-label="Currency name and code">
                                    {currency.name} ({currency.acronym})
                                </span>
                            </div>
                        </button>
                    );
                })}
            </>
        );
    };

    return (
        <div className={className}>
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium leading-6 text-gray-900 mb-2">
                    {label}
                    {required && (
                        <span className="text-red-500 ml-1" data-testid="required-indicator">
                            *
                        </span>
                    )}
                </label>
            )}
            <div className="relative">
                <div
                    ref={inputRef}
                    onClick={handleInputClick}
                    onKeyDown={handleKeyDown}
                    tabIndex={disabled ? -1 : 0}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={`${inputId}-listbox`}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    className={inputClasses}
                >
                    {selectedCurrency ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{selectedCurrency.symbol}</span>
                                <span className="text-sm">{selectedCurrency.name} ({selectedCurrency.acronym})</span>
                            </div>
                            <svg
                                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">{placeholder}</span>
                            <svg
                                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    )}
                </div>

                {isOpen && (
                    <div
                        ref={dropdownRef}
                        id={`${inputId}-listbox`}
                        role="listbox"
                        className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-80 rounded-md py-1 overflow-auto ring-1 ring-black ring-opacity-5 focus:outline-none"
                    >
                        <div className="sticky top-0 bg-white px-3 py-2 border-b">
                            <label htmlFor={`${inputId}-search`} className="sr-only">
                                Search currencies
                            </label>
                            <input
                                id={`${inputId}-search`}
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder="Search currencies..."
                                aria-label="Search currencies"
                                aria-autocomplete="list"
                                aria-controls={`${inputId}-listbox`}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600"
                                autoFocus
                            />
                        </div>

                        {flatList.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500" role="status" aria-live="polite">
                                No currencies found
                            </div>
                        ) : (
                            <>
                                {renderCurrencyGroup(groupedCurrencies.recent.length > 0 ? 'Recent' : '', groupedCurrencies.recent, 0)}
                                {renderCurrencyGroup(groupedCurrencies.common.length > 0 ? 'Common' : '', groupedCurrencies.common, groupedCurrencies.recent.length)}
                                {renderCurrencyGroup(
                                    groupedCurrencies.others.length > 0 ? 'All Currencies' : '',
                                    groupedCurrencies.others,
                                    groupedCurrencies.recent.length + groupedCurrencies.common.length,
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
            {error && (
                <p id={`${inputId}-error`} className="mt-2 text-sm text-red-600" role="alert" data-testid="currency-selector-error-message">
                    {error}
                </p>
            )}
        </div>
    );
}
