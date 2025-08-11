import { useCallback, useRef, useState, useEffect } from 'preact/hooks';
import type { ExpenseCategory } from '../../../../firebase/functions/src/shared/shared-types';

interface CategorySuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: ExpenseCategory[];
  className?: string;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function CategorySuggestionInput({
  value,
  onChange,
  suggestions,
  className = '',
  error,
  label,
  placeholder = 'Enter category...',
  required = false,
}: CategorySuggestionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<ExpenseCategory[]>(suggestions);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputId = `category-input-${Math.random().toString(36).substr(2, 9)}`;

  // Filter suggestions based on input value
  useEffect(() => {
    if (!value.trim()) {
      setFilteredSuggestions(suggestions);
    } else {
      const filtered = suggestions.filter(
        (suggestion) =>
          suggestion.displayName.toLowerCase().includes(value.toLowerCase()) ||
          suggestion.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    }
    setHighlightedIndex(-1);
  }, [value, suggestions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        inputRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: Event) => {
      const target = e.target as HTMLInputElement;
      onChange(target.value);
    },
    [onChange]
  );

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleSuggestionClick = useCallback(
    (suggestion: ExpenseCategory) => {
      onChange(suggestion.name);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
            handleSuggestionClick(filteredSuggestions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredSuggestions, highlightedIndex, handleSuggestionClick]
  );

  // Base styling similar to Input component
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
  ];

  const stateClasses = error
    ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 focus:ring-indigo-600 focus:border-indigo-600';

  const inputClasses = [...baseInputClasses, stateClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium leading-6 text-gray-900 mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={inputId}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />

        {/* Suggestions dropdown */}
        {isOpen && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
            role="listbox"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.name}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`cursor-pointer select-none relative py-2 pl-3 pr-9 flex items-center space-x-3 ${
                  index === highlightedIndex
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                <span className="text-lg">{suggestion.icon}</span>
                <span className="font-normal block truncate">
                  {suggestion.displayName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}