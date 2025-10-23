import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { themeStore } from '@/app/stores/theme-store';
import { CurrencyAmount, SidebarCard, Tooltip } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { getGroupDisplayName } from '@/utils/displayName';
import { useComputed, useSignal } from '@preact/signals';
import type { SimplifiedDebt } from '@splitifyd/shared';
import { useMemo } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { BanknotesIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { Card } from '../ui/Card';

interface BalanceSummaryProps {
    variant?: 'default' | 'sidebar';
    onSettleUp?: (debt: SimplifiedDebt) => void;
}

export function BalanceSummary({ variant = 'default', onSettleUp }: BalanceSummaryProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = authStore.user;
    const showAllBalances = useSignal(false);

    // Fetch data directly from the store
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const members = useComputed(() => enhancedGroupDetailStore.members);

    // Helper to get user display name
    const getUserName = (userId: string) => {
        const member = members.value.find((m) => m.uid === userId);
        if (!member) {
            throw new Error(`BalanceSummary: member ${userId} not found`);
        }
        return getGroupDisplayName(member);
    };

    const renderMemberName = (userId: string) => {
        const name = getUserName(userId);
        const isCurrentUser = currentUser?.uid === userId;

        return (
            <>
                {name}
                {isCurrentUser && <span className='text-gray-500 ml-1'>({t('common.you')})</span>}
            </>
        );
    };

    // Filter and group debts by currency - memoized to avoid recalculation
    const groupedDebts = useMemo(() => {
        if (!balances.value?.simplifiedDebts) return [];

        // Filter debts based on user preference - show only user's debts by default
        const filteredDebts = !showAllBalances.value && currentUser
            ? balances.value.simplifiedDebts.filter(debt =>
                debt.from.uid === currentUser.uid || debt.to.uid === currentUser.uid
              )
            : balances.value.simplifiedDebts;

        const grouped = filteredDebts.reduce(
            (acc, debt) => {
                const currency = debt.currency;
                if (!acc[currency]) {
                    acc[currency] = [];
                }
                acc[currency].push(debt);
                return acc;
            },
            {} as Record<string, SimplifiedDebt[]>,
        );

        // Sort currencies: USD first, then alphabetically
        const sortedCurrencies = Object.keys(grouped).sort((a, b) => {
            if (a === 'USD') return -1;
            if (b === 'USD') return 1;
            return a.localeCompare(b);
        });

        return sortedCurrencies.map((currency) => ({
            currency,
            debts: grouped[currency],
        }));
    }, [balances.value?.simplifiedDebts, showAllBalances.value, currentUser]);

    const testIdPrefix = variant === 'sidebar' ? 'sidebar-' : '';

    const content = !balances.value
        ? <p className='text-gray-600 text-sm' data-testid={`${testIdPrefix}balance-loading`}>{t('balanceSummary.loadingBalances')}</p>
        : groupedDebts.length === 0 || groupedDebts.every(g => g.debts.length === 0)
        ? <p className='text-gray-600 text-sm' data-testid={`${testIdPrefix}balance-settled-up`}>{t('balanceSummary.allSettledUp')}</p>
        : (
            <div className='space-y-2 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400' data-testid={`${testIdPrefix}balance-debts-list`}>
                {groupedDebts.map(({ currency, debts }) => (
                    debts.map((debt) => {
                        const isCurrentUserFrom = currentUser && debt.from.uid === currentUser.uid;
                        const isCurrentUserTo = currentUser && debt.to.uid === currentUser.uid;
                        const isCurrentUserInvolved = isCurrentUserFrom || isCurrentUserTo;

                        // Get members for theme colors
                        const fromMember = members.value.find((m) => m.uid === debt.from.uid);
                        const toMember = members.value.find((m) => m.uid === debt.to.uid);

                        // Get theme color for the payer (from person)
                        const payerTheme = fromMember?.themeColor || themeStore.getThemeForUser(debt.from.uid);
                        const payeeTheme = toMember?.themeColor || themeStore.getThemeForUser(debt.to.uid);
                        const isDark = themeStore.isDarkMode;
                        const themeColor = payerTheme ? (isDark ? payerTheme.dark : payerTheme.light) : '#6B7280';

                        return (
                            <div
                                key={`${debt.from.uid}-${debt.to.uid}-${currency}`}
                                data-testid='debt-item'
                                className='group border-b last:border-0 pb-3 last:pb-0 -mx-2 px-2 py-2 rounded relative hover:bg-gray-50'
                                style={{
                                    borderLeftWidth: '4px',
                                    borderLeftColor: themeColor,
                                    backgroundColor: isCurrentUserInvolved ? `${themeColor}08` : 'transparent',
                                }}
                            >
                                <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-start'>
                                    {/* Row 1: From person avatar and name */}
                                    <div className='row-start-1 flex items-center'>
                                        <Avatar
                                            displayName={getUserName(debt.from.uid)}
                                            userId={debt.from.uid}
                                            size='sm'
                                            themeColor={payerTheme || undefined}
                                        />
                                    </div>
                                    <div className='row-start-1 col-start-2 flex items-center gap-2 min-w-0'>
                                        <span className='text-sm font-semibold text-gray-900 truncate'>
                                            {renderMemberName(debt.from.uid)}
                                        </span>
                                    </div>

                                    {/* Row 2: Down arrow only */}
                                    <div className='row-start-2 flex items-center justify-center self-stretch'>
                                        <div className='flex items-center justify-center w-6 h-full text-gray-400'>
                                            <svg className='w-3 h-3 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 14l-7 7m0 0l-7-7m7 7V3' />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className='row-start-2 col-start-2 flex items-center gap-2 w-full min-w-0'>
                                        <div className='flex items-center gap-1 flex-1'>
                                            <span className='text-xs text-gray-500'>owes</span>
                                            <CurrencyAmount
                                                amount={debt.amount}
                                                currency={debt.currency}
                                                className='text-base font-bold tabular-nums text-gray-900'
                                                displayOptions={{ includeCurrencyCode: false }}
                                                data-financial-amount='debt'
                                            />
                                            <span className='text-xs text-gray-500'>to</span>
                                        </div>
                                        {/* Settlement button - only show if current user owes this debt and onSettleUp is provided */}
                                        {isCurrentUserFrom && onSettleUp && (
                                            <Tooltip content={t('balanceSummary.settleUpButton')}>
                                                <button
                                                    type='button'
                                                    onClick={() => onSettleUp(debt)}
                                                    className='p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex-shrink-0 flex items-center gap-1'
                                                    aria-label={t('balanceSummary.settleUpButton')}
                                                >
                                                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7l5 5m0 0l-5 5m5-5H6' />
                                                    </svg>
                                                    <BanknotesIcon className='w-4 h-4' aria-hidden='true' />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>

                                    {/* Row 3: To person avatar and name */}
                                    <div className='row-start-3 flex items-center'>
                                        <Avatar
                                            displayName={getUserName(debt.to.uid)}
                                            userId={debt.to.uid}
                                            size='sm'
                                            themeColor={payeeTheme || undefined}
                                        />
                                    </div>
                                    <div className='row-start-3 col-start-2 flex items-center gap-2 min-w-0'>
                                        <span className='text-sm font-semibold text-gray-900 truncate'>
                                            {renderMemberName(debt.to.uid)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ))}
            </div>
        );

    if (variant === 'sidebar') {
        return (
            <SidebarCard
                title={
                    <div className='flex items-center gap-2'>
                        <ScaleIcon className='h-5 w-5 text-gray-600' aria-hidden='true' />
                        <span>{t('balanceSummary.title')}</span>
                    </div>
                }
                data-testid='balance-summary-sidebar'
                collapsible
                collapseToggleTestId='toggle-balance-section'
                collapseToggleLabel={t('pages.groupDetailPage.toggleSection', { section: t('balanceSummary.title') })}
            >
                {/* Filter toggle */}
                <div className='pb-2 border-b border-gray-200 mb-2'>
                    <label className='flex items-center space-x-2 text-sm cursor-pointer'>
                        <input
                            type='checkbox'
                            checked={showAllBalances.value}
                            onChange={(e) => showAllBalances.value = e.currentTarget.checked}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                            autoComplete='off'
                        />
                        <span className='text-gray-700'>{t('balanceSummary.showAll')}</span>
                    </label>
                </div>
                {content}
            </SidebarCard>
        );
    }

    return (
        <Card className='p-6' data-testid='balance-summary-main'>
            <div className='flex items-center justify-between mb-4'>
                <h2 className='text-lg font-semibold'>{t('balanceSummary.title')}</h2>
                {/* Filter toggle for non-sidebar variant */}
                <label className='flex items-center space-x-2 text-sm cursor-pointer'>
                    <input
                        type='checkbox'
                        checked={showAllBalances.value}
                        onChange={(e) => showAllBalances.value = e.currentTarget.checked}
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        autoComplete='off'
                    />
                    <span className='text-gray-700'>{t('balanceSummary.showAll')}</span>
                </label>
            </div>
            {content}
        </Card>
    );
}
