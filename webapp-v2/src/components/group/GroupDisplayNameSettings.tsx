import { apiClient, ApiError } from '@/app/apiClient';
import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useComputed } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface GroupDisplayNameSettingsProps {
    groupId: string;
}

export function GroupDisplayNameSettings({ groupId }: GroupDisplayNameSettingsProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    const members = useComputed(() => enhancedGroupDetailStore.members);
    const loadingMembers = useComputed(() => enhancedGroupDetailStore.loadingMembers);

    const [displayName, setDisplayName] = useState('');
    const [initialName, setInitialName] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const successTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (successTimerRef.current) {
                window.clearTimeout(successTimerRef.current);
                successTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const uid = currentUser.value?.uid;
        if (!uid) return;

        const member = members.value.find((m) => m.uid === uid);
        if (!member) return;

        const fallbackName = (member.groupDisplayName ?? '').trim() || member.displayName || currentUser.value?.displayName || '';

        setDisplayName(fallbackName);
        setInitialName(fallbackName);
        setValidationError(null);
        setServerError(null);
    }, [members.value, currentUser.value]);

    const handleInputChange = (value: string) => {
        setDisplayName(value);
        if (validationError) {
            setValidationError(null);
        }
        if (serverError) {
            setServerError(null);
        }
        if (successMessage) {
            setSuccessMessage(null);
        }
    };

    const handleSubmit = async (event: Event) => {
        event.preventDefault();
        const trimmedName = displayName.trim();

        if (!trimmedName) {
            setValidationError(t('groupDisplayNameSettings.errors.required'));
            return;
        }

        if (trimmedName.length > 50) {
            setValidationError(t('groupDisplayNameSettings.errors.tooLong'));
            return;
        }

        if (trimmedName === initialName) {
            setValidationError(t('groupDisplayNameSettings.errors.notChanged'));
            return;
        }

        setIsSaving(true);
        setValidationError(null);
        setServerError(null);
        setSuccessMessage(null);

        try {
            await apiClient.updateGroupMemberDisplayName(groupId, trimmedName);
            await enhancedGroupDetailStore.refreshAll();

            setInitialName(trimmedName);
            setSuccessMessage(t('groupDisplayNameSettings.success'));
            if (successTimerRef.current) {
                window.clearTimeout(successTimerRef.current);
            }
            successTimerRef.current = window.setTimeout(() => {
                setSuccessMessage(null);
                successTimerRef.current = null;
            }, 4000);
        } catch (error: unknown) {
            if (error instanceof ApiError && error.code === 'DISPLAY_NAME_TAKEN') {
                setServerError(t('groupDisplayNameSettings.errors.taken'));
            } else if (error instanceof ApiError) {
                setServerError(error.message || t('groupDisplayNameSettings.errors.unknown'));
            } else {
                setServerError(t('groupDisplayNameSettings.errors.unknown'));
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentUser.value) {
        return null;
    }

    const groupMember = members.value.find((member) => member.uid === currentUser.value?.uid);
    if (!groupMember) {
        if (loadingMembers.value) {
            return (
                <Card className='p-5 space-y-3'>
                    <div className='h-4 bg-gray-100 animate-pulse rounded' aria-hidden='true'></div>
                    <div className='h-10 bg-gray-100 animate-pulse rounded' aria-hidden='true'></div>
                </Card>
            );
        }
        return null;
    }

    const isDirty = displayName.trim() !== initialName;

    return (
        <Card className='p-5 space-y-4' data-testid='group-display-name-settings'>
            <div>
                <h3 className='text-sm font-semibold text-gray-900'>{t('groupDisplayNameSettings.title')}</h3>
                <p className='text-sm text-gray-600 mt-1'>{t('groupDisplayNameSettings.description')}</p>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
                <Input
                    label={t('groupDisplayNameSettings.inputLabel')}
                    placeholder={t('groupDisplayNameSettings.inputPlaceholder')}
                    value={displayName}
                    onChange={handleInputChange}
                    disabled={isSaving}
                    error={validationError || undefined}
                    data-testid='group-display-name-input'
                />

                {serverError && (
                    <div className='bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-800' role='alert' data-testid='group-display-name-error'>
                        {serverError}
                    </div>
                )}

                {successMessage && (
                    <div className='bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800' role='status' data-testid='group-display-name-success'>
                        {successMessage}
                    </div>
                )}

                <Button type='submit' disabled={isSaving || !isDirty} fullWidth>
                    {isSaving ? t('groupDisplayNameSettings.saving') : t('groupDisplayNameSettings.save')}
                </Button>
            </form>
        </Card>
    );
}
