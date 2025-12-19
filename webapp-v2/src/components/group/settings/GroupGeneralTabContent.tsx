import { ReadonlySignal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Form, Input, Switch, Textarea } from '../../ui';
import { GroupCurrencySettings } from './GroupCurrencySettings';

interface GroupGeneralTabContentProps {
    // Group details
    groupName: string;
    groupDescription: string;
    onGroupNameChange: (value: string) => void;
    onGroupDescriptionChange: (value: string) => void;

    // Currency settings
    currencyEnabled: boolean;
    permittedCurrencies: string[];
    defaultCurrency: string;
    onToggleCurrencyEnabled: (enabled: boolean) => void;
    onAddCurrency: (code: string) => void;
    onRemoveCurrency: (code: string) => void;
    onSetDefaultCurrency: (code: string) => void;

    // Lock settings
    locked: boolean;
    onToggleLocked: () => void;

    // Form state
    isSubmitting: boolean;
    validationError: string | null;
    successMessage: ReadonlySignal<string | null>;
    hasChanges: boolean;
    isFormValid: boolean;

    // Form actions
    onSave: (event?: Event) => void;
    onCancel: () => void;
    onDeleteClick: () => void;
}

/**
 * Section header component
 */
function SectionHeader({ title }: { title: string }) {
    return (
        <h3 className='text-sm font-semibold text-text-primary mb-4'>{title}</h3>
    );
}

export function GroupGeneralTabContent({
    groupName,
    groupDescription,
    onGroupNameChange,
    onGroupDescriptionChange,
    currencyEnabled,
    permittedCurrencies,
    defaultCurrency,
    onToggleCurrencyEnabled,
    onAddCurrency,
    onRemoveCurrency,
    onSetDefaultCurrency,
    locked,
    onToggleLocked,
    isSubmitting,
    validationError,
    successMessage,
    hasChanges,
    isFormValid,
    onSave,
    onCancel,
    onDeleteClick,
}: GroupGeneralTabContentProps) {
    const { t } = useTranslation();

    return (
        <Form onSubmit={onSave}>
            <div className='space-y-6'>
                {/* Success Message */}
                {successMessage.value && (
                    <div
                        className='bg-interactive-accent/10 border border-semantic-success/40 rounded-md px-3 py-2 text-sm text-semantic-success'
                        role='status'
                    >
                        {successMessage.value}
                    </div>
                )}

                {/* Validation Error */}
                {validationError && <Alert type='error' message={validationError} />}

                {/* Group Details Section */}
                <section className='border border-border-default rounded-lg p-5 bg-surface-muted/30'>
                    <SectionHeader title={t('groupSettingsModal.sections.groupDetails')} />
                    <div className='space-y-4'>
                        <Input
                            id='group-name-input'
                            label={t('editGroupModal.groupNameLabel')}
                            type='text'
                            placeholder={t('editGroupModal.groupNamePlaceholder')}
                            value={groupName}
                            onChange={onGroupNameChange}
                            required
                            disabled={isSubmitting}
                        />

                        <Textarea
                            id='group-description-textarea'
                            label={t('editGroupModal.descriptionLabel')}
                            rows={3}
                            placeholder={t('editGroupModal.descriptionPlaceholder')}
                            value={groupDescription}
                            onChange={onGroupDescriptionChange}
                            disabled={isSubmitting}
                            maxLength={200}
                        />
                    </div>
                </section>

                {/* Currency Settings Section */}
                <section className='border border-border-default rounded-lg p-5 bg-surface-muted/30'>
                    <SectionHeader title={t('groupSettings.currencySettings.title')} />
                    <GroupCurrencySettings
                        enabled={currencyEnabled}
                        permittedCurrencies={permittedCurrencies}
                        defaultCurrency={defaultCurrency}
                        onToggle={onToggleCurrencyEnabled}
                        onAddCurrency={onAddCurrency}
                        onRemoveCurrency={onRemoveCurrency}
                        onSetDefault={onSetDefaultCurrency}
                        validationError={null}
                        disabled={isSubmitting}
                    />
                </section>

                {/* Group Locking Section */}
                <section className='border border-border-default rounded-lg p-5 bg-surface-muted/30'>
                    <SectionHeader title={t('group.locked.sectionTitle')} />
                    <div className='bg-surface-muted rounded-lg p-4'>
                        <Switch
                            id='group-lock-toggle'
                            checked={locked}
                            onChange={onToggleLocked}
                            disabled={isSubmitting}
                            label={locked ? t('group.locked.unlockToggle') : t('group.locked.toggle')}
                            description={locked ? t('group.locked.unlockDescription') : t('group.locked.toggleDescription')}
                        />

                        {!locked && (
                            <p className='mt-3 text-xs text-text-muted'>
                                {t('group.locked.warning')}
                            </p>
                        )}
                    </div>
                </section>

                {/* Save/Cancel Actions */}
                <div className='flex items-center justify-end gap-3 pt-2'>
                    <Button type='button' variant='secondary' onClick={onCancel} disabled={isSubmitting}>
                        {t('editGroupModal.cancelButton')}
                    </Button>
                    <Button type='submit' loading={isSubmitting} disabled={!isFormValid || !hasChanges}>
                        {t('common.save')}
                    </Button>
                </div>

                {/* Danger Zone - Delete Group */}
                <section className='border border-semantic-error/30 rounded-lg p-5 bg-semantic-error/5'>
                    <SectionHeader title={t('groupSettingsModal.sections.dangerZone')} />
                    <p className='text-sm text-text-muted mb-4'>
                        {t('groupSettingsModal.dangerZone.description')}
                    </p>
                    <Button type='button' variant='danger' onClick={onDeleteClick} disabled={isSubmitting}>
                        {t('editGroupModal.deleteGroupButton')}
                    </Button>
                </section>
            </div>
        </Form>
    );
}
