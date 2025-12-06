import { ReadonlySignal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Form, Input } from '../../ui';

interface GroupGeneralTabContentProps {
    groupName: string;
    groupDescription: string;
    isSubmitting: boolean;
    validationError: string | null;
    successMessage: ReadonlySignal<string | null>;
    hasChanges: boolean;
    isFormValid: boolean;
    onGroupNameChange: (value: string) => void;
    onGroupDescriptionChange: (value: string) => void;
    onSubmit: (event: Event) => void;
    onDeleteClick: () => void;
    onClose: () => void;
}

export function GroupGeneralTabContent({
    groupName,
    groupDescription,
    isSubmitting,
    validationError,
    successMessage,
    hasChanges,
    isFormValid,
    onGroupNameChange,
    onGroupDescriptionChange,
    onSubmit,
    onDeleteClick,
    onClose,
}: GroupGeneralTabContentProps) {
    const { t } = useTranslation();

    return (
        <div className='space-y-8'>
            <Form onSubmit={onSubmit}>
                <div className='space-y-4'>
                    {successMessage.value && (
                        <div
                            className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                            role='status'
                        >
                            {successMessage.value}
                        </div>
                    )}
                    <Input
                        id='group-name-input'
                        label={t('editGroupModal.groupNameLabel')}
                        type='text'
                        placeholder={t('editGroupModal.groupNamePlaceholder')}
                        value={groupName}
                        onChange={onGroupNameChange}
                        required
                        disabled={isSubmitting}
                        error={validationError || undefined}
                    />

                    <div>
                        <label htmlFor='group-description-textarea' className='block text-sm font-medium text-text-primary mb-2'>{t('editGroupModal.descriptionLabel')}</label>
                        <textarea
                            id='group-description-textarea'
                            className='w-full px-3 py-2 border border-border-default bg-surface-raised backdrop-blur-sm text-text-primary placeholder:text-text-muted/70 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary resize-none transition-colors duration-200'
                            rows={3}
                            placeholder={t('editGroupModal.descriptionPlaceholder')}
                            value={groupDescription}
                            onInput={(event) => onGroupDescriptionChange((event.target as HTMLTextAreaElement).value)}
                            disabled={isSubmitting}
                            maxLength={200}
                        />
                    </div>

                    {validationError && <Alert type='error' message={validationError} data-testid='edit-group-validation-error' />}
                </div>

                <div className='flex items-center justify-between mt-6 pt-4 border-t border-border-default'>
                    <Button type='button' variant='danger' onClick={onDeleteClick} disabled={isSubmitting} data-testid='delete-group-button'>
                        {t('editGroupModal.deleteGroupButton')}
                    </Button>
                    <div className='flex items-center space-x-3'>
                        <Button type='button' variant='secondary' onClick={onClose} disabled={isSubmitting} data-testid='cancel-edit-group-button'>
                            {t('editGroupModal.cancelButton')}
                        </Button>
                        <Button type='submit' loading={isSubmitting} disabled={!isFormValid || !hasChanges} data-testid='save-changes-button'>
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            </Form>
        </div>
    );
}
