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
        <div className="flex flex-row justify-end space-x-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
                {t('expenseComponents.expenseFormActions.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving || participantsCount === 0 || !hasRequiredFields}>
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
