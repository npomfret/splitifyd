import { useDropdownSelector } from '@/app/hooks/useDropdownSelector';
import type { ExpenseLabel } from '@billsplit-wl/shared';
import { useCallback, useMemo, useRef } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface LabelSuggestionInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: ExpenseLabel[];
    className?: string;
    error?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
}

export function LabelSuggestionInput({ value, onChange, suggestions, className = '', error, label, placeholder, required = false }: LabelSuggestionInputProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useMemo(() => `label-input-${Math.random().toString(36).substr(2, 9)}`, []);

    const filterFn = useCallback(
        (suggestion: ExpenseLabel, searchTerm: string) => suggestion.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || suggestion.name.toLowerCase().includes(searchTerm.toLowerCase()),
        [],
    );

    const {
        isOpen,
        highlightedIndex,
        filteredItems: filteredSuggestions,
        dropdownRef,
        open,
        selectItem,
        handleKeyDown,
        setHighlightedIndex,
    } = useDropdownSelector({
        items: suggestions,
        onSelect: (suggestion) => {
            onChange(suggestion.name);
            inputRef.current?.focus();
        },
        filterFn,
        mode: 'combobox',
        externalSearchTerm: value,
    });

    const handleInputChange = useCallback(
        (e: Event) => {
            const target = e.target as HTMLInputElement;
            onChange(target.value);
        },
        [onChange],
    );

    const handleInputFocus = useCallback(() => {
        open();
    }, [open]);

    // Base styling similar to Input component
    const baseInputClasses = [
        'block',
        'w-full',
        'rounded-md',
        'border',
        'px-3',
        'py-2',
        'text-text-primary',
        'shadow-sm',
        'placeholder:text-text-muted/70',
        'focus:outline-none',
        'focus:ring-2',
        'sm:text-sm',
        'sm:leading-6',
        'transition-colors',
        'duration-200',
        'bg-surface-raised',
        'backdrop-blur-sm',
    ];

    const stateClasses = error
        ? 'border-border-error text-semantic-error focus:ring-semantic-error focus:border-semantic-error'
        : 'border-border-default focus:ring-interactive-primary focus:border-interactive-primary';

    const inputClasses = [...baseInputClasses, stateClasses, className].filter(Boolean).join(' ');

    return (
        <div className='relative'>
            {label && (
                <label htmlFor={inputId} className='block text-sm font-medium leading-6 text-text-primary mb-2'>
                    {label}
                    {required && (
                        <span className='text-semantic-error ml-1' data-testid='required-indicator'>
                            {t('uiComponents.labelSuggestionInput.requiredIndicator')}
                        </span>
                    )}
                </label>
            )}
            <div className='relative'>
                <input
                    ref={inputRef}
                    type='text'
                    id={inputId}
                    value={value}
                    onInput={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('uiComponents.labelSuggestionInput.placeholder')}
                    className={inputClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    aria-expanded={isOpen}
                    aria-haspopup='listbox'
                    role='combobox'
                    autoComplete='off'
                />

                {/* Suggestions dropdown */}
                {isOpen && filteredSuggestions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className='absolute z-10 mt-1 w-full bg-surface-base shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm'
                        role='listbox'
                    >
                        {filteredSuggestions.map((suggestion, index) => (
                            <div
                                key={suggestion.name}
                                onClick={() => selectItem(suggestion)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`cursor-pointer select-none relative py-2 pl-3 pr-9 flex items-center space-x-3 ${
                                    index === highlightedIndex ? 'bg-interactive-primary text-interactive-primary-foreground' : 'text-text-primary hover:bg-surface-muted'
                                }`}
                                role='option'
                                aria-selected={index === highlightedIndex}
                            >
                                <span className='text-lg'>{suggestion.icon}</span>
                                <span className='font-normal block truncate'>{suggestion.displayName}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {error && (
                <p id={`${inputId}-error`} className='mt-2 text-sm text-semantic-error' role='alert' data-testid='label-input-error-message'>
                    {error}
                </p>
            )}
        </div>
    );
}
