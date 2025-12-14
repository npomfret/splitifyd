import { translateMemberRole } from '@/app/i18n/dynamic-translations';
import { GroupMember, MemberRole } from '@billsplit-wl/shared';
import { useTranslation } from 'react-i18next';

interface MemberRolesSectionProps {
    members: GroupMember[];
    memberRoleDrafts: Record<string, MemberRole>;
    onRoleChange: (memberId: string, newRole: MemberRole) => void;
}

export function MemberRolesSection({
    members,
    memberRoleDrafts,
    onRoleChange,
}: MemberRolesSectionProps) {
    const { t } = useTranslation();

    return (
        <section>
            <h3 className='text-base font-semibold text-text-primary mb-3'>{t('securitySettingsModal.memberRoles.heading')}</h3>
            <div className='space-y-3'>
                {members.map((member) => (
                    <div key={member.uid} className='flex items-center justify-between border border-border-default rounded-lg px-4 py-2'>
                        <div>
                            <div className='font-medium text-text-primary text-sm'>{member.groupDisplayName || member.uid}</div>
                            <div className='text-xs text-text-primary/60'>
                                {translateMemberRole(memberRoleDrafts[member.uid] ?? member.memberRole, t)}
                            </div>
                        </div>
                        <select
                            className='border border-border-default bg-surface-raised backdrop-blur-xs text-text-primary rounded-md px-2 py-1 text-sm focus:outline-hidden focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-colors duration-200'
                            value={memberRoleDrafts[member.uid] ?? member.memberRole}
                            onChange={(event) => onRoleChange(member.uid, event.currentTarget.value as MemberRole)}
                            aria-label={`${t('securitySettingsModal.memberRoles.heading')} ${member.groupDisplayName}`}
                        >
                            {(['admin', 'member', 'viewer'] as MemberRole[]).map((role) => (
                                <option key={role} value={role}>
                                    {translateMemberRole(role, t)}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </section>
    );
}
