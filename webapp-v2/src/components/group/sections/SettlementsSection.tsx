import { SettlementHistory } from '@/components/settlements';
import { SidebarCard } from '@/components/ui/SidebarCard';
import type { GroupId, SettlementWithMembers } from '@billsplit-wl/shared';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface SettlementsSectionProps {
    groupId: GroupId;
    onEditSettlement: (settlement: SettlementWithMembers) => void;
    canToggleShowDeleted: boolean;
    showDeletedSettlements: boolean;
    onShowDeletedChange?: (show: boolean) => void;
    defaultCollapsed?: boolean;
    idSuffix?: string;
}

export function SettlementsSection({
    groupId,
    onEditSettlement,
    canToggleShowDeleted,
    showDeletedSettlements,
    onShowDeletedChange,
    defaultCollapsed = true,
    idSuffix,
}: SettlementsSectionProps) {
    const { t } = useTranslation();
    const sectionLabel = t('pages.groupDetailPage.paymentHistory');

    return (
        <SidebarCard
            id={idSuffix ? `settlements-${idSuffix}` : 'settlements'}
            ariaLabel={sectionLabel}
            title={
                <div className='flex items-center gap-2'>
                    <BanknotesIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                    <span>{sectionLabel}</span>
                </div>
            }
            collapsible
            defaultCollapsed={defaultCollapsed}
            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: sectionLabel })}
        >
            <SettlementHistory
                groupId={groupId}
                onEditSettlement={onEditSettlement}
                canToggleShowDeleted={canToggleShowDeleted}
                showDeletedSettlements={showDeletedSettlements}
                onShowDeletedChange={onShowDeletedChange}
            />
        </SidebarCard>
    );
}
