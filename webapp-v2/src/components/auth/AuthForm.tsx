import { ComponentChildren } from 'preact';
import { ErrorMessage } from './ErrorMessage';

interface AuthFormProps {
    onSubmit: (e: Event) => void;
    error?: string | null;
    disabled?: boolean;
    children: ComponentChildren;
}

export function AuthForm({ onSubmit, error, disabled = false, children }: AuthFormProps) {
    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!disabled) {
            onSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className='flex flex-col' style={{ gap: 'var(--space-lg, 1rem)' }}>
            <fieldset disabled={disabled} className='flex flex-col' style={{ gap: 'var(--space-lg, 1rem)' }}>
                {children}
            </fieldset>
            {error && <ErrorMessage error={error} />}
        </form>
    );
}
