import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'preact/hooks';
import { apiClient } from '@/app/apiClient.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { Input, Button, Form } from '../ui';
import type { Group } from '@splitifyd/shared';

interface EditGroupModalProps {
    isOpen: boolean;
    group: Group;
    onClose: () => void;
    onSuccess?: () => void;
    onDelete?: () => void;
}

export function EditGroupModal({ isOpen, group, onClose, onSuccess, onDelete }: EditGroupModalProps) {
    const { t } = useTranslation();
    // Initialize with empty strings - will be set when modal opens
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');

    // Track initial values when modal opens to properly detect changes
    const [initialName, setInitialName] = useState('');
    const [initialDescription, setInitialDescription] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [confirmationText, setConfirmationText] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    // Compare against initial values, not current group prop (which might change due to real-time updates)
    const hasChanges = groupName !== initialName || groupDescription !== initialDescription;

    // Only reset form when modal opens, NOT when group prop changes while open
    // This prevents user input from being wiped out by real-time updates
    useEffect(() => {
        if (isOpen && group) {
            // Capture the group values at the moment the modal opens
            setInitialName(group.name);
            setInitialDescription(group.description || '');
            // Initialize form fields with these values
            setGroupName(group.name);
            setGroupDescription(group.description || '');
            setValidationError(null);
            setDeleteError(null);
        }
    }, [isOpen]); // Removed 'group' dependency to prevent reset on updates

    // Handle escape key to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !showDeleteConfirm) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, showDeleteConfirm]);

    // Handle click outside modal to close
    const handleBackdropClick = (e: Event) => {
        if (e.target === e.currentTarget && !showDeleteConfirm) {
            onClose();
        }
    };

    const validateForm = (): string | null => {
        const name = groupName.trim();

        if (!name) {
            return t('editGroupModal.validation.nameRequired');
        }

        if (name.length < 2) {
            return t('editGroupModal.validation.nameTooShort');
        }

        if (name.length > 50) {
            return t('editGroupModal.validation.nameTooLong');
        }

        return null;
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            setValidationError(validationError);
            return;
        }

        if (!hasChanges) {
            onClose();
            return;
        }

        setIsSubmitting(true);
        setValidationError(null);

        try {
            await apiClient.updateGroup(group.id, {
                name: groupName.trim(),
                description: groupDescription.trim() || undefined,
            });

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('editGroupModal.validation.updateFailed');
            setValidationError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
        setDeleteError(null);
        setConfirmationText('');
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            // Signal to the store that deletion is starting to prevent race condition with notifications
            enhancedGroupDetailStore.setDeletingGroup(true);

            // Redirect user IMMEDIATELY after confirmation to avoid 404s from lingering subscriptions
            setShowDeleteConfirm(false);
            if (onDelete) {
                onDelete();
            }
            onClose();

            // Fire the delete API call in the background - user is already redirected
            apiClient.deleteGroup(group.id).catch((error) => {
                console.error('Group deletion failed (user already redirected):', error);
                // Don't show error to user since they're already on dashboard
                // The group will remain in the list until successful deletion or manual refresh
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('editGroupModal.deleteConfirmDialog.deleteFailed');
            setDeleteError(errorMessage);

            // Clear deletion flag on error so notifications work normally again
            enhancedGroupDetailStore.setDeletingGroup(false);
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
        setDeleteError(null);
        setConfirmationText('');
    };

    if (!isOpen) return null;

    const isFormValid = groupName.trim().length >= 2;

    return (
        <>
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={handleBackdropClick} role="presentation">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="edit-group-modal-title">
                    {/* Modal Header */}
                    <div class="flex items-center justify-between mb-6">
                        <h3 id="edit-group-modal-title" class="text-lg font-semibold text-gray-900" data-testid="edit-group-modal-title">
                            {t('editGroupModal.title')}
                        </h3>
                        <button onClick={onClose} class="text-gray-400 hover:text-gray-600 transition-colors" disabled={isSubmitting}>
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Content */}
                    <Form onSubmit={handleSubmit}>
                        <div class="space-y-4">
                            {/* Group Name */}
                            <div>
                                <Input
                                    label={t('editGroupModal.groupNameLabel')}
                                    type="text"
                                    placeholder={t('editGroupModal.groupNamePlaceholder')}
                                    value={groupName}
                                    onChange={(value) => {
                                        setGroupName(value);
                                        setValidationError(null);
                                    }}
                                    required
                                    disabled={isSubmitting}
                                    error={validationError || undefined}
                                    data-testid="group-name-input"
                                />
                            </div>

                            {/* Group Description (Optional) */}
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">{t('editGroupModal.descriptionLabel')}</label>
                                <textarea
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                                    rows={3}
                                    placeholder={t('editGroupModal.descriptionPlaceholder')}
                                    value={groupDescription}
                                    onInput={(e) => {
                                        setGroupDescription((e.target as HTMLTextAreaElement).value);
                                    }}
                                    disabled={isSubmitting}
                                    maxLength={200}
                                    data-testid="group-description-input"
                                />
                            </div>

                            {/* Error Display */}
                            {validationError && (
                                <div class="bg-red-50 border border-red-200 rounded-md p-3">
                                    <div class="flex">
                                        <div class="flex-shrink-0">
                                            <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    fill-rule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div class="ml-3">
                                            <p class="text-sm text-red-800" role="alert" data-testid="edit-group-validation-error">
                                                {validationError}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                            <Button type="button" variant="danger" onClick={handleDeleteClick} disabled={isSubmitting} data-testid="delete-group-button">
                                {t('editGroupModal.deleteGroupButton')}
                            </Button>
                            <div class="flex items-center space-x-3">
                                <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} data-testid="cancel-edit-group-button">
                                    {t('editGroupModal.cancelButton')}
                                </Button>
                                <Button type="submit" loading={isSubmitting} disabled={!isFormValid || !hasChanges} data-testid="save-changes-button">
                                    {t('editGroupModal.saveChangesButton')}
                                </Button>
                            </div>
                        </div>
                    </Form>
                </div>
            </div>

            {/* Enhanced Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div class="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4" data-testid="delete-group-dialog">
                        {/* Header */}
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-semibold text-red-800 flex items-center">
                                <span class="mr-2">⚠️</span>
                                {t('editGroupModal.deleteConfirmDialog.title')}
                            </h3>
                        </div>

                        {/* Content */}
                        <div class="px-6 py-4">
                            {/* Warning Message */}
                            <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                <h4 class="text-red-800 font-semibold mb-2">{t('editGroupModal.deleteConfirmDialog.warningTitle')}</h4>
                                <p class="text-red-700 text-sm mb-3">{t('editGroupModal.deleteConfirmDialog.warningMessage')}</p>
                                <ul class="text-red-700 text-sm list-disc list-inside space-y-1">
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.expenses')}</li>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.settlements')}</li>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.members')}</li>
                                    <li>{t('editGroupModal.deleteConfirmDialog.warningList.history')}</li>
                                </ul>
                                <p class="text-red-800 font-semibold text-sm mt-3">{t('editGroupModal.deleteConfirmDialog.cannotUndo')}</p>
                            </div>

                            {/* Confirmation Input */}
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">{t('editGroupModal.deleteConfirmDialog.typeToConfirm', { groupName: group.name })}</label>
                                <Input type="text" placeholder={group.name} value={confirmationText} onChange={setConfirmationText} className="w-full" disabled={isDeleting} />
                            </div>

                            {/* Error Message */}
                            {deleteError && (
                                <div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                                    <p class="text-sm text-red-800" role="alert">
                                        {deleteError}
                                    </p>
                                </div>
                            )}

                            {/* Loading State */}
                            {isDeleting && (
                                <div class="text-center text-gray-600 mb-4">
                                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto mb-2"></div>
                                    <p class="text-sm">{t('editGroupModal.deleteConfirmDialog.deletingMessage')}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                            <Button type="button" variant="secondary" onClick={handleDeleteCancel} disabled={isDeleting}>
                                {t('editGroupModal.deleteConfirmDialog.cancelText')}
                            </Button>
                            <Button type="button" variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting || confirmationText !== group.name} loading={isDeleting}>
                                {isDeleting ? t('editGroupModal.deleteConfirmDialog.deletingText') : t('editGroupModal.deleteConfirmDialog.confirmText')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
