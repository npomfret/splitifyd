import { JSX } from 'preact';

interface AdminFormInputProps {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    type?: 'text' | 'number' | 'email' | 'url';
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    monospace?: boolean;
    id?: string;
    testId?: string;
}

export function AdminFormInput({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    disabled,
    required,
    monospace,
    id,
    testId,
}: AdminFormInputProps) {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
        onChange((e.target as HTMLInputElement).value);
    };

    return (
        <div>
            <label for={inputId} class='block text-xs font-medium text-text-secondary mb-1'>
                {label}
                {required && ' *'}
            </label>
            <input
                id={inputId}
                type={type}
                value={value}
                onInput={handleInput}
                placeholder={placeholder}
                disabled={disabled}
                class={`w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm ${monospace ? 'font-mono' : ''}`}
                data-testid={testId}
            />
        </div>
    );
}
