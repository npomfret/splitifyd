import { useAuthRequired } from '@/app/hooks/useAuthRequired';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { themeStore } from '@/app/stores/theme-store';
import { Checkbox, CurrencyAmount, Tooltip } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { Clickable } from '@/components/ui/Clickable';
import { ArrowDownIcon, ArrowRightIcon, BanknotesIcon } from '@/components/ui/icons';
import { iconButton } from '@/components/ui/styles';
import { cx } from '@/utils/cx';
import { getGroupDisplayName } from '@/utils/displayName';
import type { SimplifiedDebt, UserId } from '@billsplit-wl/shared';
import { useComputed, useSignal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

interface BalanceSummaryProps {
    onSettleUp?: (debt: SimplifiedDebt) => void;
}

export function BalanceSummary({ onSettleUp }: BalanceSummaryProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const currentUser = authStore.user;
    const showAllBalances = useSignal(false);

    // Fetch data directly from the store
    const balances = useComputed(() => enhancedGroupDetailStore.balances);
    const members = useComputed(() => enhancedGroupDetailStore.members);

    // Helper to get user display name
    const getUserName = (userId: UserId) => {
        const member = members.value.find((m) => m.uid === userId);
        if (!member) {
            throw new Error(`BalanceSummary: member ${userId} not found`);
        }
        return getGroupDisplayName(member);
    };

    const renderMemberName = (userId: UserId) => {
        const name = getUserName(userId);
        const isCurrentUser = currentUser?.uid === userId;

        return (
            <>
                {name}
                {isCurrentUser && <span className='text-text-muted ml-1'>({t('common.you')})</span>}
            </>
        );
    };

    // Filter and group debts by currency - memoized to avoid recalculation
    const groupedDebts = useMemo(() => {
        if (!balances.value?.simplifiedDebts) return [];

        // Filter debts based on user preference - show only user's debts by default
        const filteredDebts = !showAllBalances.value && currentUser
            ? balances.value.simplifiedDebts.filter(debt => debt.from.uid === currentUser.uid || debt.to.uid === currentUser.uid)
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

    const content = !balances.value
        ? <p className='text-text-muted text-sm'>{t('balanceSummary.loadingBalances')}</p>
        : groupedDebts.length === 0 || groupedDebts.every(g => g.debts.length === 0)
        ? <p className='text-text-muted text-sm'>{t('balanceSummary.allSettledUp')}</p>
        : (
            <div className='space-y-2 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-border-default scrollbar-track-transparent hover:scrollbar-thumb-border-strong'>
                {groupedDebts.map(({ currency, debts }) => (
                    debts.map((debt) => {
                        const isCurrentUserFrom = currentUser && debt.from.uid === currentUser.uid;

                        // Get members for avatar theme colors
                        const fromMember = members.value.find((m) => m.uid === debt.from.uid);
                        const toMember = members.value.find((m) => m.uid === debt.to.uid);
                        const payerTheme = fromMember?.themeColor || themeStore.getThemeForUser(debt.from.uid);
                        const payeeTheme = toMember?.themeColor || themeStore.getThemeForUser(debt.to.uid);

                        return (
                            <article
                                key={`${debt.from.uid}-${debt.to.uid}-${currency}`}
                                className='group border border-border-default/50 rounded-lg px-3 py-2.5 mb-2 last:mb-0 backdrop-blur-xs transition-all duration-200 hover:border-interactive-primary/40 hover:-translate-y-0.5 hover:shadow-sm relative bg-surface-subtle'
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
                                        <span className='text-sm font-semibold text-text-primary truncate'>
                                            {renderMemberName(debt.from.uid)}
                                        </span>
                                    </div>

                                    {/* Row 2: Down arrow only */}
                                    <div className='row-start-2 flex items-center justify-center self-stretch'>
                                        <div className='flex items-center justify-center w-6 h-full text-text-muted/80'>
                                            <ArrowDownIcon size={12} className='text-text-muted/80' />
                                        </div>
                                    </div>
                                    <div className='row-start-2 col-start-2 flex items-center gap-2 w-full min-w-0'>
                                        <div className='flex items-center gap-1 flex-1'>
                                            <span className='help-text-xs'>{t('balanceSummary.owes')}</span>
                                            <CurrencyAmount
                                                amount={debt.amount}
                                                currency={debt.currency}
                                                className='text-base font-bold tabular-nums text-text-primary'
                                                displayOptions={{ includeCurrencyCode: false }}
                                                data-financial-amount='debt'
                                            />
                                            <span className='help-text-xs'>{t('balanceSummary.to')}</span>
                                        </div>
                                        {/* Settlement button - only show if current user owes this debt and onSettleUp is provided */}
                                        {isCurrentUserFrom && onSettleUp && (
                                            <Tooltip content={t('balanceSummary.settleUpButton')}>
                                                <Clickable
                                                    as='button'
                                                    onClick={() => onSettleUp(debt)}
                                                    className={cx(iconButton.primary, 'shrink-0 flex items-center gap-1')}
                                                    aria-label={t('balanceSummary.settleUpButton')}
                                                    eventName='settle_up_click'
                                                    eventProps={{
                                                        fromUserId: debt.from.uid,
                                                        toUserId: debt.to.uid,
                                                        amount: debt.amount,
                                                    }}
                                                >
                                                    <ArrowRightIcon size={16} />
                                                    <BanknotesIcon size={16} />
                                                </Clickable>
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
                                        <span className='text-sm font-semibold text-text-primary truncate'>
                                            {renderMemberName(debt.to.uid)}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                ))}
            </div>
        );

    return (
        <div>
            {content}
            {/* Show all balances toggle - at bottom, right aligned */}
            <div className='flex justify-end mt-4'>
                <Checkbox
                    label={t('balanceSummary.showAll')}
                    checked={showAllBalances.value}
                    onChange={(checked) => showAllBalances.value = checked}
                />
            </div>
        </div>
    );
}
