import { ApiError } from '@/app/apiClient';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { logInfo } from '@/utils/browser-logger';
import { signal, useComputed } from '@preact/signals';
import { CreateGroupRequest, GroupId, toDisplayName, toGroupName } from '@splitifyd/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Tooltip } from '../ui';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (groupId: GroupId) => void;
}

const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.]+$/;

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [displayNameValidationError, setDisplayNameValidationError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const emitModalDebugLog = (message: string, data?: Record<string, unknown>) => {
        logInfo(message, data);
    };

    // Create fresh signals for each modal instance to avoid stale state
    const [groupNameSignal] = useState(() => signal(''));
    const [groupDescriptionSignal] = useState(() => signal(''));
    const [groupDisplayNameSignal] = useState(() => signal(currentUser.value?.displayName?.trim() ?? ''));
    const previousIsOpenRef = useRef(isOpen);

    // Reset form when modal opens (only on open transition, not while already open)
    useEffect(() => {
        const wasOpen = previousIsOpenRef.current;
        const isNowOpen = isOpen;
        previousIsOpenRef.current = isOpen;

        // Only reset form when transitioning from closed to open
        if (!wasOpen && isNowOpen) {
            groupNameSignal.value = '';
            groupDescriptionSignal.value = '';
            groupDisplayNameSignal.value = currentUser.value?.displayName?.trim() ?? '';
            setValidationError(null);
            setDisplayNameValidationError(null);
            // Clear any validation errors from previous attempts
            enhancedGroupsStore.clearValidationError();
        }
    }, [isOpen, currentUser.value?.displayName]);

    // Handle escape key to close modal
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                emitModalDebugLog('[CreateGroupModal] Closing modal: Escape key pressed', {
                    key: e.key,
                    isSubmitting,
                });
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, isSubmitting]);

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

    const validateDisplayName = (): string | null => {
        const displayName = groupDisplayNameSignal.value.trim();

        if (!displayName) {
            return t('createGroupModal.validation.displayNameRequired');
        }

        if (displayName.length < 2) {
            return t('createGroupModal.validation.displayNameTooShort');
        }

        if (displayName.length > 50) {
            return t('createGroupModal.validation.displayNameTooLong');
        }

        if (!DISPLAY_NAME_PATTERN.test(displayName)) {
            return t('createGroupModal.validation.displayNameInvalid');
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

        const displayNameError = validateDisplayName();
        if (displayNameError) {
            setDisplayNameValidationError(displayNameError);
            return;
        }

        setIsSubmitting(true);
        setValidationError(null);
        setDisplayNameValidationError(null);

        try {
            const trimmedGroupName = groupNameSignal.value.trim();
            const trimmedDisplayName = groupDisplayNameSignal.value.trim();
            const groupData: CreateGroupRequest = {
                name: toGroupName(trimmedGroupName),
                groupDisplayName: toDisplayName(trimmedDisplayName),
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
            setDisplayNameValidationError(null);
            onClose();
        } catch (error) {
            if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
                enhancedGroupsStore.clearValidationError();
                setDisplayNameValidationError(t('createGroupModal.validation.displayNameTaken'));
                return;
            }
            // Error is already handled by the store (sets enhancedGroupsStore.errorSignal)
            // Just prevent unhandled promise rejection - don't close modal on error
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const trimmedGroupName = groupNameSignal.value.trim();
    const trimmedDisplayName = groupDisplayNameSignal.value.trim();
    const isFormValid = trimmedGroupName.length >= 2
        && trimmedDisplayName.length >= 2
        && trimmedDisplayName.length <= 50
        && DISPLAY_NAME_PATTERN.test(trimmedDisplayName);

    return (
        <div class='fixed inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50' onClick={handleBackdropClick} role='presentation'>
            <div class='relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-surface-base border-border-default opacity-100' ref={modalRef} role='dialog' aria-modal='true' aria-labelledby='create-group-modal-title'>
                {/* Modal Header */}
                <div class='flex items-center justify-between mb-6'>
                    <h3 id='create-group-modal-title' class='text-lg font-semibold text-text-primary'>
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
                            class='text-text-muted hover:text-text-primary transition-colors'
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
                            <p class='mt-1 text-sm text-text-muted'>{t('createGroupModal.groupNameHelpText')}</p>
                        </div>

                        {/* Group Display Name */}
                        <div>
                            <Input
                                label={t('createGroupModal.groupDisplayNameLabel')}
                                type='text'
                                name='groupDisplayName'
                                data-testid='group-display-name-input'
                                placeholder={t('createGroupModal.groupDisplayNamePlaceholder')}
                                value={groupDisplayNameSignal.value}
                                onChange={(value) => {
                                    groupDisplayNameSignal.value = value;
                                    setDisplayNameValidationError(null);
                                    enhancedGroupsStore.clearValidationError();
                                }}
                                required
                                disabled={isSubmitting}
                                error={displayNameValidationError || undefined}
                            />
                            <p class='mt-1 text-sm text-text-muted'>{t('createGroupModal.groupDisplayNameHelpText')}</p>
                        </div>

                        {/* Group Description (Optional) */}
                        <div>
                            <label class='block text-sm font-medium text-text-primary mb-2'>{t('createGroupModal.groupDescriptionLabel')}</label>
                            <textarea
                                name='description'
                                data-testid='group-description-input'
                                class='w-full px-3 py-2 border border-border-default bg-surface-base text-text-primary rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary resize-none'
                                rows={3}
                                placeholder={t('createGroupModal.groupDescriptionPlaceholder')}
                                value={groupDescriptionSignal.value}
                                onInput={(e) => {
                                    groupDescriptionSignal.value = (e.target as HTMLTextAreaElement).value;
                                }}
                                disabled={isSubmitting}
                                maxLength={200}
                            />
                            <p class='mt-1 text-sm text-text-muted'>{t('createGroupModal.groupDescriptionHelpText')}</p>
                        </div>

                        {/* Error Display */}
                        {enhancedGroupsStore.errorSignal.value && (
                            <div class='bg-surface-warning border border-border-warning rounded-md p-3'>
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
                    <div class='flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-border-default'>
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
