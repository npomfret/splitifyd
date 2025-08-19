import { useSignal, useComputed } from '@preact/signals';
import { route } from 'preact-router';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '@/components/ui';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '@/components/ui';
import { UserPlusIcon, UserMinusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import type { User } from '@shared/shared-types.ts';
import { apiClient } from '@/app/apiClient';
import { logError } from '@/utils/browser-logger';

interface MembersListWithManagementProps {
    members: User[];
    createdBy: string;
    currentUserId: string;
    groupId: string;
    balances?: any; // GroupBalances type doesn't include balancesByCurrency yet
    loading?: boolean;
    variant?: 'default' | 'sidebar';
    onInviteClick?: () => void;
    onMemberChange?: () => void;
}

export function MembersListWithManagement({ 
    members, 
    createdBy, 
    currentUserId,
    groupId,
    balances,
    loading = false, 
    variant = 'default', 
    onInviteClick,
    onMemberChange 
}: MembersListWithManagementProps) {
    const showLeaveConfirm = useSignal(false);
    const showRemoveConfirm = useSignal(false);
    const memberToRemove = useSignal<User | null>(null);
    const isProcessing = useSignal(false);
    
    const isOwner = currentUserId === createdBy;
    const isLastMember = members.length === 1;
    
    // Check if current user has outstanding balance
    const hasOutstandingBalance = useComputed(() => {
        if (!balances?.balancesByCurrency) return false;
        
        for (const currency in balances.balancesByCurrency) {
            const currencyBalances = balances.balancesByCurrency[currency];
            const userBalance = currencyBalances[currentUserId];
            if (userBalance && Math.abs(userBalance.netBalance) > 0.01) {
                return true;
            }
        }
        return false;
    });

    // Check if a specific member has outstanding balance
    const memberHasOutstandingBalance = (memberId: string): boolean => {
        if (!balances?.balancesByCurrency) return false;
        
        for (const currency in balances.balancesByCurrency) {
            const currencyBalances = balances.balancesByCurrency[currency];
            const memberBalance = currencyBalances[memberId];
            if (memberBalance && Math.abs(memberBalance.netBalance) > 0.01) {
                return true;
            }
        }
        return false;
    };

    const handleLeaveGroup = async () => {
        if (isProcessing.value) return;
        
        try {
            isProcessing.value = true;
            await apiClient.leaveGroup(groupId);
            // Successfully left - navigation will handle the redirect
            
            // Navigate to dashboard after leaving
            route('/dashboard');
        } catch (error: any) {
            logError('Failed to leave group', error);
        } finally {
            isProcessing.value = false;
            showLeaveConfirm.value = false;
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove.value || isProcessing.value) return;
        
        try {
            isProcessing.value = true;
            await apiClient.removeGroupMember(groupId, memberToRemove.value.uid);
            // Member removed successfully
            
            // Trigger refresh of members list
            if (onMemberChange) {
                onMemberChange();
            }
        } catch (error: any) {
            logError('Failed to remove member', error);
            // Error will be logged
            logError('Failed to remove member', error);
        } finally {
            isProcessing.value = false;
            showRemoveConfirm.value = false;
            memberToRemove.value = null;
        }
    };

    const confirmRemoveMember = (member: User) => {
        memberToRemove.value = member;
        showRemoveConfirm.value = true;
    };

    const content = loading ? (
        <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
        </div>
    ) : variant === 'sidebar' ? (
        <div className="space-y-3">
            {members.map((member) => (
                <div key={member.uid} className="flex items-center gap-3 group">
                    <Avatar 
                        displayName={member.displayName || member.email || 'Unknown User'} 
                        userId={member.uid} 
                        size="sm" 
                        themeColor={member.themeColor} 
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                            {member.displayName || member.email || 'Unknown User'}
                        </p>
                        {member.uid === createdBy && <p className="text-xs text-gray-500">Admin</p>}
                    </div>
                    {isOwner && member.uid !== currentUserId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmRemoveMember(member)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            ariaLabel={`Remove ${member.displayName || 'member'}`}
                            disabled={memberHasOutstandingBalance(member.uid)}
                        >
                            <UserMinusIcon className="h-4 w-4 text-red-500" />
                        </Button>
                    )}
                </div>
            ))}
        </div>
    ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {members.map((member) => (
                <div key={member.uid} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                    <Avatar 
                        displayName={member.displayName || member.email || 'Unknown User'} 
                        userId={member.uid} 
                        size="md" 
                        themeColor={member.themeColor} 
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                            {member.displayName || member.email || 'Unknown User'}
                        </p>
                        {member.uid === createdBy && <p className="text-xs text-gray-500">Admin</p>}
                    </div>
                    {isOwner && member.uid !== currentUserId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmRemoveMember(member)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            ariaLabel={`Remove ${member.displayName || 'member'}`}
                            disabled={memberHasOutstandingBalance(member.uid)}
                        >
                            <UserMinusIcon className="h-4 w-4 text-red-500" />
                        </Button>
                    )}
                </div>
            ))}
        </div>
    );

    if (variant === 'sidebar') {
        return (
            <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-gray-900">Members</h3>
                        <div className="flex items-center gap-1">
                            {onInviteClick && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={onInviteClick}
                                    className="p-1 h-auto"
                                    ariaLabel="Invite Others"
                                >
                                    <UserPlusIcon className="h-4 w-4" />
                                </Button>
                            )}
                            {!isOwner && !isLastMember && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => showLeaveConfirm.value = true}
                                    className="p-1 h-auto"
                                    ariaLabel="Leave Group"
                                    disabled={hasOutstandingBalance.value}
                                >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4 text-gray-500" />
                                </Button>
                            )}
                        </div>
                    </div>
                    {content}
                </div>

                {/* Confirmation Dialogs */}
                <ConfirmDialog
                    isOpen={showLeaveConfirm.value}
                    title="Leave Group?"
                    message={
                        hasOutstandingBalance.value 
                            ? "You have an outstanding balance in this group. Please settle up before leaving."
                            : "Are you sure you want to leave this group? You'll need an invitation to rejoin."
                    }
                    confirmText="Leave Group"
                    cancelText="Cancel"
                    variant="warning"
                    onConfirm={handleLeaveGroup}
                    onCancel={() => showLeaveConfirm.value = false}
                    loading={isProcessing.value}
                />

                <ConfirmDialog
                    isOpen={showRemoveConfirm.value}
                    title="Remove Member?"
                    message={`Are you sure you want to remove ${memberToRemove.value?.displayName || 'this member'} from the group?`}
                    confirmText="Remove"
                    cancelText="Cancel"
                    variant="danger"
                    onConfirm={handleRemoveMember}
                    onCancel={() => {
                        showRemoveConfirm.value = false;
                        memberToRemove.value = null;
                    }}
                    loading={isProcessing.value}
                />
            </>
        );
    }

    return (
        <>
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Members</h2>
                    <div className="flex items-center gap-2">
                        {onInviteClick && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={onInviteClick}
                                className="p-2"
                                ariaLabel="Invite Others"
                            >
                                <UserPlusIcon className="h-5 w-5" />
                            </Button>
                        )}
                        {!isOwner && !isLastMember && (
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => showLeaveConfirm.value = true}
                                className="flex items-center gap-2"
                                disabled={hasOutstandingBalance.value}
                            >
                                <>
                                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                    Leave Group
                                </>
                            </Button>
                        )}
                    </div>
                </div>
                {content}
            </Card>

            {/* Confirmation Dialogs */}
            <ConfirmDialog
                isOpen={showLeaveConfirm.value}
                title="Leave Group?"
                message={
                    hasOutstandingBalance.value 
                        ? "You have an outstanding balance in this group. Please settle up before leaving."
                        : "Are you sure you want to leave this group? You'll need an invitation to rejoin."
                }
                confirmText="Leave Group"
                cancelText="Cancel"
                variant="warning"
                onConfirm={handleLeaveGroup}
                onCancel={() => showLeaveConfirm.value = false}
                loading={isProcessing.value}
            />

            <ConfirmDialog
                isOpen={showRemoveConfirm.value}
                title="Remove Member?"
                message={`Are you sure you want to remove ${memberToRemove.value?.displayName || 'this member'} from the group?`}
                confirmText="Remove"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleRemoveMember}
                onCancel={() => {
                    showRemoveConfirm.value = false;
                    memberToRemove.value = null;
                }}
                loading={isProcessing.value}
            />
        </>
    );
}