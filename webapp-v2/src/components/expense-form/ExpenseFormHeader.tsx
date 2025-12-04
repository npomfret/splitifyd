import { useTranslation } from 'react-i18next';
import { Button, Typography } from '../ui';

interface ExpenseFormHeaderProps {
    isEditMode: boolean;
    isCopyMode?: boolean;
    groupName: string;
    onCancel: () => void;
}

export function ExpenseFormHeader({ isEditMode, isCopyMode, groupName, onCancel }: ExpenseFormHeaderProps) {
    const { t } = useTranslation();
    return (
        <div className='max-w-3xl mx-auto px-4 pt-6 pb-4'>
            <div className='flex flex-row items-center justify-between'>
                <div>
                    <Typography variant="pageTitle">
                        {isCopyMode ? t('expenseFormHeader.copyExpense') : isEditMode ? t('expenseFormHeader.editExpense') : t('expenseFormHeader.addExpense')}
                    </Typography>
                    <p className='text-sm text-text-primary/80 mt-1'>{groupName}</p>
                </div>
                <Button variant='ghost' onClick={onCancel} data-testid='expense-form-cancel'>
                    {t('expenseFormHeader.cancel')}
                </Button>
            </div>
        </div>
    );
}
