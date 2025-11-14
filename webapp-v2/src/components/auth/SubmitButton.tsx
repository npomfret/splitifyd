import { Button } from '../ui';

interface SubmitButtonProps {
    loading: boolean;
    disabled?: boolean;
    children: string;
    className?: string;
    type?: 'submit' | 'button';
}

export function SubmitButton({ loading, disabled = false, children, className = '', type = 'submit' }: SubmitButtonProps) {
    return (
        <Button type={type} variant='primary' loading={loading} disabled={disabled} fullWidth className={className}>
            {children}
        </Button>
    );
}
