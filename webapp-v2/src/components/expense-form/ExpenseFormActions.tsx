import { Button } from '@/components/ui';
import { useTranslation } from 'react-i18next';

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
            <Button
                type='button'
                onClick={onCancel}
                disabled={saving}
                variant='secondary'
                size='md'
            >
                {t('expenseComponents.expenseFormActions.cancel')}
            </Button>
            <Button
                type='submit'
                disabled={saving || participantsCount === 0 || !hasRequiredFields}
                loading={saving}
                variant='primary'
                size='md'
            >
                {saving
                    ? isEditMode
                        ? t('expenseComponents.expenseFormActions.updating')
                        : t('expenseComponents.expenseFormActions.saving')
                    : isEditMode
                    ? t('expenseComponents.expenseFormActions.update')
                    : t('expenseComponents.expenseFormActions.save')}
            </Button>
        </div>
    );
}
