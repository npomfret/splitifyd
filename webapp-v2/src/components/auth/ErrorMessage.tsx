import { XCircleIcon } from '@/components/ui/icons';

interface ErrorMessageProps {
    error: string | null;
    className?: string;
}

export function ErrorMessage({ error, className = '' }: ErrorMessageProps) {
    if (!error) return null;

    return (
        <div role='alert' class={`text-semantic-error text-sm bg-surface-error border border-border-error rounded-md p-3 ${className}`} data-testid='error-message'>
            <div className='flex'>
                <div className='shrink-0'>
                    <XCircleIcon size={16} className='text-semantic-error/80' />
                </div>
                <div className='ml-2'>
                    <p>{error}</p>
                </div>
            </div>
        </div>
    );
}
