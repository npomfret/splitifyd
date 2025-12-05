import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';
import { cx } from '@/utils/cx.ts';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui';

interface FloatingPasswordInputProps {
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

export function FloatingPasswordInput({
    value,
    onInput,
    error,
    placeholder,
    label,
    required = true,
    disabled = false,
    showStrength = false,
    autoComplete = 'off',
    id = 'password-input',
}: FloatingPasswordInputProps) {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const localError = signal<string | null>(null);

    const hasValue = value && value.length > 0;
    const isLabelFloating = isFocused || hasValue;

    const calculatePasswordStrength = (password: string): PasswordStrength => {
        if (password.length < 12) return 'weak';

        let score = 0;
        if (password.length >= 16) score++;
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
        if (password && password.length < 12) {
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

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
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
                return 'bg-semantic-error';
            case 'medium':
                return 'bg-semantic-warning';
            case 'strong':
                return 'bg-semantic-success';
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

    const inputClasses = cx(
        'block w-full rounded-md border border-border-default bg-surface-raised backdrop-blur-sm px-3 pt-6 pb-2 pr-10 shadow-sm',
        'text-text-primary placeholder:text-transparent transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-easing-standard)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary focus-visible:border-interactive-primary',
        disabled && 'opacity-60 cursor-not-allowed bg-surface-muted text-text-muted',
        hasError && 'border-border-error text-semantic-error focus-visible:ring-semantic-error focus-visible:border-semantic-error',
    );

    const baseLabelClasses = [
        'absolute left-3 text-text-secondary pointer-events-none',
        'transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-easing-standard)]',
        'origin-left',
    ];

    const labelPositionClasses = isLabelFloating ? 'top-1.5 text-xs font-medium' : 'top-1/2 -translate-y-1/2 text-sm';

    const labelFocusClasses = isFocused && !hasError ? 'text-interactive-primary' : '';
    const labelErrorClasses = hasError ? 'text-semantic-error' : '';

    const labelClasses = cx(...baseLabelClasses, labelPositionClasses, labelFocusClasses, labelErrorClasses);

    return (
        <div class='space-y-1'>
            <div class='relative'>
                <input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    onInput={handleInput}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder || label || t('auth.passwordInput.placeholder')}
                    required={required}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    aria-label={label || t('auth.passwordInput.label')}
                    aria-required={required}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? `${id}-error` : undefined}
                    class={inputClasses}
                />
                <label for={id} class={labelClasses}>
                    {label || t('auth.passwordInput.label')} {required && (
                        <span data-testid='required-indicator'>
                            *
                        </span>
                    )}
                </label>
                <button
                    type='button'
                    onClick={togglePasswordVisibility}
                    disabled={disabled}
                    aria-label={showPassword ? t('auth.passwordInput.hidePassword') : t('auth.passwordInput.showPassword')}
                    class='absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary disabled:opacity-50 z-10'
                >
                    <Tooltip content={showPassword ? t('auth.passwordInput.hidePassword') : t('auth.passwordInput.showPassword')}>
                        {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                    </Tooltip>
                </button>
            </div>

            {showStrength && value && strength && (
                <div class='space-y-2'>
                    <div class='flex items-center justify-between'>
                        <span class='text-xs text-text-muted'>{t('auth.passwordInput.strength')}</span>
                        <span
                            class={`text-xs font-medium ${strength === 'weak' ? 'text-semantic-error' : strength === 'medium' ? 'text-semantic-warning' : 'text-semantic-success'}`}
                            data-testid={`password-strength-${strength}`}
                        >
                            {getStrengthText(strength)}
                        </span>
                    </div>
                    <div class='w-full bg-border-default/60 rounded-full h-2'>
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
                <p id={`${id}-error`} class='text-sm text-semantic-error' role='alert'>
                    {displayError}
                </p>
            )}
        </div>
    );
}
