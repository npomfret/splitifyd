import { useCurrencySelector } from '@/app/hooks/useCurrencySelector';
import { type Currency, CurrencyService } from '@/app/services/currencyService';
import { Amount } from '@splitifyd/shared';
import { useCallback, useMemo, useRef } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface CurrencyAmountInputProps {
    amount: Amount;
    currency: string;
    onAmountChange: (amount: string) => void;
    onCurrencyChange: (currency: string) => void;
    onAmountBlur?: () => void;
    label?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    recentCurrencies?: string[];
}

export function CurrencyAmountInput({
    amount,
    currency,
    onAmountChange,
    onCurrencyChange,
    onAmountBlur,
    label,
    error,
    required = false,
    disabled = false,
    placeholder,
    className = '',
    recentCurrencies = [],
}: CurrencyAmountInputProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const currencyService = CurrencyService.getInstance();

    // Use the currency selector hook for all dropdown logic
    const {
        isOpen,
        searchTerm,
        highlightedIndex,
        filteredCurrencies,
        groupedCurrencies,
        dropdownRef,
        searchInputRef,
        currencyButtonRef,
        handleCurrencySelect,
        handleCurrencyClick,
        handleSearchChange,
        handleKeyDown,
        setHighlightedIndex,
    } = useCurrencySelector({
        onCurrencyChange: (selectedCurrency) => {
            onCurrencyChange(selectedCurrency);
            inputRef.current?.focus();
        },
        recentCurrencies,
    });

    const selectedCurrency = useMemo(() => (currency ? currencyService.getCurrencyByCode(currency) : undefined), [currency, currencyService]);

    // Calculate min and step values based on currency decimal digits using service
    const { minValue, stepValue } = useMemo(() => {
        return currency ? currencyService.getCurrencyInputConfig(currency) : { minValue: '0.01', stepValue: '0.01' };
    }, [currency, currencyService]);

    const handleAmountChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            onAmountChange(target.value);
        },
        [onAmountChange],
    );

    const handleCurrencyClickWrapper = useCallback(() => {
        if (!disabled) {
            handleCurrencyClick();
        }
    }, [disabled, handleCurrencyClick]);

    const renderCurrencyGroup = (title: string, currencies: Currency[], startIndex: number) => {
        if (currencies.length === 0) return null;

        return (
            <>
                {title && <div className='px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50'>{title}</div>}
                {currencies.map((curr, index) => {
                    const globalIndex = startIndex + index;
                    const isHighlighted = highlightedIndex === globalIndex;

                    return (
                        <button
                            key={curr.acronym}
                            type='button'
                            role='option'
                            aria-selected={currency === curr.acronym}
                            onClick={() => handleCurrencySelect(curr)}
                            onMouseEnter={() => setHighlightedIndex(globalIndex)}
                            className={`
                w-full text-left px-3 py-2 text-sm
                flex items-center gap-3
                transition-colors duration-100
                ${isHighlighted ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-900'}
              `}
                        >
                            <span className={`font-medium text-base ${isHighlighted ? 'text-white' : 'text-gray-700'}`}>{curr.symbol}</span>
                            <span className={`text-sm ${isHighlighted ? 'text-white' : 'text-gray-900'}`}>
                                {curr.name} ({curr.acronym})
                            </span>
                        </button>
                    );
                })}
            </>
        );
    };

    const inputId = `currency-amount-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={className}>
            {label && (
                <label htmlFor={inputId} className='block text-sm font-medium leading-6 text-gray-900 mb-2'>
                    {label}
                    {required && (
                        <span className='text-red-500 ml-1' data-testid='required-indicator'>
                            {t('uiComponents.currencyAmountInput.requiredIndicator')}
                        </span>
                    )}
                </label>
            )}

            <div className='relative'>
                <div className='flex'>
                    {/* Currency selector button */}
                    <button
                        ref={currencyButtonRef}
                        type='button'
                        onClick={handleCurrencyClickWrapper}
                        disabled={disabled}
                        className={`
              flex items-center justify-center px-3 
              border border-r-0 rounded-l-md
              transition-colors duration-200
              ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 cursor-pointer'}
              ${error ? 'border-red-300' : 'border-gray-300'}
            `}
                        aria-label={t('uiComponents.currencyAmountInput.selectCurrency')}
                        aria-expanded={isOpen}
                        aria-haspopup='listbox'
                    >
                        <div className='flex items-baseline gap-2'>
                            <span className={`font-semibold text-lg leading-none ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                                {selectedCurrency?.symbol ?? currency ?? t('uiComponents.currencyAmountInput.unknown')}
                            </span>
                            {' '}
                            <span className={`text-xs font-medium uppercase tracking-wide ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
                                {selectedCurrency?.acronym ?? currency ?? ''}
                            </span>
                        </div>
                        <svg className={`ml-1 h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden='true' focusable='false' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'>
                            <path
                                fillRule='evenodd'
                                d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                                clipRule='evenodd'
                            />
                        </svg>
                    </button>

                    {/* Amount input */}
                    <input
                        ref={inputRef}
                        id={inputId}
                        type='number'
                        inputMode='decimal'
                        min={minValue}
                        step={stepValue}
                        value={amount}
                        onInput={handleAmountChange}
                        onBlur={onAmountBlur}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        placeholder={placeholder || t('uiComponents.currencyAmountInput.placeholder')}
                        required={required}
                        autoComplete='off'
                        className={`
              flex-1 px-3 py-2
              border rounded-r-md
              focus:outline-none focus:ring-2 focus:ring-indigo-600
              transition-colors duration-200
              ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'}
              ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
            `}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                    />
                </div>

                {/* Currency dropdown */}
                {isOpen && (
                    <div ref={dropdownRef} role='listbox' className='absolute z-20 mt-1 w-full max-w-md bg-white shadow-lg max-h-80 rounded-md overflow-hidden ring-1 ring-black ring-opacity-5'>
                        {/* Search input */}
                        <div className='sticky top-0 bg-white border-b border-gray-200 p-2'>
                            <input
                                ref={searchInputRef}
                                type='text'
                                value={searchTerm}
                                onInput={handleSearchChange}
                                onKeyDown={handleKeyDown}
                                placeholder={t('uiComponents.currencyAmountInput.searchPlaceholder')}
                                className='w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-600'
                                aria-label={t('uiComponents.currencyAmountInput.searchAriaLabel')}
                            />
                        </div>

                        {/* Currency list */}
                        <div className='overflow-auto max-h-64'>
                            {filteredCurrencies.length === 0
                                ? (
                                    <div className='px-3 py-4 text-sm text-gray-500 text-center' role='status'>
                                        {t('uiComponents.currencyAmountInput.noCurrencies')}
                                    </div>
                                )
                                : (
                                    <>
                                        {renderCurrencyGroup(groupedCurrencies.recent.length > 0 ? t('uiComponents.currencyAmountInput.recent') : '', groupedCurrencies.recent, 0)}
                                        {renderCurrencyGroup(
                                            groupedCurrencies.common.length > 0 ? t('uiComponents.currencyAmountInput.common') : '',
                                            groupedCurrencies.common,
                                            groupedCurrencies.recent.length,
                                        )}
                                        {renderCurrencyGroup(
                                            groupedCurrencies.others.length > 0 ? t('uiComponents.currencyAmountInput.allCurrencies') : '',
                                            groupedCurrencies.others,
                                            groupedCurrencies.recent.length + groupedCurrencies.common.length,
                                        )}
                                    </>
                                )}
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <p id={`${inputId}-error`} className='mt-2 text-sm text-red-600' role='alert' data-testid='currency-input-error-message'>
                    {error}
                </p>
            )}
        </div>
    );
}
