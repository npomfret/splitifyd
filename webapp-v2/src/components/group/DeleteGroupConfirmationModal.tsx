import { Alert, Input, LoadingSpinner } from '@/components/ui';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import { ModalFormFooter } from '@/components/ui/ModalFormFooter';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface DeleteGroupConfirmationModalProps {
    isOpen: boolean;
    groupName: string;
    confirmationText: string;
    onConfirmationTextChange: (value: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
    error: string | null;
}

export function DeleteGroupConfirmationModal({
    isOpen,
    groupName,
    confirmationText,
    onConfirmationTextChange,
    onConfirm,
    onCancel,
    isDeleting,
    error,
}: DeleteGroupConfirmationModalProps) {
    const { t } = useTranslation();

    return (
        <Modal
            open={isOpen}
            onClose={isDeleting ? undefined : onCancel}
            size='sm'
            className='max-w-md'
            labelledBy='delete-group-confirmation-title'
        >
            <div>
                <ModalHeader>
                    <h3 id='delete-group-confirmation-title' className='text-lg font-semibold text-semantic-error flex items-center'>
                        <ExclamationTriangleIcon className='w-5 h-5 mr-2' aria-hidden='true' />
                        {t('editGroupModal.deleteConfirmDialog.title')}
                    </h3>
                </ModalHeader>

                <ModalContent>
                    <div className='bg-surface-error border border-border-error rounded-md p-4 mb-4'>
                        <h4 className='text-semantic-error font-semibold mb-2'>{t('editGroupModal.deleteConfirmDialog.warningTitle')}</h4>
                        <p className='text-semantic-error text-sm mb-3'>{t('editGroupModal.deleteConfirmDialog.warningMessage')}</p>
                        <ul className='text-semantic-error text-sm list-disc list-inside space-y-1'>
                            <li>{t('editGroupModal.deleteConfirmDialog.warningList.expenses')}</li>
                            <li>{t('editGroupModal.deleteConfirmDialog.warningList.settlements')}</li>
                            <li>{t('editGroupModal.deleteConfirmDialog.warningList.members')}</li>
                            <li>{t('editGroupModal.deleteConfirmDialog.warningList.history')}</li>
                        </ul>
                        <p className='text-semantic-error font-semibold text-sm mt-3'>{t('editGroupModal.deleteConfirmDialog.cannotUndo')}</p>
                    </div>

                    <div className='mb-4'>
                        <label className='block text-sm font-medium text-text-primary mb-2'>{t('editGroupModal.deleteConfirmDialog.typeToConfirm', { groupName })}</label>
                        <Input type='text' placeholder={groupName} value={confirmationText} onChange={onConfirmationTextChange} className='w-full' disabled={isDeleting} />
                    </div>

                    {error && <Alert type='error' message={error} />}

                    {isDeleting && (
                        <div className='text-center text-text-muted mb-4'>
                            <div className='mx-auto mb-2'>
                                <LoadingSpinner size='sm' color='text-semantic-error' />
                            </div>
                            <p className='text-sm'>{t('editGroupModal.deleteConfirmDialog.deletingMessage')}</p>
                        </div>
                    )}
                </ModalContent>

                <ModalFormFooter
                    onCancel={onCancel}
                    cancelText={t('editGroupModal.deleteConfirmDialog.cancelText')}
                    submitText={isDeleting ? t('editGroupModal.deleteConfirmDialog.deletingText') : t('editGroupModal.deleteConfirmDialog.confirmText')}
                    submitVariant='danger'
                    submitType='button'
                    onSubmit={onConfirm}
                    isSubmitting={isDeleting}
                    isSubmitDisabled={confirmationText !== groupName}
                />
            </div>
        </Modal>
    );
}
