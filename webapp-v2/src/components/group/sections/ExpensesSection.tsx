import { SidebarCard } from '@/components/ui/SidebarCard';
import type { ExpenseDTO } from '@billsplit-wl/shared';
import { ReceiptPercentIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ExpensesList } from '../ExpensesList';

interface ExpensesSectionProps {
    onExpenseClick: (expense: ExpenseDTO) => void;
    onExpenseCopy: (expense: ExpenseDTO) => void;
    canToggleShowDeleted: boolean;
    showDeletedExpenses: boolean;
    onShowDeletedChange?: (show: boolean) => void;
    defaultCollapsed?: boolean;
}

export function ExpensesSection({
    onExpenseClick,
    onExpenseCopy,
    canToggleShowDeleted,
    showDeletedExpenses,
    onShowDeletedChange,
    defaultCollapsed = false,
}: ExpensesSectionProps) {
    const { t } = useTranslation();
    const sectionLabel = t('pages.groupDetailPage.expenses');

    return (
        <SidebarCard
            id='expenses'
            ariaLabel={sectionLabel}
            title={
                <div className='flex items-center gap-2'>
                    <ReceiptPercentIcon className='h-5 w-5 text-text-muted' aria-hidden='true' />
                    <span>{sectionLabel}</span>
                </div>
            }
            collapsible
            defaultCollapsed={defaultCollapsed}
            collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: sectionLabel })}
        >
            <ExpensesList
                onExpenseClick={onExpenseClick}
                onExpenseCopy={onExpenseCopy}
                canToggleShowDeleted={canToggleShowDeleted}
                showDeletedExpenses={showDeletedExpenses}
                onShowDeletedChange={onShowDeletedChange}
            />
        </SidebarCard>
    );
}
