import { CurrencyService } from '@/app/services/currencyService';
import { cx } from '@/utils/cx.ts';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Alert, Select, Switch } from '../../ui';
import { CurrencyIcon, XIcon } from '../../ui/icons';

interface GroupCurrencySettingsProps {
    enabled: boolean;
    permittedCurrencies: string[];
    defaultCurrency: string;
    onToggle: (enabled: boolean) => void;
    onAddCurrency: (code: string) => void;
    onRemoveCurrency: (code: string) => void;
    onSetDefault: (code: string) => void;
    validationError: string | null;
    disabled?: boolean;
}

export function GroupCurrencySettings({
    enabled,
    permittedCurrencies,
    defaultCurrency,
    onToggle,
    onAddCurrency,
    onRemoveCurrency,
    onSetDefault,
    validationError,
    disabled = false,
}: GroupCurrencySettingsProps) {
    const { t } = useTranslation();
    const currencyService = CurrencyService.getInstance();
    const allCurrencies = currencyService.getCurrencies();

    const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Get currency details for display
    const getCurrencyLabel = useCallback(
        (code: string) => {
            const currency = currencyService.getCurrencyByCode(code);
            return currency ? `${currency.acronym} - ${currency.name}` : code;
        },
        [currencyService],
    );

    // Filter available currencies (not already selected)
    const availableCurrencies = useMemo(() => {
        const filtered = allCurrencies.filter((c) => !permittedCurrencies.includes(c.acronym));
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return filtered.filter(
                (c) =>
                    c.acronym.toLowerCase().includes(searchLower)
                    || c.name.toLowerCase().includes(searchLower)
                    || c.symbol.toLowerCase().includes(searchLower),
            );
        }
        return filtered;
    }, [allCurrencies, permittedCurrencies, searchTerm]);

    // Options for default currency dropdown (only permitted currencies)
    const defaultCurrencyOptions = useMemo(
        () =>
            permittedCurrencies.map((code) => ({
                value: code,
                label: getCurrencyLabel(code),
            })),
        [permittedCurrencies, getCurrencyLabel],
    );

    const handleAddCurrency = useCallback(
        (code: string) => {
            onAddCurrency(code);
            setIsAddDropdownOpen(false);
            setSearchTerm('');
        },
        [onAddCurrency],
    );

    const handleOpenDropdown = useCallback(() => {
        setIsAddDropdownOpen(true);
        // Focus search input after dropdown opens
        setTimeout(() => searchInputRef.current?.focus(), 0);
    }, []);

    // Close dropdown when clicking outside
    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
            setIsAddDropdownOpen(false);
            setSearchTerm('');
        }
    }, []);

    // Add/remove click outside listener
    useState(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    });

    return (
        <div className='space-y-4'>
            <div className='border-t border-border-default pt-6'>
                <h3 className='text-base font-medium text-text-primary mb-2'>
                    {t('groupSettings.currencySettings.title')}
                </h3>
                <p className='help-text mb-4'>{t('groupSettings.currencySettings.description')}</p>

                <Switch
                    label={t('groupSettings.currencySettings.enableToggle')}
                    description={enabled ? t('groupSettings.currencySettings.enabledDescription') : undefined}
                    checked={enabled}
                    onChange={onToggle}
                    disabled={disabled}
                />
            </div>

            {enabled && (
                <div className='space-y-4 pl-4 border-l-2 border-interactive-primary/30'>
                    {/* Permitted currencies */}
                    <div>
                        <label className='block text-sm font-medium text-text-primary mb-2'>
                            {t('groupSettings.currencySettings.permittedLabel')}
                        </label>

                        {/* Selected currencies as chips */}
                        <div className='flex flex-wrap gap-2 mb-2'>
                            {permittedCurrencies.map((code) => {
                                const currency = currencyService.getCurrencyByCode(code);
                                return (
                                    <span
                                        key={code}
                                        className={cx(
                                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm',
                                            'bg-surface-muted text-text-primary border border-border-default',
                                        )}
                                    >
                                        {currency && <CurrencyIcon symbol={currency.symbol} size={16} className='text-text-muted' />}
                                        <span className='font-medium'>{code}</span>
                                        <button
                                            type='button'
                                            onClick={() => onRemoveCurrency(code)}
                                            disabled={disabled || permittedCurrencies.length <= 1}
                                            className={cx(
                                                'ml-1 p-0.5 rounded hover:bg-surface-raised transition-colors',
                                                permittedCurrencies.length <= 1
                                                    ? 'opacity-30 cursor-not-allowed'
                                                    : 'hover:text-semantic-error',
                                            )}
                                            aria-label={`Remove ${code}`}
                                            data-testid={`remove-currency-${code}`}
                                        >
                                            <XIcon size={14} />
                                        </button>
                                    </span>
                                );
                            })}

                            {/* Add currency button/dropdown */}
                            <div className='relative' ref={dropdownRef}>
                                <button
                                    type='button'
                                    onClick={handleOpenDropdown}
                                    disabled={disabled}
                                    className={cx(
                                        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm',
                                        'border border-dashed border-border-default text-text-muted',
                                        'hover:border-interactive-primary hover:text-interactive-primary transition-colors',
                                        disabled && 'opacity-50 cursor-not-allowed',
                                    )}
                                >
                                    + {t('groupSettings.currencySettings.addCurrency')}
                                </button>

                                {isAddDropdownOpen && (
                                    <div
                                        className={cx(
                                            'absolute z-50 top-full left-0 mt-1 w-64',
                                            'bg-surface-raised border border-border-default rounded-md shadow-lg',
                                            'max-h-60 overflow-hidden',
                                        )}
                                    >
                                        <div className='p-2 border-b border-border-default'>
                                            <input
                                                ref={searchInputRef}
                                                type='text'
                                                value={searchTerm}
                                                onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                                                placeholder={t('groupSettings.currencySettings.searchPlaceholder')}
                                                className={cx(
                                                    'w-full px-2 py-1 text-sm rounded border border-border-default',
                                                    'bg-surface-base text-text-primary placeholder:text-text-muted',
                                                    'focus:outline-hidden focus:ring-1 focus:ring-interactive-primary',
                                                )}
                                            />
                                        </div>
                                        <div className='max-h-48 overflow-y-auto'>
                                            {availableCurrencies.length === 0
                                                ? (
                                                    <div className='p-2 help-text text-center'>
                                                        {searchTerm
                                                            ? t('currencySelector.noResults')
                                                            : t('groupSettings.currencySettings.allCurrenciesSelected')}
                                                    </div>
                                                )
                                                : (
                                                    availableCurrencies.slice(0, 50).map((currency) => (
                                                        <button
                                                            key={currency.acronym}
                                                            type='button'
                                                            onClick={() => handleAddCurrency(currency.acronym)}
                                                            className={cx(
                                                                'w-full px-3 py-2 text-left text-sm',
                                                                'hover:bg-surface-muted transition-colors',
                                                                'flex items-center gap-2',
                                                            )}
                                                            data-testid={`add-currency-option-${currency.acronym}`}
                                                        >
                                                            <CurrencyIcon symbol={currency.symbol} size={20} className='text-text-muted shrink-0' />
                                                            <span className='font-medium'>{currency.acronym}</span>
                                                            <span className='text-text-muted truncate'>{currency.name}</span>
                                                        </button>
                                                    ))
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Default currency dropdown */}
                    <Select
                        label={t('groupSettings.currencySettings.defaultLabel')}
                        value={defaultCurrency}
                        onChange={onSetDefault}
                        options={defaultCurrencyOptions}
                        disabled={disabled || permittedCurrencies.length === 0}
                        dataTestId='default-currency-select'
                    />

                    {validationError && <Alert type='error' message={validationError} dataTestId='currency-settings-error' />}
                </div>
            )}
        </div>
    );
}
