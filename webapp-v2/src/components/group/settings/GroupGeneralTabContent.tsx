import { ReadonlySignal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Form, Input, Switch } from '../../ui';
import { GroupCurrencySettings } from './GroupCurrencySettings';

interface CurrencySettingsState {
    enabled: boolean;
    permittedCurrencies: string[];
    defaultCurrency: string;
    isSubmitting: boolean;
    validationError: string | null;
    successMessage: ReadonlySignal<string | null>;
    hasChanges: boolean;
    isFormValid: boolean;
    toggleEnabled: (enabled: boolean) => void;
    addCurrency: (code: string) => void;
    removeCurrency: (code: string) => void;
    setDefaultCurrency: (code: string) => void;
    handleSave: () => Promise<void>;
}

interface LockSettingsState {
    locked: boolean;
    isSubmitting: boolean;
    error: string | null;
    successMessage: ReadonlySignal<string | null>;
    toggleLocked: () => Promise<void>;
}

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
    // Currency settings (optional - only shown for admins)
    currencySettings?: CurrencySettingsState;
    // Lock settings (optional - only shown for admins)
    lockSettings?: LockSettingsState;
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
    currencySettings,
    lockSettings,
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
                            className='w-full px-3 py-2 border border-border-default bg-surface-raised backdrop-blur-xs text-text-primary placeholder:text-text-muted/70 rounded-md shadow-sm focus:outline-hidden focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary resize-none transition-colors duration-200'
                            rows={3}
                            placeholder={t('editGroupModal.descriptionPlaceholder')}
                            value={groupDescription}
                            onInput={(event) => onGroupDescriptionChange((event.target as HTMLTextAreaElement).value)}
                            disabled={isSubmitting}
                            maxLength={200}
                        />
                    </div>

                    {validationError && <Alert type='error' message={validationError} />}
                </div>

                <div className='flex items-center justify-between mt-6 pt-4 border-t border-border-default'>
                    <Button type='button' variant='danger' onClick={onDeleteClick} disabled={isSubmitting}>
                        {t('editGroupModal.deleteGroupButton')}
                    </Button>
                    <div className='flex items-center space-x-3'>
                        <Button type='button' variant='secondary' onClick={onClose} disabled={isSubmitting}>
                            {t('editGroupModal.cancelButton')}
                        </Button>
                        <Button type='submit' loading={isSubmitting} disabled={!isFormValid || !hasChanges}>
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            </Form>

            {/* Currency Settings Section */}
            {currencySettings && (
                <div className='space-y-4'>
                    {currencySettings.successMessage.value && (
                        <div
                            className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                            role='status'
                        >
                            {currencySettings.successMessage.value}
                        </div>
                    )}

                    <GroupCurrencySettings
                        enabled={currencySettings.enabled}
                        permittedCurrencies={currencySettings.permittedCurrencies}
                        defaultCurrency={currencySettings.defaultCurrency}
                        onToggle={currencySettings.toggleEnabled}
                        onAddCurrency={currencySettings.addCurrency}
                        onRemoveCurrency={currencySettings.removeCurrency}
                        onSetDefault={currencySettings.setDefaultCurrency}
                        validationError={currencySettings.validationError}
                        disabled={currencySettings.isSubmitting}
                    />

                    {currencySettings.hasChanges && (
                        <div className='flex justify-end pt-4'>
                            <Button
                                type='button'
                                onClick={currencySettings.handleSave}
                                loading={currencySettings.isSubmitting}
                                disabled={!currencySettings.isFormValid}
                            >
                                {t('groupSettings.currencySettings.saveButton')}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Group Locking Section */}
            {lockSettings && (
                <div className='space-y-4 pt-4 border-t border-border-default'>
                    <h3 className='text-sm font-medium text-text-primary'>
                        {t('group.locked.sectionTitle')}
                    </h3>

                    {lockSettings.successMessage.value && (
                        <div
                            className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                            role='status'
                        >
                            {lockSettings.successMessage.value}
                        </div>
                    )}

                    {lockSettings.error && (
                        <Alert type='error' message={lockSettings.error} />
                    )}

                    <div className='bg-surface-muted rounded-lg p-4'>
                        <Switch
                            id='group-lock-toggle'
                            checked={lockSettings.locked}
                            onChange={lockSettings.toggleLocked}
                            disabled={lockSettings.isSubmitting}
                            label={lockSettings.locked ? t('group.locked.unlockToggle') : t('group.locked.toggle')}
                            description={lockSettings.locked ? t('group.locked.unlockDescription') : t('group.locked.toggleDescription')}
                        />

                        {!lockSettings.locked && (
                            <p className='mt-3 text-xs text-text-muted'>
                                {t('group.locked.warning')}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
