import { SidebarCard } from '@/components/ui/SidebarCard';
import type { SimplifiedDebt } from '@billsplit-wl/shared';
import { ScaleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { BalanceSummary } from '../BalanceSummary';

interface BalancesSectionProps {
    onSettleUp: (debt?: SimplifiedDebt) => void;
    defaultCollapsed?: boolean;
    idSuffix?: string;
}

export function BalancesSection({ onSettleUp, defaultCollapsed = false, idSuffix }: BalancesSectionProps) {
    const { t } = useTranslation();
    const sectionLabel = t('pages.groupDetailPage.balances');

    return (
        <SidebarCard
            id={idSuffix ? `balances-${idSuffix}` : 'balances'}
            ariaLabel={sectionLabel}
            title={
                <div className='flex items-center gap-2'>
                    <ScaleIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                    <span>{sectionLabel}</span>
                </div>
            }
            collapsible
            defaultCollapsed={defaultCollapsed}
            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: sectionLabel })}
        >
            <BalanceSummary onSettleUp={onSettleUp} />
        </SidebarCard>
    );
}
