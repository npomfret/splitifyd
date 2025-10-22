import { signal } from '@preact/signals';
import { useTranslation } from 'react-i18next';

interface EmailInputProps {
    value: string;
    onInput: (value: string) => void;
    error?: string | null;
    placeholder?: string;
    required?: boolean;
    autoFocus?: boolean;
    disabled?: boolean;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailInput({ value, onInput, error, placeholder, required = true, autoFocus = false, disabled = false }: EmailInputProps) {
    const { t } = useTranslation();
    const localError = signal<string | null>(null);

    const validateEmail = (email: string) => {
        if (!email && required) {
            return t('auth.emailInput.validation.required');
        }
        if (email && !emailRegex.test(email)) {
            return t('auth.emailInput.validation.invalid');
        }
        return null;
    };

    const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const newValue = target.value;
        onInput(newValue);
        localError.value = validateEmail(newValue);
    };

    const handleBlur = () => {
        localError.value = validateEmail(value);
    };

    const displayError = error || localError.value;
    const hasError = !!displayError;

    return (
        <div class='space-y-1'>
            <label for='email-input' class='block text-sm font-medium text-gray-700'>
                {t('auth.emailInput.label')} {required && (
                    <span class='text-red-500' data-testid='required-indicator'>
                        {t('auth.emailInput.requiredIndicator')}
                    </span>
                )}
            </label>
            <input
                id='email-input'
                type='email'
                value={value}
                onInput={handleInput}
                onBlur={handleBlur}
                placeholder={placeholder || t('auth.emailInput.placeholder')}
                required={required}
                autoFocus={autoFocus}
                disabled={disabled}
                autocomplete='off'
                aria-label={t('auth.emailInput.label')}
                aria-required={required}
                aria-invalid={hasError}
                aria-describedby={hasError ? 'email-error' : undefined}
                class={`
          block w-full px-3 py-2 border rounded-md shadow-sm 
          placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${hasError ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
        `}
            />
            {displayError && (
                <p id='email-error' class='text-sm text-red-600' role='alert'>
                    {displayError}
                </p>
            )}
        </div>
    );
}
