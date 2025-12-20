import { themeStore } from '@/app/stores/theme-store.ts';
import { CopyIcon } from '@/components/ui/icons';
import { iconButton, listItem } from '@/components/ui/styles';
import { cx } from '@/utils/cx';
import { getGroupDisplayName } from '@/utils/displayName';
import { DELETED_AT_FIELD, ExpenseDTO, GroupMember } from '@billsplit-wl/shared';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, CurrencyAmount, RelativeTime, Tooltip } from '../ui';
import { Clickable } from '../ui/Clickable';

interface ExpenseItemProps {
    expense: ExpenseDTO;
    members: GroupMember[];
    onClick?: (expense: ExpenseDTO) => void;
    onCopy?: (expense: ExpenseDTO) => void;
}

export function ExpenseItem({ expense, members, onClick, onCopy }: ExpenseItemProps) {
    const { t } = useTranslation();
    const paidByUser = members.find((m) => m.uid === expense.paidBy);
    if (!paidByUser) {
        throw new Error(`ExpenseItem: member ${expense.paidBy} not found`);
    }
    const payerName = getGroupDisplayName(paidByUser);
    const isDeleted = expense[DELETED_AT_FIELD] !== null && expense[DELETED_AT_FIELD] !== undefined;
    const deletedByUser = expense.deletedBy ? members.find((m) => m.uid === expense.deletedBy) : null;
    const deletedByName = deletedByUser ? getGroupDisplayName(deletedByUser) : t('common.unknown');

    // Get theme colors for the payer
    const paidByTheme = paidByUser?.themeColor || themeStore.getThemeForUser(expense.paidBy);

    const handleCopyClick = (e: Event) => {
        e.stopPropagation(); // Prevent expense detail navigation
        onCopy?.(expense);
    };

    return (
        <article
            className={cx(listItem.clickable, isDeleted && listItem.deleted)}
            onClick={() => onClick?.(expense)}
            aria-label={expense.description}
        >
            {/* Top row: Avatar, Description, Amount, Copy button */}
            <div className='flex justify-between items-start gap-4'>
                <div className='flex items-center gap-3 flex-1 min-w-0'>
                    <Avatar displayName={payerName} userId={expense.paidBy} size='sm' themeColor={paidByTheme} />
                    <div className='flex items-center gap-2 min-w-0'>
                        <p className={cx('font-medium text-sm truncate', isDeleted ? listItem.deletedText : 'text-text-primary')}>{expense.description}</p>
                        {isDeleted && (
                            <Badge variant='deleted' className='shrink-0'>
                                {t('expenseItem.deleted')}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                    <div className='text-end'>
                        <p className={`font-semibold text-base ${isDeleted ? 'text-text-muted' : 'text-text-primary'}`}>
                            <CurrencyAmount amount={expense.amount} currency={expense.currency} />
                        </p>
                        {expense.labels.length > 0 && <p className='help-text-xs text-text-muted/70'>{expense.labels.join(', ')}</p>}
                    </div>

                    {!isDeleted && onCopy && (
                        <Tooltip content={t('expenseItem.copyExpense')}>
                            <Clickable
                                onClick={handleCopyClick}
                                className={iconButton.ghostReveal}
                                aria-label={t('expenseItem.copyExpense')}
                                eventName='expense_copy'
                                eventProps={{ expenseId: expense.id, labels: expense.labels }}
                            >
                                <CopyIcon size={16} />
                            </Clickable>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Bottom row: Paid by, date, comment count - full width */}
            <p className='text-xs text-text-primary/70 mt-1'>
                {t('expenseItem.paidBy')} <span className='font-medium text-text-primary/80'>{payerName}</span> •{' '}
                <RelativeTime date={expense.date} className='text-text-muted/70' tooltipPlacement='bottom' />
                {expense.commentCount && expense.commentCount > 0 && (
                    <span
                        className='inline-flex items-center gap-0.5 text-text-muted ml-1'
                        aria-label={t('expenseItem.hasComments', { count: expense.commentCount })}
                    >
                        • <ChatBubbleLeftIcon className='w-3 h-3' aria-hidden='true' />
                        <span>{expense.commentCount}</span>
                    </span>
                )}
                {isDeleted && expense.deletedAt && (
                    <span className='ml-2 text-semantic-error'>
                        • {t('expenseItem.deletedBy')} {deletedByName} <RelativeTime date={expense.deletedAt} className='text-semantic-error' />
                    </span>
                )}
            </p>
        </article>
    );
}
