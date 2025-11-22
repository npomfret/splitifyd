import { signal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { FloatingInput } from '@/components/ui';

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
        <FloatingInput
            type='email'
            id='email-input'
            label={t('auth.emailInput.label')}
            value={value}
            onChange={(val) => {
                onInput(val);
                localError.value = validateEmail(val);
            }}
            onBlur={handleBlur}
            placeholder={placeholder || t('auth.emailInput.placeholder')}
            required={required}
            autoFocus={autoFocus}
            disabled={disabled}
            autoComplete='off'
            error={displayError ?? undefined}
        />
    );
}
