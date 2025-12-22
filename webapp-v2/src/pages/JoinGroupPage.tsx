/**
 * Join Group Page
 *
 * Handles joining a group via share link invitation
 */

import { Button, Card, Input, LoadingSpinner, Modal, Stack, Tooltip, Typography } from '@/components/ui';
import { Clickable } from '@/components/ui/Clickable';
import { InfoCircleIcon } from '@/components/ui/icons';
import { navigationService } from '@/services/navigation.service';
import { toDisplayName } from '@billsplit-wl/shared';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useComputed } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '@/app/hooks';
import { joinGroupStore } from '../app/stores/join-group-store';
import { GroupPreview } from '../components/join-group/GroupPreview';
import { JoinButton } from '../components/join-group/JoinButton';
import { MembersPreview } from '../components/join-group/MembersPreview';
import { BaseLayout } from '@/components/layout';

interface JoinGroupPageProps {
    linkId?: string;
    matches?: any; // For route parameters
}

export function JoinGroupPage({ linkId }: JoinGroupPageProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = useComputed(() => authStore.user);
    // Note: Since this route is now protected by ProtectedRoute, user is guaranteed to be authenticated
    const { group, memberCount, loadingPreview, joining, joinSuccess, error, isAlreadyMember } = joinGroupStore;
    const memberStatus = joinGroupStore.memberStatus;
    const pendingApproval = memberStatus === 'pending';

    // Get shareToken from URL query parameters if not provided as prop
    // Support both 'shareToken' (new) and 'linkId' (legacy) query parameters for backwards compatibility
    const actualLinkId = linkId ?? (typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('shareToken') ?? new URLSearchParams(window.location.search).get('linkId'))
        : null);

    useEffect(() => {
        // Reset store on component mount
        joinGroupStore.reset();

        if (!actualLinkId) {
            // No share token provided - don't load preview
            return;
        }

        // User is guaranteed to be authenticated due to ProtectedRoute
        // Load group preview - intentionally not awaited (useEffect cannot be async)
        joinGroupStore.loadGroupPreview(actualLinkId);
    }, [actualLinkId]);

    // No auto-redirect - let user choose when to navigate

    const [displayName, setDisplayName] = useState('');
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    // Initialize display name from Firebase auth
    useEffect(() => {
        if (currentUser.value?.displayName) {
            setDisplayName(currentUser.value.displayName);
        }
    }, [currentUser.value?.displayName]);

    const handleJoinGroup = async () => {
        if (!actualLinkId) return;
        setShowNamePrompt(true);
    };

    const handleConfirmJoin = async () => {
        if (!actualLinkId) return;

        const trimmedName = displayName.trim();
        if (!trimmedName) {
            setNameError(t('joinGroupPage.displayName.errors.required'));
            return;
        }

        if (trimmedName.length < 2) {
            setNameError(t('createGroup.validation.displayNameTooShort'));
            return;
        }

        if (trimmedName.length > 50) {
            setNameError(t('createGroup.validation.displayNameTooLong'));
            return;
        }

        setNameError(null);

        try {
            const joinedGroup = await joinGroupStore.joinGroup(actualLinkId, toDisplayName(trimmedName));
            if (joinedGroup) {
                setShowNamePrompt(false);
            }
        } catch (error: unknown) {
            const errorWithCode = error as { code?: string; };
            if (errorWithCode.code === 'DISPLAY_NAME_CONFLICT') {
                setNameError(t('joinGroupPage.displayName.errors.taken'));
            }
        }
    };

    const handleCancelNamePrompt = () => {
        setShowNamePrompt(false);
        setNameError(null);
    };

    // Show error if no share token provided
    if (!actualLinkId) {
        return (
            <BaseLayout title={`${t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
                <div className='min-h-screen bg-surface-muted flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8' role='alert' aria-label={t('errors.invalidLink')}>
                            <div className='text-semantic-error mb-4'>
                                <ExclamationTriangleIcon className='w-12 h-12 mx-auto' aria-hidden='true' />
                            </div>
                            <Typography variant='heading' className='mb-2'>{t('errors.invalidLink')}</Typography>
                            <p className='text-text-muted mb-6'>{t('joinGroupPage.errors.invalidLink')}</p>
                            <Button variant='secondary' onClick={() => navigationService.goToDashboard()} className='w-full'>
                                {t('notFoundPage.goToDashboard')}
                            </Button>
                        </div>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Show loading state while loading preview
    if (loadingPreview) {
        return (
            <BaseLayout title={`${t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
                <div className='min-h-screen bg-surface-muted flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8'>
                            <LoadingSpinner size='lg' />
                            <p className='text-text-muted mt-4'>{t('joinGroupPage.loadingGroup')}</p>
                        </div>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Show error state
    if (error && !group) {
        return (
            <BaseLayout title={`${t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
                <div className='min-h-screen bg-surface-muted flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8' role='alert' aria-label={t('joinGroupPage.errors.joinFailed')}>
                            <div className='text-semantic-error mb-4'>
                                <ExclamationTriangleIcon className='w-12 h-12 mx-auto' aria-hidden='true' />
                            </div>
                            <Typography variant='heading' className='mb-2'>{t('joinGroupPage.errors.joinFailed')}</Typography>
                            <p className='text-text-muted mb-6'>{error}</p>
                            <Button variant='secondary' onClick={() => navigationService.goToDashboard()} className='w-full'>
                                {t('notFoundPage.goToDashboard')}
                            </Button>
                        </div>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Show success state
    if (joinSuccess && group) {
        return (
            <BaseLayout title={t('joinGroupPage.joinedTitle', { groupName: group.name })} headerVariant='dashboard'>
                <div className='min-h-screen bg-surface-muted flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8' role='status' aria-label={t('joinGroupPage.welcome', { groupName: group.name })}>
                            <div className='text-semantic-success mb-4'>
                                <CheckCircleIcon className='w-12 h-12 mx-auto' aria-hidden='true' />
                            </div>
                            <Typography variant='heading' className='mb-2'>{t('joinGroupPage.welcome', { groupName: group.name })}</Typography>
                            <p className='text-text-muted mb-6'>{t('joinGroupPage.joinSuccess')}</p>
                            <Stack spacing='md'>
                                <Button onClick={() => navigationService.goToGroup(group.id)} fullWidth className='py-3'>
                                    {t('joinGroupPage.goToGroup')}
                                </Button>
                                <Button variant='secondary' onClick={() => navigationService.goToDashboard()} fullWidth>
                                    {t('joinGroupPage.backToDashboard')}
                                </Button>
                            </Stack>
                        </div>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Show group preview and join option
    if (group) {
        return (
            <BaseLayout title={`${isAlreadyMember ? group.name : t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
                <div className='min-h-screen bg-surface-muted flex items-center justify-center p-4'>
                    <div className='w-full max-w-md'>
                        <div className='text-center mb-6'>
                            <Typography variant='pageTitle' className='mb-2'>{isAlreadyMember ? group.name : t('joinGroupPage.title')}</Typography>
                        </div>

                        <Stack spacing='lg'>
                            {/* Group Preview */}
                            <GroupPreview group={group} memberCount={memberCount} />

                            {/* Members Preview */}
                            <MembersPreview memberCount={memberCount} />

                            {/* Already Member Message */}
                            {isAlreadyMember && (
                                <div className='bg-interactive-primary/10 border border-interactive-primary/30 rounded-lg p-4 text-center'>
                                    <p className='text-interactive-primary font-medium mb-2'>{t('joinGroupPage.alreadyMember')}</p>
                                    <p className='text-interactive-primary text-sm'>{t('joinGroupPage.alreadyMemberDescription')}</p>
                                </div>
                            )}

                            {pendingApproval && (
                                <div className='bg-surface-warning border border-border-warning rounded-lg p-4' role='alert' aria-label={t('joinGroupPage.pendingApprovalTitle')}>
                                    <p className='text-semantic-warning font-semibold mb-2'>{t('joinGroupPage.pendingApprovalTitle')}</p>
                                    <p className='text-semantic-warning text-sm mb-3'>{t('joinGroupPage.pendingApprovalMessage', { groupName: group.name })}</p>
                                    <p className='text-semantic-warning text-xs mb-4'>{t('joinGroupPage.pendingApprovalHelp')}</p>
                                    <Button variant='secondary' onClick={() => navigationService.goToDashboard()} fullWidth>
                                        {t('joinGroupPage.backToDashboard')}
                                    </Button>
                                </div>
                            )}

                            {/* Error message if any */}
                            {error && !isAlreadyMember && (
                                <div className='bg-surface-error border border-border-error rounded-lg p-3'>
                                    <p className='text-semantic-error text-sm' role='alert'>
                                        {error}
                                    </p>
                                    <Button variant='ghost' size='sm' onClick={joinGroupStore.clearError} className='mt-2 text-semantic-error hover:text-semantic-error'>
                                        {t('common.dismiss')}
                                    </Button>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <Stack spacing='md'>
                                {isAlreadyMember
                                    ? (
                                        <Button onClick={() => navigationService.goToGroup(group.id)} fullWidth className='py-3'>
                                            {t('joinGroupPage.goToGroup')}
                                        </Button>
                                    )
                                    : <JoinButton onJoin={handleJoinGroup} loading={joining} disabled={pendingApproval} />}

                                <Button variant='secondary' onClick={() => navigationService.goToDashboard()} fullWidth>
                                    {t('joinGroupPage.cancel')}
                                </Button>
                            </Stack>
                        </Stack>
                    </div>
                </div>

                {/* Display Name Prompt Modal */}
                <Modal
                    open={showNamePrompt}
                    onClose={handleCancelNamePrompt}
                    size='sm'
                    labelledBy='display-name-modal-title'
                >
                    <div className='px-6 py-5'>
                        <Typography variant='subheading' className='mb-4' id='display-name-modal-title'>
                            {t('joinGroupPage.displayName.title')}
                        </Typography>
                        <div>
                            <label htmlFor='join-group-display-name' className='flex items-center gap-1.5 text-sm font-medium text-text-primary mb-2'>
                                {t('joinGroupPage.displayName.label')}
                                <Tooltip content={t('joinGroupPage.displayName.description', { groupName: group.name })} placement='top'>
                                    <Clickable
                                        as='button'
                                        type='button'
                                        className='text-text-muted hover:text-text-primary transition-colors p-0.5 rounded focus:outline-hidden focus:ring-2 focus:ring-interactive-primary'
                                        aria-label={t('common.moreInfo')}
                                    >
                                        <InfoCircleIcon size={16} />
                                    </Clickable>
                                </Tooltip>
                            </label>
                            <Input
                                id='join-group-display-name'
                                value={displayName}
                                onChange={(value) => {
                                    setDisplayName(value);
                                    setNameError(null);
                                }}
                                error={nameError || undefined}
                                disabled={joining}
                            />
                        </div>
                        <div className='flex flex-col gap-2 mt-4'>
                            <Button
                                onClick={handleConfirmJoin}
                                disabled={joining}
                                fullWidth
                            >
                                {joining ? t('joinGroupPage.joining') : t('joinGroupPage.joinGroup')}
                            </Button>
                            <Button
                                variant='secondary'
                                onClick={handleCancelNamePrompt}
                                disabled={joining}
                                fullWidth
                            >
                                {t('joinGroupPage.cancel')}
                            </Button>
                        </div>
                    </div>
                </Modal>
            </BaseLayout>
        );
    }

    // Fallback - shouldn't reach here
    return (
        <BaseLayout title={`${t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
            <div className='min-h-screen bg-surface-muted flex items-center justify-center p-4'>
                <Card className='w-full max-w-md'>
                    <div className='text-center py-8'>
                        <p className='text-text-muted'>Loading...</p>
                    </div>
                </Card>
            </div>
        </BaseLayout>
    );
}
