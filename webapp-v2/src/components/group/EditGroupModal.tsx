import { useState, useRef, useEffect } from 'preact/hooks';
import { apiClient } from '../../app/apiClient';
import { Input, Button, Form } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { Group } from '../../../../firebase/functions/src/shared/shared-types';

interface EditGroupModalProps {
    isOpen: boolean;
    group: Group;
    onClose: () => void;
    onSuccess?: () => void;
    onDelete?: () => void;
}

export function EditGroupModal({ isOpen, group, onClose, onSuccess, onDelete }: EditGroupModalProps) {
    const [groupName, setGroupName] = useState(group.name);
    const [groupDescription, setGroupDescription] = useState(group.description || '');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const hasChanges = groupName !== group.name || 
                       groupDescription !== (group.description || '');

    // Reset form when modal opens/closes or group changes
    useEffect(() => {
        if (isOpen) {
            setGroupName(group.name);
            setGroupDescription(group.description || '');
            setValidationError(null);
            setDeleteError(null);
        }
    }, [isOpen, group]);

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
            return 'Group name is required.';
        }

        if (name.length < 2) {
            return 'Group name must be at least 2 characters long.';
        }

        if (name.length > 50) {
            return 'Group name must be less than 50 characters.';
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
            const errorMessage = error instanceof Error ? error.message : 'Failed to update group';
            setValidationError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
        setDeleteError(null);
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        setDeleteError(null);

        try {
            await apiClient.deleteGroup(group.id);
            setShowDeleteConfirm(false);
            if (onDelete) {
                onDelete();
            }
            onClose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete group';
            setDeleteError(errorMessage);
            // Check if it's because group has expenses
            if (errorMessage.includes('expenses')) {
                setDeleteError('Cannot delete group with expenses. Delete all expenses first.');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
        setDeleteError(null);
    };

    if (!isOpen) return null;

    const isFormValid = groupName.trim().length >= 2;

    return (
        <>
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={handleBackdropClick} role="presentation">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="edit-group-modal-title">
                    {/* Modal Header */}
                    <div class="flex items-center justify-between mb-6">
                        <h3 id="edit-group-modal-title" class="text-lg font-semibold text-gray-900">
                            Edit Group
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
                                    label="Group Name"
                                    type="text"
                                    placeholder="e.g., Apartment Expenses, Trip to Paris"
                                    value={groupName}
                                    onChange={(value) => {
                                        setGroupName(value);
                                        setValidationError(null);
                                    }}
                                    required
                                    disabled={isSubmitting}
                                    error={validationError || undefined}
                                />
                            </div>

                            {/* Group Description (Optional) */}
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                                <textarea
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                                    rows={3}
                                    placeholder="Add any details about this group..."
                                    value={groupDescription}
                                    onInput={(e) => {
                                        setGroupDescription((e.target as HTMLTextAreaElement).value);
                                    }}
                                    disabled={isSubmitting}
                                    maxLength={200}
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
                                            <p class="text-sm text-red-800">{validationError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                            <Button 
                                type="button" 
                                variant="danger" 
                                onClick={handleDeleteClick} 
                                disabled={isSubmitting}
                            >
                                Delete Group
                            </Button>
                            <div class="flex items-center space-x-3">
                                <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    loading={isSubmitting} 
                                    disabled={!isFormValid || !hasChanges}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </Form>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Group"
                message={deleteError || `Are you sure you want to delete "${group.name}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
                loading={isDeleting}
            />
        </>
    );
}