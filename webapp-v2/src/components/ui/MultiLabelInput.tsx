import { useDropdownSelector } from '@/app/hooks/useDropdownSelector';
import type { ExpenseLabel, ISOString } from '@billsplit-wl/shared';
import { toExpenseLabel } from '@billsplit-wl/shared';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface MultiLabelInputProps {
    values: ExpenseLabel[];
    onChange: (values: ExpenseLabel[]) => void;
    recentlyUsedLabels?: Record<ExpenseLabel, ISOString>;
    suggestedLabels?: string[];
    maxLabels?: number;
    className?: string;
    error?: string;
    label?: string;
    placeholder?: string;
}

interface LabelSuggestion {
    label: ExpenseLabel;
    isRecent: boolean;
}

export function MultiLabelInput({
    values,
    onChange,
    recentlyUsedLabels,
    suggestedLabels = [],
    maxLabels = 3,
    className = '',
    error,
    label,
    placeholder,
}: MultiLabelInputProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useMemo(() => `multi-label-input-${Math.random().toString(36).substr(2, 9)}`, []);
    const [inputValue, setInputValue] = useState('');

    // Build suggestions list: recent labels first (sorted by recency), then suggested labels
    const allSuggestions = useMemo((): LabelSuggestion[] => {
        const suggestions: LabelSuggestion[] = [];
        const addedLabels = new Set<string>();

        // Add recent labels (sorted by timestamp, most recent first)
        if (recentlyUsedLabels) {
            const recentEntries = Object.entries(recentlyUsedLabels) as [ExpenseLabel, ISOString][];
            recentEntries.sort((a, b) => b[1].localeCompare(a[1]));
            for (const [labelVal] of recentEntries) {
                if (!values.includes(labelVal) && !addedLabels.has(labelVal)) {
                    suggestions.push({ label: labelVal, isRecent: true });
                    addedLabels.add(labelVal);
                }
            }
        }

        // Add suggested labels that aren't already selected or in recent
        for (const suggestedLabel of suggestedLabels) {
            const expenseLabel = toExpenseLabel(suggestedLabel);
            if (!values.includes(expenseLabel) && !addedLabels.has(expenseLabel)) {
                suggestions.push({ label: expenseLabel, isRecent: false });
                addedLabels.add(expenseLabel);
            }
        }

        return suggestions;
    }, [recentlyUsedLabels, suggestedLabels, values]);

    const filterFn = useCallback((suggestion: LabelSuggestion, searchTerm: string) => suggestion.label.toLowerCase().includes(searchTerm.toLowerCase()), []);

    const {
        isOpen,
        highlightedIndex,
        filteredItems: filteredSuggestions,
        dropdownRef,
        open,
        close,
        selectItem,
        handleKeyDown: baseHandleKeyDown,
        setHighlightedIndex,
    } = useDropdownSelector({
        items: allSuggestions,
        onSelect: (suggestion) => {
            if (values.length < maxLabels) {
                onChange([...values, suggestion.label]);
                setInputValue('');
            }
            inputRef.current?.focus();
        },
        filterFn,
        mode: 'combobox',
        externalSearchTerm: inputValue,
    });

    const handleInputChange = useCallback((e: Event) => {
        const target = e.target as HTMLInputElement;
        setInputValue(target.value);
    }, []);

    const handleInputFocus = useCallback(() => {
        open();
    }, [open]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // Handle Enter to add custom label
            if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault();
                const trimmedValue = inputValue.trim();
                if (trimmedValue.length > 0 && trimmedValue.length <= 50 && values.length < maxLabels) {
                    const newLabel = toExpenseLabel(trimmedValue);
                    if (!values.includes(newLabel)) {
                        onChange([...values, newLabel]);
                        setInputValue('');
                        close();
                    }
                }
                return;
            }

            // Handle Backspace to remove last label when input is empty
            if (e.key === 'Backspace' && !inputValue && values.length > 0) {
                e.preventDefault();
                onChange(values.slice(0, -1));
                return;
            }

            // Delegate to dropdown handler for arrow navigation
            baseHandleKeyDown(e);
        },
        [inputValue, values, maxLabels, onChange, close, baseHandleKeyDown],
    );

    const removeLabel = useCallback(
        (labelToRemove: ExpenseLabel) => {
            onChange(values.filter((l) => l !== labelToRemove));
            inputRef.current?.focus();
        },
        [values, onChange],
    );

    const canAddMore = values.length < maxLabels;

    // Base styling similar to Input component
    const baseContainerClasses = [
        'flex',
        'flex-wrap',
        'items-center',
        'gap-1.5',
        'w-full',
        'rounded-md',
        'border',
        'px-2',
        'py-1.5',
        'min-h-[42px]',
        'text-text-primary',
        'shadow-sm',
        'focus-within:ring-2',
        'sm:text-sm',
        'transition-colors',
        'duration-200',
        'bg-surface-raised',
        'backdrop-blur-xs',
    ];

    const stateClasses = error
        ? 'border-border-error focus-within:ring-semantic-error focus-within:border-semantic-error'
        : 'border-border-default focus-within:ring-interactive-primary focus-within:border-interactive-primary';

    const containerClasses = [...baseContainerClasses, stateClasses, className].filter(Boolean).join(' ');

    return (
        <div className='relative'>
            {label && (
                <label htmlFor={inputId} className='block text-sm font-medium leading-6 text-text-primary mb-2'>
                    {label}
                </label>
            )}
            <div className={containerClasses} onClick={() => inputRef.current?.focus()}>
                {/* Selected labels as chips */}
                {values.map((labelVal) => (
                    <span
                        key={labelVal}
                        className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-interactive-primary/10 text-interactive-primary border border-interactive-primary/20'
                    >
                        {labelVal}
                        <button
                            type='button'
                            onClick={(e) => {
                                e.stopPropagation();
                                removeLabel(labelVal);
                            }}
                            className='hover:bg-interactive-primary/20 rounded-full p-0.5 transition-colors'
                            aria-label={t('uiComponents.multiLabelInput.removeLabel', { label: labelVal })}
                        >
                            <XMarkIcon className='h-3 w-3' aria-hidden='true' />
                        </button>
                    </span>
                ))}

                {/* Input for adding new labels */}
                {canAddMore && (
                    <input
                        ref={inputRef}
                        type='text'
                        id={inputId}
                        value={inputValue}
                        onInput={handleInputChange}
                        onFocus={handleInputFocus}
                        onKeyDown={handleKeyDown}
                        placeholder={values.length === 0 ? (placeholder || t('uiComponents.multiLabelInput.placeholder')) : ''}
                        className='flex-1 min-w-[80px] bg-transparent border-none outline-none focus:ring-0 p-0.5 text-sm placeholder:text-text-muted/70'
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                        aria-expanded={isOpen}
                        aria-haspopup='listbox'
                        role='combobox'
                        autoComplete='off'
                    />
                )}

                {/* Show max reached indicator */}
                {!canAddMore && <span className='text-xs text-text-muted italic'>{t('uiComponents.multiLabelInput.maxReached', { max: maxLabels })}</span>}
            </div>

            {/* Suggestions dropdown */}
            {isOpen && filteredSuggestions.length > 0 && canAddMore && (
                <div
                    ref={dropdownRef}
                    className='absolute z-10 mt-1 w-full bg-surface-base shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-hidden sm:text-sm'
                    role='listbox'
                >
                    {filteredSuggestions.map((suggestion, index) => (
                        <div
                            key={suggestion.label}
                            onClick={() => selectItem(suggestion)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`cursor-pointer select-none relative py-2 pl-3 pr-9 flex items-center justify-between ${
                                index === highlightedIndex ? 'bg-interactive-primary text-interactive-primary-foreground' : 'text-text-primary hover:bg-surface-muted'
                            }`}
                            role='option'
                            aria-selected={index === highlightedIndex}
                        >
                            <span className='font-normal block truncate'>{suggestion.label}</span>
                            {suggestion.isRecent && (
                                <span className={`text-xs ${index === highlightedIndex ? 'text-interactive-primary-foreground/70' : 'text-text-muted'}`}>
                                    {t('uiComponents.multiLabelInput.recent')}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <p id={`${inputId}-error`} className='mt-2 text-sm text-semantic-error' role='alert' data-testid='label-input-error-message'>
                    {error}
                </p>
            )}

            {/* Helper text */}
            <p className='mt-1 text-xs text-text-muted'>
                {t('uiComponents.multiLabelInput.hint', { count: values.length, max: maxLabels })}
            </p>
        </div>
    );
}
