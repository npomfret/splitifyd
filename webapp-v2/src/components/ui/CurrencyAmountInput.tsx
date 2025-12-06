import { useCurrencySelector } from '@/app/hooks/useCurrencySelector';
import { type Currency, CurrencyService } from '@/app/services/currencyService';
import { Amount, toCurrencyISOCode } from '@billsplit-wl/shared';
import { createPortal } from 'preact/compat';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, CurrencyIcon } from './icons';

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
}

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
    const triggerContainerRef = useRef<HTMLDivElement>(null);
    const currencyService = CurrencyService.getInstance();
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

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

    // Calculate dropdown position when open
    const calculatePosition = useCallback(() => {
        if (!triggerContainerRef.current) return;

        const rect = triggerContainerRef.current.getBoundingClientRect();
        setDropdownPosition({
            top: rect.bottom + 4, // 4px gap (mt-1 equivalent)
            left: rect.left,
            width: Math.max(rect.width, 320), // Ensure minimum width for currency names
        });
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) {
            setDropdownPosition(null);
            return;
        }

        calculatePosition();

        window.addEventListener('scroll', calculatePosition, true);
        window.addEventListener('resize', calculatePosition);

        return () => {
            window.removeEventListener('scroll', calculatePosition, true);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [isOpen, calculatePosition]);

    // Calculate min and step values based on currency decimal digits using service
    const { minValue, stepValue } = useMemo(() => {
        return currency ? currencyService.getCurrencyInputConfig(toCurrencyISOCode(currency)) : { minValue: '0.01', stepValue: '0.01' };
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
                {title && <div className='px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider bg-surface-muted'>{title}</div>}
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
                ${isHighlighted ? 'bg-interactive-primary text-interactive-primary-foreground' : 'hover:bg-surface-muted text-text-primary'}
              `}
                        >
                            <CurrencyIcon
                                symbol={curr.symbol}
                                size={24}
                                className={isHighlighted ? 'text-interactive-primary-foreground' : 'text-text-muted'}
                            />
                            <span className={`text-sm ${isHighlighted ? 'text-interactive-primary-foreground' : 'text-text-primary'}`}>
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
                <label htmlFor={inputId} className='block text-sm font-medium leading-6 text-text-primary mb-2'>
                    {label}
                    {required && (
                        <span className='text-semantic-error ml-1' data-testid='required-indicator'>
                            {t('uiComponents.currencyAmountInput.requiredIndicator')}
                        </span>
                    )}
                </label>
            )}

            <div ref={triggerContainerRef} className='relative'>
                <div className='flex'>
                    {/* Currency selector button */}
                    <button
                        ref={currencyButtonRef}
                        type='button'
                        onClick={handleCurrencyClickWrapper}
                        disabled={disabled}
                        className={`
              flex shrink-0 items-center justify-center px-3
              border border-r-0 rounded-l-md
              transition-colors duration-200
              ${disabled ? 'bg-surface-muted text-text-muted/80 cursor-not-allowed' : 'bg-surface-muted hover:bg-surface-muted text-text-primary cursor-pointer'}
              ${error ? 'border-border-error' : 'border-border-default'}
            `}
                        aria-label={t('uiComponents.currencyAmountInput.selectCurrency')}
                        aria-expanded={isOpen}
                        aria-haspopup='listbox'
                    >
                        <div className='flex items-center gap-1'>
                            <CurrencyIcon
                                symbol={selectedCurrency?.symbol ?? currency ?? '?'}
                                size={20}
                                className={disabled ? 'text-text-muted/80' : 'text-text-primary'}
                            />
                            <span className={`text-xs font-medium uppercase tracking-wide ${disabled ? 'text-text-muted/80' : 'text-text-muted'}`}>
                                {selectedCurrency?.acronym ?? currency ?? ''}
                            </span>
                        </div>
<ChevronDownIcon size={16} className={`ml-1 text-text-muted/80 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
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
              flex-1 min-w-0 px-3 py-2
              border rounded-r-md
              focus:outline-none focus:ring-2 focus:ring-interactive-primary
              transition-colors duration-200
              placeholder:text-text-muted/70
              ${disabled ? 'bg-surface-muted text-text-muted cursor-not-allowed' : 'bg-surface-raised backdrop-blur-sm text-text-primary'}
              ${error ? 'border-border-error focus:ring-semantic-error' : 'border-border-default'}
            `}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                    />
                </div>

            </div>

            {/* Currency dropdown - rendered via portal to escape overflow:hidden containers */}
            {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    role='listbox'
                    className='fixed z-50 bg-surface-base shadow-lg max-h-80 rounded-md overflow-hidden ring-1 ring-black ring-opacity-5'
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                    }}
                >
                    {/* Search input */}
                    <div className='sticky top-0 bg-surface-base border-b border-border-default p-2'>
                        <input
                            ref={searchInputRef}
                            type='text'
                            value={searchTerm}
                            onInput={handleSearchChange}
                            onKeyDown={handleKeyDown}
                            placeholder={t('uiComponents.currencyAmountInput.searchPlaceholder')}
                            className='w-full px-3 py-1.5 text-sm border border-border-default rounded-md focus:outline-none focus:ring-1 focus:ring-interactive-primary bg-surface-base text-text-primary'
                            aria-label={t('uiComponents.currencyAmountInput.searchAriaLabel')}
                        />
                    </div>

                    {/* Currency list */}
                    <div className='overflow-auto max-h-64'>
                        {filteredCurrencies.length === 0
                            ? (
                                <div className='px-3 py-4 text-sm text-text-muted text-center' role='status'>
                                    {t('uiComponents.currencyAmountInput.noCurrencies')}
                                </div>
                            )
                            : (
                                <>
                                    {renderCurrencyGroup(
                                        groupedCurrencies.recent.length > 0
                                            ? t('uiComponents.currencyAmountInput.recent')
                                            : '',
                                        groupedCurrencies.recent,
                                        0,
                                    )}
                                    {renderCurrencyGroup(
                                        groupedCurrencies.common.length > 0
                                            ? t('uiComponents.currencyAmountInput.common')
                                            : '',
                                        groupedCurrencies.common,
                                        groupedCurrencies.recent.length,
                                    )}
                                    {renderCurrencyGroup(
                                        groupedCurrencies.others.length > 0
                                            ? t('uiComponents.currencyAmountInput.allCurrencies')
                                            : '',
                                        groupedCurrencies.others,
                                        groupedCurrencies.recent.length + groupedCurrencies.common.length,
                                    )}
                                </>
                            )}
                    </div>
                </div>,
                document.body,
            )}

            {error && (
                <p id={`${inputId}-error`} className='mt-2 text-sm text-semantic-error' role='alert' data-testid='currency-input-error-message'>
                    {error}
                </p>
            )}
        </div>
    );
}
