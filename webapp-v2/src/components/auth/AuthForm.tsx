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
        <form onSubmit={handleSubmit} class='space-y-6'>
            {error && <ErrorMessage error={error} />}
            <fieldset disabled={disabled} class='space-y-6'>
                {children}
            </fieldset>
        </form>
    );
}
