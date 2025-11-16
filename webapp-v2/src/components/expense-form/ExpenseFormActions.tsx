import { useTranslation } from 'react-i18next';
import { Button } from '../ui';

interface ExpenseFormActionsProps {
    isEditMode: boolean;
    saving: boolean;
    participantsCount: number;
    hasRequiredFields: boolean;
    onCancel: () => void;
}

export function ExpenseFormActions({ isEditMode, saving, participantsCount, hasRequiredFields, onCancel }: ExpenseFormActionsProps) {
    const { t } = useTranslation();

    return (
        <div className='flex flex-row justify-end space-x-2'>
            <button type='button' onClick={onCancel} disabled={saving} className='px-4 py-2 rounded-lg text-text-primary border border-border-default hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
                {t('expenseComponents.expenseFormActions.cancel')}
            </button>
            <button type='submit' disabled={saving || participantsCount === 0 || !hasRequiredFields} className='bg-[image:var(--gradient-primary)] text-interactive-primary-foreground px-6 py-2.5 rounded-md shadow-md transition-all duration-200 font-semibold hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'>
                {saving
                    ? isEditMode
                        ? t('expenseComponents.expenseFormActions.updating')
                        : t('expenseComponents.expenseFormActions.saving')
                    : isEditMode
                    ? t('expenseComponents.expenseFormActions.update')
                    : t('expenseComponents.expenseFormActions.save')}
            </button>
        </div>
    );
}
