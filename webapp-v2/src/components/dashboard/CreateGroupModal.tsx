import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { logInfo } from '@/utils/browser-logger';
import { signal } from '@preact/signals';
import {CreateGroupRequest, GroupId, toGroupName} from '@splitifyd/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Tooltip } from '../ui';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (groupId: GroupId) => void;
}

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const emitModalDebugLog = (message: string, data?: Record<string, unknown>) => {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
            console.info(
                `${message}:`,
                JSON.stringify({
                    timestamp: new Date().toISOString(),
                    ...(data ?? {}),
                }),
            );
        }

        logInfo(message, data);
    };

    // Create fresh signals for each modal instance to avoid stale state
    const [groupNameSignal] = useState(() => signal(''));
    const [groupDescriptionSignal] = useState(() => signal(''));

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            groupNameSignal.value = '';
            groupDescriptionSignal.value = '';
            setValidationError(null);
            // Clear any validation errors from previous attempts
            enhancedGroupsStore.clearValidationError();
        }
    }, [isOpen]);

    // Handle escape key to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                emitModalDebugLog('[CreateGroupModal] Closing modal: Escape key pressed', {
                    key: e.key,
                    isSubmitting,
                });
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Handle click outside modal to close - but not during submission
    const handleBackdropClick = (e: Event) => {
        if (e.target !== e.currentTarget) {
            return;
        }

        if (isSubmitting) {
            emitModalDebugLog('[CreateGroupModal] Ignored backdrop click while submitting', {
                isSubmitting,
            });
            return;
        }

        emitModalDebugLog('[CreateGroupModal] Closing modal: Backdrop clicked', {
            isSubmitting,
            eventType: e.type,
            timestamp: new Date().toISOString(),
        });
        onClose();
    };

    const validateForm = (): string | null => {
        const name = groupNameSignal.value.trim();

        if (!name) {
            return t('createGroupModal.validation.nameRequired');
        }

        if (name.length < 2) {
            return t('createGroupModal.validation.nameTooShort');
        }

        if (name.length > 50) {
            return t('createGroupModal.validation.nameTooLong');
        }

        return null;
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            // Validation error is displayed in the modal
            setValidationError(validationError);
            return;
        }

        setIsSubmitting(true);
        setValidationError(null);

        try {
            const groupData: CreateGroupRequest = {
                name: toGroupName(groupNameSignal.value.trim()),
                description: groupDescriptionSignal.value.trim() || undefined,
            };

            const newGroup = await enhancedGroupsStore.createGroup(groupData);

            // Success! Close modal and optionally callback
            emitModalDebugLog('[CreateGroupModal] Closing modal: Group created successfully', {
                groupId: newGroup.id,
                groupName: groupData.name,
            });
            if (onSuccess) {
                onSuccess(newGroup.id);
            }
            onClose();
        } catch (error) {
            // Error is already handled by the store (sets enhancedGroupsStore.errorSignal)
            // Just prevent unhandled promise rejection - don't close modal on error
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isFormValid = groupNameSignal.value.trim().length >= 2;

    return (
        <div class='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50' onClick={handleBackdropClick} role='presentation'>
            <div class='relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white' ref={modalRef} role='dialog' aria-modal='true' aria-labelledby='create-group-modal-title'>
                {/* Modal Header */}
                <div class='flex items-center justify-between mb-6'>
                    <h3 id='create-group-modal-title' class='text-lg font-semibold text-gray-900'>
                        {t('createGroupModal.title')}
                    </h3>
                    <Tooltip content={t('createGroupModal.closeButtonAriaLabel')}>
                        <button
                            type='button'
                            onClick={() => {
                                emitModalDebugLog('[CreateGroupModal] Closing modal: X button clicked', {
                                    isSubmitting,
                                });
                                onClose();
                            }}
                            class='text-gray-400 hover:text-gray-600 transition-colors'
                            disabled={isSubmitting}
                            aria-label={t('createGroupModal.closeButtonAriaLabel')}
                        >
                            <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                            </svg>
                        </button>
                    </Tooltip>
                </div>

                {/* Modal Content */}
                <Form onSubmit={handleSubmit}>
                    <div class='space-y-4'>
                        {/* Group Name */}
                        <div>
                            <Input
                                label={t('createGroupModal.groupNameLabel')}
                                type='text'
                                name='name'
                                placeholder={t('createGroupModal.groupNamePlaceholder')}
                                value={groupNameSignal.value}
                                onChange={(value) => {
                                    groupNameSignal.value = value;
                                    setValidationError(null); // Clear error when user types
                                    // Also clear store validation errors when user starts fixing the issue
                                    enhancedGroupsStore.clearValidationError();
                                }}
                                required
                                disabled={isSubmitting}
                                error={validationError || undefined}
                            />
                            <p class='mt-1 text-sm text-gray-500'>{t('createGroupModal.groupNameHelpText')}</p>
                        </div>

                        {/* Group Description (Optional) */}
                        <div>
                            <label class='block text-sm font-medium text-gray-700 mb-2'>{t('createGroupModal.groupDescriptionLabel')}</label>
                            <textarea
                                name='description'
                                data-testid='group-description-input'
                                class='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none'
                                rows={3}
                                placeholder={t('createGroupModal.groupDescriptionPlaceholder')}
                                value={groupDescriptionSignal.value}
                                onInput={(e) => {
                                    groupDescriptionSignal.value = (e.target as HTMLTextAreaElement).value;
                                }}
                                disabled={isSubmitting}
                                maxLength={200}
                            />
                            <p class='mt-1 text-sm text-gray-500'>{t('createGroupModal.groupDescriptionHelpText')}</p>
                        </div>

                        {/* Error Display */}
                        {enhancedGroupsStore.errorSignal.value && (
                            <div class='bg-red-50 border border-red-200 rounded-md p-3'>
                                <div class='flex'>
                                    <div class='flex-shrink-0'>
                                        <svg class='h-5 w-5 text-red-400' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true' focusable='false'>
                                            <path
                                                fill-rule='evenodd'
                                                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                                                clip-rule='evenodd'
                                            />
                                        </svg>
                                    </div>
                                    <div class='ml-3'>
                                        <p class='text-sm text-red-800' role='alert' data-testid='create-group-error-message'>
                                            {enhancedGroupsStore.errorSignal.value}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div class='flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200'>
                        <Button
                            type='button'
                            variant='secondary'
                            onClick={() => {
                                emitModalDebugLog('[CreateGroupModal] Closing modal: Cancel button clicked', {
                                    isSubmitting,
                                });
                                onClose();
                            }}
                            disabled={isSubmitting}
                        >
                            {t('createGroupModal.cancelButton')}
                        </Button>
                        <Button type='submit' loading={isSubmitting} disabled={!isFormValid}>
                            {t('createGroupModal.submitButton')}
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
}
