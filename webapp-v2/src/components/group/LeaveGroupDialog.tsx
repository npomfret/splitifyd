import { useSignal } from '@preact/signals';
import { useTranslation } from 'react-i18next';
import { route } from 'preact-router';
import { ConfirmDialog } from '@/components/ui';
import { apiClient } from '@/app/apiClient';
import { logError } from '@/utils/browser-logger';

interface LeaveGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    hasOutstandingBalance: boolean;
}

export function LeaveGroupDialog({ isOpen, onClose, groupId, hasOutstandingBalance }: LeaveGroupDialogProps) {
    const { t } = useTranslation();
    const isProcessing = useSignal(false);

    const handleConfirm = async () => {
        // Check if user has outstanding balance and prevent leaving if so
        if (hasOutstandingBalance) {
            // Don't leave - the dialog should show error message and user can cancel
            return;
        }

        try {
            isProcessing.value = true;
            await apiClient.leaveGroup(groupId);
            // Successfully left - navigation will handle the redirect
            route('/dashboard');
        } catch (error: any) {
            logError('Failed to leave group', error);
        } finally {
            isProcessing.value = false;
            onClose();
        }
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onCancel={onClose}
            onConfirm={handleConfirm}
            title={t('membersList.leaveGroupDialog.title')}
            message={hasOutstandingBalance ? t('membersList.leaveGroupDialog.messageWithBalance') : t('membersList.leaveGroupDialog.messageConfirm')}
            confirmText={hasOutstandingBalance ? t('common.understood') : t('membersList.leaveGroupDialog.confirmText')}
            cancelText={t('membersList.leaveGroupDialog.cancelText')}
            variant={hasOutstandingBalance ? 'info' : 'warning'}
            loading={isProcessing.value}
            data-testid="leave-group-dialog"
        />
    );
}
