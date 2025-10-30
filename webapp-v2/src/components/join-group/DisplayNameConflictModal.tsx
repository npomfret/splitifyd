import { Button, Input, Tooltip } from '@/components/ui';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface DisplayNameConflictModalProps {
    isOpen: boolean;
    groupName: string;
    currentName: string;
    loading: boolean;
    error?: string | null;
    onSubmit: (newName: string) => Promise<void> | void;
    onCancel: () => void;
    onClearError: () => void;
}

export function DisplayNameConflictModal({
    isOpen,
    groupName,
    currentName,
    loading,
    error,
    onSubmit,
    onCancel,
    onClearError,
}: DisplayNameConflictModalProps) {
    const { t } = useTranslation();
    const modalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [displayName, setDisplayName] = useState(currentName);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Initialize form state when modal opens
    useEffect(() => {
        if (!isOpen) return;

        setDisplayName(currentName);
        setValidationError(null);
        onClearError();

        queueMicrotask(() => {
            inputRef.current?.focus();
        });
    }, [isOpen, currentName, onClearError]);

    // Handle escape key to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loading) {
                event.preventDefault();
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel, loading]);

    if (!isOpen) {
        return null;
    }

    const handleBackdropClick = (event: Event) => {
        if (event.target === event.currentTarget && !loading) {
            onCancel();
        }
    };

    const handleSubmit = async (event: Event) => {
        event.preventDefault();
        const trimmedName = displayName.trim();

        if (!trimmedName) {
            setValidationError(t('joinGroupPage.displayNameConflict.errors.required'));
            return;
        }

        if (trimmedName.length > 50) {
            setValidationError(t('joinGroupPage.displayNameConflict.errors.tooLong'));
            return;
        }

        if (trimmedName.localeCompare(currentName.trim(), undefined, { sensitivity: 'accent' }) === 0) {
            setValidationError(t('joinGroupPage.displayNameConflict.errors.sameAsCurrent'));
            return;
        }

        setValidationError(null);

        try {
            await onSubmit(trimmedName);
        } catch (submissionError) {
            // Error is surfaced via props from parent
        }
    };

    const handleInputChange = (value: string) => {
        setDisplayName(value);
        if (validationError) {
            setValidationError(null);
        }
        if (error) {
            onClearError();
        }
    };

    return (
        <div
            class='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'
            onClick={handleBackdropClick}
            role='presentation'
        >
            <div
                ref={modalRef}
                class='relative top-20 mx-auto w-full max-w-md bg-white rounded-lg shadow-xl'
                role='dialog'
                aria-modal='true'
                aria-labelledby='display-name-conflict-title'
                aria-describedby='display-name-conflict-description'
            >
                <div class='px-6 py-5 border-b border-gray-200 flex items-start justify-between'>
                    <div>
                        <h3 id='display-name-conflict-title' class='text-lg font-semibold text-gray-900'>
                            {t('joinGroupPage.displayNameConflict.title', { groupName })}
                        </h3>
                        <p id='display-name-conflict-description' class='mt-1 text-sm text-gray-600'>
                            {t('joinGroupPage.displayNameConflict.description', { currentName, groupName })}
                        </p>
                    </div>
                    <Tooltip content={t('common.close')}>
                        <button
                            type='button'
                            class='text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100'
                            onClick={onCancel}
                            aria-label={t('common.close')}
                            disabled={loading}
                        >
                            <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                            </svg>
                        </button>
                    </Tooltip>
                </div>

                <form onSubmit={handleSubmit} class='px-6 py-5 space-y-4'>
                    <div>
                        <p class='text-xs font-medium text-gray-500 uppercase tracking-wide pb-1'>
                            {t('joinGroupPage.displayNameConflict.currentNameLabel')}
                        </p>
                        <p class='text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-md px-3 py-2'>
                            {currentName}
                        </p>
                    </div>

                    <Input
                        label={t('joinGroupPage.displayNameConflict.inputLabel')}
                        placeholder={t('joinGroupPage.displayNameConflict.inputPlaceholder')}
                        value={displayName}
                        onChange={handleInputChange}
                        disabled={loading}
                        error={validationError || undefined}
                        data-testid='display-name-conflict-input'
                        inputRef={inputRef}
                    />

                    {error && (
                        <div
                            class='bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-800'
                            role='alert'
                            data-testid='display-name-conflict-error'
                        >
                            {error}
                        </div>
                    )}

                    <div class='flex flex-col gap-2 pt-1'>
                        <Button type='submit' disabled={loading} fullWidth>
                            {loading ? t('joinGroupPage.displayNameConflict.saving') : t('joinGroupPage.displayNameConflict.submit')}
                        </Button>
                        <Button
                            type='button'
                            variant='secondary'
                            onClick={onCancel}
                            disabled={loading}
                            fullWidth
                        >
                            {t('joinGroupPage.displayNameConflict.cancel')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
