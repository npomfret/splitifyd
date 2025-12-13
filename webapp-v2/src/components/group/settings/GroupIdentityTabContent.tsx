import { ReadonlySignal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input } from '../../ui';

interface GroupIdentityTabContentProps {
    displayName: string;
    validationError: string | null;
    serverError: string | null;
    successMessage: ReadonlySignal<string | null>;
    isSaving: boolean;
    isDirty: boolean;
    isLoading: boolean;
    onDisplayNameChange: (value: string) => void;
    onSubmit: (event: Event) => void;
}

export function GroupIdentityTabContent({
    displayName,
    validationError,
    serverError,
    successMessage,
    isSaving,
    isDirty,
    isLoading,
    onDisplayNameChange,
    onSubmit,
}: GroupIdentityTabContentProps) {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <section className='border border-border-default rounded-lg p-5 space-y-3 bg-surface-muted/60'>
                <div className='h-4 bg-surface-muted animate-pulse rounded' aria-hidden='true'></div>
                <div className='h-10 bg-surface-muted animate-pulse rounded' aria-hidden='true'></div>
            </section>
        );
    }

    return (
        <div className='space-y-4'>
            <section className='border border-border-default rounded-lg p-5 space-y-4 bg-surface-muted/60' aria-labelledby='group-display-name-heading'>
                <div>
                    <h3 id='group-display-name-heading' className='text-sm font-semibold text-text-primary'>{t('groupDisplayNameSettings.title')}</h3>
                    <p className='text-sm text-text-primary/70 mt-1'>{t('groupDisplayNameSettings.description')}</p>
                </div>

                <form onSubmit={onSubmit} className='space-y-4'>
                    <Input
                        id='group-display-name-input'
                        label={t('groupDisplayNameSettings.inputLabel')}
                        placeholder={t('groupDisplayNameSettings.inputPlaceholder')}
                        value={displayName}
                        onChange={onDisplayNameChange}
                        disabled={isSaving}
                        error={validationError || undefined}
                    />

                    {serverError && <Alert type='error' message={serverError} />}

                    {successMessage.value && (
                        <div
                            className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                            role='status'
                        >
                            {successMessage.value}
                        </div>
                    )}

                    <Button type='submit' loading={isSaving} disabled={isSaving || !isDirty} fullWidth>
                        {isSaving ? t('groupDisplayNameSettings.saving') : t('common.save')}
                    </Button>
                </form>
            </section>
        </div>
    );
}
