import { GroupMembershipDTO, UserId } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';
import { Alert, Button, LoadingSpinner } from '../../../ui';

interface PendingMembersSectionProps {
    pendingMembers: GroupMembershipDTO[];
    loadingPending: boolean;
    pendingError: string | null;
    pendingActionMember: string | null;
    onApprove: (memberId: UserId) => void;
    onReject: (memberId: UserId) => void;
}

export function PendingMembersSection({
    pendingMembers,
    loadingPending,
    pendingError,
    pendingActionMember,
    onApprove,
    onReject,
}: PendingMembersSectionProps) {
    const { t } = useTranslation();

    return (
        <section>
            <h3 className='text-base font-semibold text-text-primary mb-3'>{t('securitySettingsModal.pendingMembers.heading')}</h3>
            {pendingError && <Alert type='error' message={pendingError} />}
            {loadingPending && (
                <div className='flex justify-center py-6'>
                    <LoadingSpinner />
                </div>
            )}
            {!loadingPending && pendingMembers.length === 0 && (
                <p className='text-sm text-text-primary/70'>{t('securitySettingsModal.pendingMembers.empty')}</p>
            )}
            <div className='space-y-3'>
                {pendingMembers.map((member) => (
                    <div key={member.uid} className='flex items-center justify-between border border-border-default rounded-lg px-4 py-2'>
                        <div>
                            <div className='font-medium text-text-primary text-sm'>{member.groupDisplayName || member.uid}</div>
                            <div className='text-xs text-text-primary/60'>{t('securitySettingsModal.pendingMembers.requested')}</div>
                        </div>
                        <div className='flex gap-2'>
                            <Button
                                variant='primary'
                                size='sm'
                                onClick={() => onApprove(member.uid)}
                                disabled={pendingActionMember === member.uid}
                                data-testid={`pending-approve-${member.uid}`}
                            >
                                {t('securitySettingsModal.pendingMembers.approve')}
                            </Button>
                            <Button
                                variant='secondary'
                                size='sm'
                                onClick={() => onReject(member.uid)}
                                disabled={pendingActionMember === member.uid}
                                data-testid={`pending-reject-${member.uid}`}
                            >
                                {t('securitySettingsModal.pendingMembers.reject')}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
