import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface PasswordInputProps {
    value: string;
    onInput: (value: string) => void;
    error?: string | null;
    placeholder?: string;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    showStrength?: boolean;
    autoComplete?: string;
    id?: string;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

export function PasswordInput({
    value,
    onInput,
    error,
    placeholder,
    label,
    required = true,
    disabled = false,
    showStrength = false,
    autoComplete = 'current-password',
    id = 'password-input',
}: PasswordInputProps) {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState(false);
    const localError = signal<string | null>(null);

    const calculatePasswordStrength = (password: string): PasswordStrength => {
        if (password.length < 6) return 'weak';

        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score >= 4) return 'strong';
        if (score >= 2) return 'medium';
        return 'weak';
    };

    const validatePassword = (password: string) => {
        if (!password && required) {
            return t('auth.passwordInput.validation.required');
        }
        if (password && password.length < 6) {
            return t('auth.passwordInput.validation.tooShort');
        }
        return null;
    };

    const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const newValue = target.value;
        onInput(newValue);
        localError.value = validatePassword(newValue);
    };

    const handleBlur = () => {
        localError.value = validatePassword(value);
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const strength = showStrength ? calculatePasswordStrength(value) : null;
    const displayError = error || localError.value;
    const hasError = !!displayError;

    const getStrengthColor = (strength: PasswordStrength) => {
        switch (strength) {
            case 'weak':
                return 'bg-red-500';
            case 'medium':
                return 'bg-yellow-500';
            case 'strong':
                return 'bg-green-500';
        }
    };

    const getStrengthText = (strength: PasswordStrength) => {
        switch (strength) {
            case 'weak':
                return t('auth.passwordInput.strengthWeak');
            case 'medium':
                return t('auth.passwordInput.strengthMedium');
            case 'strong':
                return t('auth.passwordInput.strengthStrong');
        }
    };

    return (
        <div class="space-y-1">
            <label for={id} class="block text-sm font-medium text-gray-700">
                {label || t('auth.passwordInput.label')}{' '}
                {required && (
                    <span class="text-red-500" data-testid="required-indicator">
                        {t('auth.passwordInput.requiredIndicator')}
                    </span>
                )}
            </label>
            <div class="relative">
                <input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    onInput={handleInput}
                    onBlur={handleBlur}
                    placeholder={placeholder || t('auth.passwordInput.placeholder')}
                    required={required}
                    disabled={disabled}
                    autocomplete={autoComplete}
                    aria-label={label || t('auth.passwordInput.label')}
                    aria-required={required}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? `${id}-error` : undefined}
                    class={`
            block w-full px-3 py-2 pr-10 border rounded-md shadow-sm 
            placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${hasError ? 'border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
          `}
                />
                <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={disabled}
                    aria-label={showPassword ? t('auth.passwordInput.hidePassword') : t('auth.passwordInput.showPassword')}
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                    {showPassword ? (
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                            />
                        </svg>
                    ) : (
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                        </svg>
                    )}
                </button>
            </div>

            {showStrength && value && strength && (
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-600">{t('auth.passwordInput.strength')}</span>
                        <span
                            class={`text-xs font-medium ${strength === 'weak' ? 'text-red-600' : strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}
                            data-testid={`password-strength-${strength}`}
                        >
                            {getStrengthText(strength)}
                        </span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div
                            class={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(strength)}`}
                            style={{
                                width: strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%',
                            }}
                        />
                    </div>
                </div>
            )}

            {displayError && (
                <p id={`${id}-error`} class="text-sm text-red-600" role="alert">
                    {displayError}
                </p>
            )}
        </div>
    );
}
