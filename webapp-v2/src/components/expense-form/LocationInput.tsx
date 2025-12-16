import { apiClient } from '@/app/apiClient';
import { useRotatingText } from '@/app/hooks/useRotatingText';
import { isMapsUrl, parseMapsUrl } from '@/app/utils/google-maps-parser';
import { ExpenseLocation } from '@billsplit-wl/shared';
import { ArrowPathIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui';

interface LocationInputProps {
    value: ExpenseLocation | null;
    onChange: (value: ExpenseLocation | null) => void;
    error?: string;
    recentLocations: string[];
}

export function LocationInput({ value, onChange, error, recentLocations }: LocationInputProps) {
    const { t } = useTranslation();
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Get rotating placeholder hints
    const placeholders = t('expenseBasicFields.locationPlaceholders', { returnObjects: true }) as string[];
    const placeholder = useRotatingText(placeholders, 4000);

    // Get the display value (name) from the location object
    const displayValue = value?.name ?? '';

    // Filter recent locations based on current input
    const filteredLocations = recentLocations.filter(
        (loc) => displayValue.trim() === '' || loc.toLowerCase().includes(displayValue.toLowerCase()),
    );

    // Resolve a shortened URL by following redirects server-side
    const resolveAndParseUrl = useCallback(
        async (url: string) => {
            setIsResolving(true);
            try {
                const response = await apiClient.resolveRedirect({ url });
                const placeName = parseMapsUrl(response.resolvedUrl);
                if (placeName) {
                    onChange({ name: placeName, url });
                } else {
                    onChange({ name: t('expenseBasicFields.mapLocation'), url });
                }
            } catch {
                onChange({ name: t('expenseBasicFields.mapLocation'), url });
            } finally {
                setIsResolving(false);
            }
        },
        [onChange, t],
    );

    // Handle paste events to detect map service URLs (Google, Apple, Waze, etc.)
    const handlePaste = useCallback(
        (e: ClipboardEvent) => {
            const pastedText = e.clipboardData?.getData('text');
            if (pastedText && isMapsUrl(pastedText)) {
                e.preventDefault();
                const placeName = parseMapsUrl(pastedText);
                if (placeName) {
                    onChange({ name: placeName, url: pastedText });
                } else {
                    resolveAndParseUrl(pastedText);
                }
            }
        },
        [onChange, resolveAndParseUrl],
    );

    // Handle input change - update just the name, clear URL if user is typing manually
    const handleInputChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const newName = target.value;
        if (newName.trim() === '') {
            onChange(null);
        } else {
            // When user types manually, we don't have a URL
            onChange({ name: newName });
        }
    };

    // Handle selecting a recent location (no URL for recent locations)
    const handleSelectLocation = (locationName: string) => {
        onChange({ name: locationName });
        setShowSuggestions(false);
        inputRef.current?.blur();
    };

    // Handle clear button
    const handleClear = () => {
        onChange(null);
        inputRef.current?.focus();
    };

    // Open Google Maps in new tab - if we have a URL, use it; otherwise just open maps.google.com
    const handleOpenMap = () => {
        const url = value?.url ?? 'https://maps.google.com';
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className='relative'>
            <label className='block text-sm font-medium text-text-primary mb-1'>
                {t('expenseBasicFields.locationLabel')}
            </label>
            <div className='relative flex gap-2'>
                <div className='relative flex-1'>
                    <input
                        ref={inputRef}
                        type='text'
                        value={isResolving ? t('expenseBasicFields.resolvingLocation') : displayValue}
                        onInput={handleInputChange}
                        onPaste={handlePaste}
                        onFocus={() => setShowSuggestions(true)}
                        disabled={isResolving}
                        className={`w-full px-3 py-2 pr-8 border rounded-lg bg-surface-raised backdrop-blur-xs text-text-primary placeholder:text-text-muted/70 focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-colors duration-200 ${
                            error ? 'border-semantic-error' : 'border-border-default'
                        } ${isResolving ? 'text-text-muted' : ''}`}
                        placeholder={placeholder}
                        autoComplete='off'
                    />
                    {isResolving ? (
                        <ArrowPathIcon className='absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted animate-spin' aria-hidden='true' />
                    ) : displayValue ? (
                        <button
                            type='button'
                            onClick={handleClear}
                            className='absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-muted transition-colors'
                            aria-label={t('expenseBasicFields.clearLocation')}
                        >
                            <XMarkIcon className='h-4 w-4 text-text-muted hover:text-text-primary' aria-hidden='true' />
                        </button>
                    ) : null}
                </div>
                <Tooltip content={value?.url ? t('expenseBasicFields.openOnMap') : t('expenseBasicFields.findOnMap')}>
                    <button
                        type='button'
                        onClick={handleOpenMap}
                        className='p-2 border border-border-default rounded-lg hover:bg-surface-muted transition-colors shrink-0'
                        aria-label={value?.url ? t('expenseBasicFields.openOnMap') : t('expenseBasicFields.findOnMap')}
                    >
                        <MapPinIcon className='h-5 w-5 text-text-muted hover:text-text-primary' aria-hidden='true' />
                    </button>
                </Tooltip>
            </div>
            {error && (
                <p className='text-sm text-semantic-error mt-1' role='alert'>
                    {error}
                </p>
            )}

            {/* Recent locations dropdown */}
            {showSuggestions && filteredLocations.length > 0 && (
                <div className='absolute z-10 w-full mt-1 bg-surface-raised border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto'>
                    <p className='px-3 py-1.5 text-xs text-text-muted border-b border-border-default'>
                        {t('expenseBasicFields.recentLocations')}
                    </p>
                    {filteredLocations.map((location, index) => (
                        <button
                            key={index}
                            type='button'
                            onClick={() => handleSelectLocation(location)}
                            className='w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted transition-colors'
                        >
                            {location}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
