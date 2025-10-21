/**
 * Join Group Page
 *
 * Handles joining a group via share link invitation
 */

import { navigationService } from '@/services/navigation.service';
import { useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { joinGroupStore } from '../app/stores/join-group-store';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { Card } from '@/components/ui';
import { Stack } from '@/components/ui';
import { Button } from '@/components/ui';
import { LoadingSpinner } from '@/components/ui';
import { GroupPreview } from '../components/join-group/GroupPreview';
import { JoinButton } from '../components/join-group/JoinButton';
import { MembersPreview } from '../components/join-group/MembersPreview';
import { BaseLayout } from '../components/layout/BaseLayout';
import { DisplayNameConflictModal } from '../components/join-group/DisplayNameConflictModal';

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
    const displayNameConflict = joinGroupStore.displayNameConflict;
    const joinedGroupId = joinGroupStore.joinedGroupId;
    const displayNameUpdateError = joinGroupStore.displayNameUpdateError;
    const updatingDisplayName = joinGroupStore.updatingDisplayName;
    const memberStatus = joinGroupStore.memberStatus;
    const pendingApproval = memberStatus === 'pending';

    // Get linkId from URL query parameters if not provided as prop
    const actualLinkId = linkId ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('linkId') : null);

    useEffect(() => {
        // Reset store on component mount
        joinGroupStore.reset();

        if (!actualLinkId) {
            // No link ID provided - don't load preview
            return;
        }

        // User is guaranteed to be authenticated due to ProtectedRoute
        // Load group preview - intentionally not awaited (useEffect cannot be async)
        joinGroupStore.loadGroupPreview(actualLinkId);
    }, [actualLinkId]);

    // No auto-redirect - let user choose when to navigate

    const handleJoinGroup = async () => {
        if (!actualLinkId) return;

        const joinedGroup = await joinGroupStore.joinGroup(actualLinkId);
        if (joinedGroup) {
            // Success handled by useEffect above
        }
    };

    const handleResolveDisplayName = async (newName: string) => {
        if (!joinedGroupId) return;
        await joinGroupStore.resolveDisplayNameConflict(newName);
    };

    const handleCancelConflict = () => {
        joinGroupStore.markConflictCancelled();
    };

    // Show error if no link ID provided
    if (!actualLinkId) {
        return (
            <BaseLayout title={`${t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
                <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8'>
                            <div className='text-red-500 text-4xl mb-4' role='alert' data-testid='invalid-link-warning'>
                                ⚠️
                            </div>
                            <h2 className='text-xl font-semibold text-gray-900 mb-2'>{t('errors.invalidLink')}</h2>
                            <p className='text-gray-600 mb-6'>{t('joinGroupPage.errors.invalidLink')}</p>
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
                <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8'>
                            <LoadingSpinner size='lg' />
                            <p className='text-gray-600 mt-4'>{t('joinGroupPage.loadingGroup')}</p>
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
                <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8'>
                            <div className='text-red-500 text-4xl mb-4' role='alert' data-testid='unable-join-warning'>
                                ⚠️
                            </div>
                            <h2 className='text-xl font-semibold text-gray-900 mb-2'>{t('joinGroupPage.errors.joinFailed')}</h2>
                            <p className='text-gray-600 mb-6'>{error}</p>
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
                <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4' data-join-success='true'>
                    <Card className='w-full max-w-md'>
                        <div className='text-center py-8'>
                            <div className='text-green-500 text-4xl mb-4'>✅</div>
                            <h2 className='text-xl font-semibold text-gray-900 mb-2'>{t('joinGroupPage.welcome', { groupName: group.name })}</h2>
                            <p className='text-gray-600 mb-6'>{t('joinGroupPage.joinSuccess')}</p>
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
                <DisplayNameConflictModal
                    isOpen={displayNameConflict}
                    groupName={group.name}
                    currentName={currentUser.value?.displayName || ''}
                    loading={updatingDisplayName}
                    error={displayNameUpdateError}
                    onSubmit={handleResolveDisplayName}
                    onCancel={handleCancelConflict}
                    onClearError={() => joinGroupStore.clearDisplayNameError()}
                />
            </BaseLayout>
        );
    }

    // Show group preview and join option
    if (group) {
        return (
            <BaseLayout title={`${isAlreadyMember ? group.name : t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
                <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
                    <div className='w-full max-w-md'>
                        <div className='text-center mb-6'>
                            <h1 className='text-2xl font-bold text-gray-900 mb-2'>{isAlreadyMember ? group.name : t('joinGroupPage.title')}</h1>
                        </div>

                        <Stack spacing='lg'>
                            {/* Group Preview */}
                            <GroupPreview group={group} memberCount={memberCount} />

                            {/* Members Preview */}
                            <MembersPreview memberCount={memberCount} />

                            {/* Already Member Message */}
                            {isAlreadyMember && (
                                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 text-center'>
                                    <p className='text-blue-800 font-medium mb-2'>{t('joinGroupPage.alreadyMember')}</p>
                                    <p className='text-blue-600 text-sm'>{t('joinGroupPage.alreadyMemberDescription')}</p>
                                </div>
                            )}

                            {pendingApproval && (
                                <div className='bg-amber-50 border border-amber-200 rounded-lg p-4' data-testid='pending-approval-alert'>
                                    <p className='text-amber-800 font-semibold mb-2'>{t('joinGroupPage.pendingApprovalTitle')}</p>
                                    <p className='text-amber-700 text-sm mb-3'>{t('joinGroupPage.pendingApprovalMessage', { groupName: group.name })}</p>
                                    <p className='text-amber-700 text-xs mb-4'>{t('joinGroupPage.pendingApprovalHelp')}</p>
                                    <Button variant='secondary' onClick={() => navigationService.goToDashboard()} fullWidth>
                                        {t('joinGroupPage.backToDashboard')}
                                    </Button>
                                </div>
                            )}

                            {/* Error message if any */}
                            {error && !isAlreadyMember && (
                                <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
                                    <p className='text-red-700 text-sm' role='alert' data-testid='join-group-error-message'>
                                        {error}
                                    </p>
                                    <Button variant='ghost' size='sm' onClick={joinGroupStore.clearError} className='mt-2 text-red-600 hover:text-red-700'>
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
                                    : (
                                        <JoinButton onJoin={handleJoinGroup} loading={joining} disabled={pendingApproval} />
                                    )}

                                <Button variant='secondary' onClick={() => navigationService.goToDashboard()} fullWidth>
                                    {t('joinGroupPage.cancel')}
                                </Button>
                            </Stack>
                        </Stack>
                    </div>
                </div>
                <DisplayNameConflictModal
                    isOpen={displayNameConflict}
                    groupName={group.name}
                    currentName={currentUser.value?.displayName || ''}
                    loading={updatingDisplayName}
                    error={displayNameUpdateError}
                    onSubmit={handleResolveDisplayName}
                    onCancel={handleCancelConflict}
                    onClearError={() => joinGroupStore.clearDisplayNameError()}
                />
            </BaseLayout>
        );
    }

    // Fallback - shouldn't reach here
    return (
        <BaseLayout title={`${t('joinGroupPage.title')}${t('common.titleSuffix')}`} headerVariant='dashboard'>
            <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
                <Card className='w-full max-w-md'>
                    <div className='text-center py-8'>
                        <p className='text-gray-600'>Loading...</p>
                    </div>
                </Card>
            </div>
        </BaseLayout>
    );
}
