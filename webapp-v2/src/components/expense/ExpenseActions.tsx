import { CopyIcon, ShareIcon, TrashIcon } from '@/components/ui/icons';
import { logError } from '@/utils/browser-logger.ts';
import type { ExpenseDTO } from '@billsplit-wl/shared';
import { useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Alert, Button, ConfirmDialog } from '../ui';

interface ExpenseActionsProps {
    expense: ExpenseDTO;
    onEdit: () => void;
    onDelete: () => Promise<void>;
    onShare: () => void;
    onCopy: () => void;
    disabled?: boolean;
}

export function ExpenseActions({ expense, onEdit, onDelete, onShare, onCopy, disabled }: ExpenseActionsProps) {
    const { t } = useTranslation();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
        setDeleteError(null);
    };

    const handleDeleteConfirm = async () => {
        try {
            setIsDeleting(true);
            setDeleteError(null);
            await onDelete();
            setShowDeleteConfirm(false);
        } catch (error) {
            logError('Failed to delete expense', error, { expenseId: expense.id });
            setDeleteError(error instanceof Error ? error.message : t('expenseComponents.expenseActions.deleteFailed'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
        setDeleteError(null);
    };

    return (
        <>
            {/* Action Buttons */}
            <div className='flex flex-wrap gap-3 justify-center sm:justify-start'>
                <div title={disabled ? t('expenseComponents.expenseActions.cannotEditTooltip') : undefined}>
                    <Button variant='primary' onClick={onEdit} disabled={disabled}>
                        {t('expenseComponents.expenseActions.edit')}
                    </Button>
                </div>

                <Button variant='secondary' onClick={onCopy} ariaLabel={t('expenseComponents.expenseActions.copyExpense')}>
                    <>
                        <CopyIcon size={16} className='mr-2' />
                        {t('expenseComponents.expenseActions.copy')}
                    </>
                </Button>

                <Button variant='secondary' onClick={onShare}>
                    <>
                        <ShareIcon size={16} className='mr-2' />
                        {t('expenseComponents.expenseActions.share')}
                    </>
                </Button>

                <Button variant='danger' onClick={handleDeleteClick}>
                    <>
                        <TrashIcon size={16} className='mr-2' />
                        {t('expenseComponents.expenseActions.delete')}
                    </>
                </Button>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title={t('expenseComponents.expenseActions.deleteTitle')}
                message={t('expenseComponents.expenseActions.deleteConfirm', { expenseName: expense.description })}
                confirmText={t('expenseComponents.expenseActions.deleteButton')}
                cancelText={t('expenseComponents.expenseActions.cancel')}
                variant='danger'
                loading={isDeleting}
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />

            {/* Error Display */}
            {deleteError && (
                <div className='mt-4'>
                    <Alert type='error' message={deleteError} />
                </div>
            )}
        </>
    );
}
