import { ApiError } from '@/app/apiClient';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced.ts';
import { Clickable } from '@/components/ui/Clickable';
import { XCircleIcon, XIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { logInfo } from '@/utils/browser-logger';
import { CreateGroupRequest, GroupId, toDisplayName, toGroupName } from '@billsplit-wl/shared';
import { signal, useComputed } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Stack, Tooltip, Typography } from '../ui';

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

    const trimmedGroupName = groupNameSignal.value.trim();
    const trimmedDisplayName = groupDisplayNameSignal.value.trim();
    const isFormValid = trimmedGroupName.length >= 2
        && trimmedDisplayName.length >= 2
        && trimmedDisplayName.length <= 50
        && DISPLAY_NAME_PATTERN.test(trimmedDisplayName);

    return (
        <Modal
            open={isOpen}
            onClose={isSubmitting ? undefined : onClose}
            size='sm'
            labelledBy='create-group-modal-title'
        >
            {/* Modal Header */}
            <div class='flex items-center justify-between px-6 py-4 border-b border-border-default'>
                <Typography variant="subheading" id="create-group-modal-title">
                    {t('createGroupModal.title')}
                </Typography>
                <Tooltip content={t('createGroupModal.closeButtonAriaLabel')}>
                    <Clickable
                        as='button'
                        type='button'
                        onClick={() => {
                            emitModalDebugLog('[CreateGroupModal] Closing modal: X button clicked', {
                                isSubmitting,
                            });
                            onClose();
                        }}
                        className='text-text-muted hover:text-text-primary transition-colors rounded-full p-1 hover:bg-surface-muted'
                        disabled={isSubmitting}
                        aria-label={t('createGroupModal.closeButtonAriaLabel')}
                        eventName='modal_close'
                        eventProps={{ modalName: 'create_group', method: 'x_button' }}
                    >
<XIcon size={20} />
                    </Clickable>
                </Tooltip>
            </div>

            {/* Modal Content */}
            <Form onSubmit={handleSubmit}>
                <div class='max-h-[70vh] overflow-y-auto px-6 py-5'>
                    <Stack spacing='lg'>
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
                            <label for='group-description' class='block text-sm font-medium text-text-primary mb-2'>{t('createGroupModal.groupDescriptionLabel')}</label>
                            <textarea
                                id='group-description'
                                name='description'
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
<XCircleIcon size={20} className='text-semantic-error' />
                                    </div>
                                    <div class='ml-3'>
                                        <p class='text-sm text-semantic-error' role='alert'>
                                            {enhancedGroupsStore.errorSignal.value}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Stack>
                </div>

                {/* Modal Footer */}
                <div class='flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default'>
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
        </Modal>
    );
}
