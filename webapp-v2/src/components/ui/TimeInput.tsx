import { useSignal } from '@preact/signals';
import { useRef, useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { parseTimeString, formatTime24, formatTime12, generateTimeSuggestions, filterTimeSuggestions, convertTo12HourDisplay } from '@/utils/timeParser.ts';

interface TimeInputProps {
    value: string; // "14:30" format (24-hour)
    onChange: (time: string) => void;
    label?: string;
    required?: boolean;
    error?: string;
    className?: string;
}

export function TimeInput({ value, onChange, label, required = false, error, className = '' }: TimeInputProps) {
    const { t } = useTranslation();
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
                    handleBlur(new FocusEvent('blur'));
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {label}{' '}
                    {required && (
                        <span className="text-red-500" data-testid="required-indicator">
                            {t('uiComponents.timeInput.requiredIndicator')}
                        </span>
                    )}
                </label>
            )}

            {!isEditing.value ? (
                // Display mode - clickable label
                <button
                    type="button"
                    onClick={handleLabelClick}
                    className={`text-left px-3 py-2 border rounded-lg w-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } dark:bg-gray-700 dark:text-white`}
                >
                    {t('uiComponents.timeInput.at')}{inputValue.value}
                </button>
            ) : (
                // Edit mode - input field
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue.value}
                    onInput={handleInputChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={t('uiComponents.timeInput.placeholder')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                        error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                />
            )}

            {/* Suggestions dropdown */}
            {isEditing.value && showSuggestions.value && suggestions.value.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.value.map((suggestion, index) => (
                        <button
                            key={suggestion}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                handleSuggestionClick(suggestion);
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${index === selectedIndex.value ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1" role="alert" data-testid="time-input-error-message">
                    {error}
                </p>
            )}
        </div>
    );
}
