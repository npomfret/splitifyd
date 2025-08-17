import { signal } from '@preact/signals';

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

export function EmailInput({ value, onInput, error, placeholder = 'Enter your email', required = true, autoFocus = false, disabled = false }: EmailInputProps) {
    const localError = signal<string | null>(null);

    const validateEmail = (email: string) => {
        if (!email && required) {
            return 'Email is required';
        }
        if (email && !emailRegex.test(email)) {
            return 'Please enter a valid email address';
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
        <div class="space-y-1">
            <label for="email-input" class="block text-sm font-medium text-gray-700">
                Email address {required && <span class="text-red-500">*</span>}
            </label>
            <input
                id="email-input"
                type="email"
                value={value}
                onInput={handleInput}
                onBlur={handleBlur}
                placeholder={placeholder}
                required={required}
                autoFocus={autoFocus}
                disabled={disabled}
                autocomplete="email"
                aria-label="Email address"
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
                <p id="email-error" class="text-sm text-red-600" role="alert">
                    {displayError}
                </p>
            )}
        </div>
    );
}
