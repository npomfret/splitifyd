import { convertTo12HourDisplay, filterTimeSuggestions, formatTime12, formatTime24, generateTimeSuggestions, parseTimeString } from '@/utils/timeParser.ts';
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { FieldError } from './FieldError';

interface TimeInputProps {
    value: string; // "14:30" format (24-hour)
    onChange: (time: string) => void;
    label?: string;
    required?: boolean;
    error?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
}

export function TimeInput({ value, onChange, label, required = false, error, disabled = false, className = '', id }: TimeInputProps) {
    const { t } = useTranslation();
    const inputId = id || `time-input-${Math.random().toString(36).substr(2, 9)}`;
    const isEditing = useSignal(false);
    const inputValue = useSignal(convertTo12HourDisplay(value));
    const showSuggestions = useSignal(false);
    const suggestions = useSignal<string[]>([]);
    const selectedIndex = useSignal(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate all time suggestions once
    const allSuggestions = generateTimeSuggestions();

    // Update input value when prop changes
    useEffect(() => {
        if (!isEditing.value) {
            inputValue.value = convertTo12HourDisplay(value);
        }
    }, [value]);

    // Handle click on label to start editing
    const handleLabelClick = () => {
        if (disabled) return;
        isEditing.value = true;
        showSuggestions.value = true;
        suggestions.value = filterTimeSuggestions(inputValue.value, allSuggestions);
        // Focus input after render
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Handle input change
    const handleInputChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        inputValue.value = target.value;
        suggestions.value = filterTimeSuggestions(target.value, allSuggestions);
        showSuggestions.value = true;
        selectedIndex.value = -1;
    };

    // Handle blur - validate and save
    const handleBlur = (e: FocusEvent) => {
        // Don't blur if clicking on suggestions
        if (containerRef.current?.contains(e.relatedTarget as Node)) {
            return;
        }

        const parsed = parseTimeString(inputValue.value);
        if (parsed) {
            const time24 = formatTime24(parsed);
            onChange(time24);
            inputValue.value = formatTime12(parsed);
        } else {
            // Invalid input - revert to previous value
            inputValue.value = convertTo12HourDisplay(value);
        }

        isEditing.value = false;
        showSuggestions.value = false;
    };

    // Handle suggestion click
    const handleSuggestionClick = (suggestion: string) => {
        inputValue.value = suggestion;
        const parsed = parseTimeString(suggestion);
        if (parsed) {
            onChange(formatTime24(parsed));
        }
        isEditing.value = false;
        showSuggestions.value = false;
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!showSuggestions.value || suggestions.value.length === 0) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleBlur(e as any);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex.value >= 0) {
                    handleSuggestionClick(suggestions.value[selectedIndex.value]);
                } else {
                    handleBlur(e as any);
                }
                break;
            case 'Escape':
                e.preventDefault();
                showSuggestions.value = false;
                selectedIndex.value = -1;
                break;
        }
    };

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                if (isEditing.value) {
                    handleBlur(new FocusEvent('blur-sm'));
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className='block text-sm font-medium text-text-primary mb-1'>
                    {label} {required && (
                        <span className='text-semantic-error' data-testid='required-indicator'>
                            {t('uiComponents.timeInput.requiredIndicator')}
                        </span>
                    )}
                </label>
            )}

            {!isEditing.value
                ? (
                    // Display mode - clickable label
                    <button
                        type='button'
                        onClick={handleLabelClick}
                        disabled={disabled}
                        className={`text-start px-3 py-2 border rounded-lg w-full bg-surface-raised backdrop-blur-xs text-text-primary transition-colors ${
                            disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-surface-muted'
                        } ${error ? 'border-semantic-error' : 'border-border-default'}`}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                    >
                        {t('uiComponents.timeInput.at')}
                        {inputValue.value}
                    </button>
                )
                : (
                    // Edit mode - input field
                    <input
                        ref={inputRef}
                        id={inputId}
                        type='text'
                        value={inputValue.value}
                        onInput={handleInputChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={t('uiComponents.timeInput.placeholder')}
                        autoComplete='off'
                        disabled={disabled}
                        className={`w-full px-3 py-2 border rounded-lg bg-surface-raised backdrop-blur-xs text-text-primary placeholder:text-text-muted/70 focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-colors duration-200 ${
                            disabled ? 'opacity-60 cursor-not-allowed' : ''
                        } ${error ? 'border-semantic-error' : 'border-border-default'}`}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                    />
                )}

            {/* Suggestions dropdown */}
            {isEditing.value && showSuggestions.value && suggestions.value.length > 0 && (
                <div className='absolute z-10 w-full mt-1 bg-surface-base border border-border-default rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                    {suggestions.value.map((suggestion, index) => (
                        <button
                            key={suggestion}
                            type='button'
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                handleSuggestionClick(suggestion);
                            }}
                            className={`w-full text-start px-3 py-2 text-text-primary hover:bg-surface-muted ${index === selectedIndex.value ? 'bg-surface-muted' : ''}`}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <FieldError id={`${inputId}-error`} dataTestId='time-input-error-message'>
                    {error}
                </FieldError>
            )}
        </div>
    );
}
