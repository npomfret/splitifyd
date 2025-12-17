import { usePayerSelector } from '@/app/hooks/usePayerSelector';
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons';
import { getGroupDisplayName } from '@/utils/displayName';
import { toUserId, UserId } from '@billsplit-wl/shared';
import { useMemo } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Avatar, Card } from '../ui';
import { Stack } from '../ui/Stack';
import type { ExpenseFormMember } from './types';

interface PayerSelectorProps {
    members: ExpenseFormMember[];
    paidBy: UserId | '';
    validationErrors: any;
    updateField: (field: string, value: any) => void;
}

export function PayerSelector({ members, paidBy, validationErrors, updateField }: PayerSelectorProps) {
    const { t } = useTranslation();
    const inputId = useMemo(() => `payer-selector-${Math.random().toString(36).substr(2, 9)}`, []);

    const {
        isOpen,
        searchTerm,
        highlightedIndex,
        filteredMembers,
        dropdownRef,
        searchInputRef,
        triggerRef,
        toggle,
        selectItem,
        handleSearchChange,
        handleKeyDown,
        setHighlightedIndex,
    } = usePayerSelector({
        members,
        onPayerChange: (payerId) => updateField('paidBy', payerId),
    });

    const selectedMember = useMemo(() => members.find((m) => m.uid === paidBy), [members, paidBy]);

    const hasError = !!validationErrors.paidBy;

    return (
        <Card variant='glass' className='border-border-default relative z-10 overflow-visible!' ariaLabel={t('expenseComponents.payerSelector.label')}>
            <Stack spacing='md'>
                <label htmlFor={inputId} className='text-lg font-semibold text-text-primary'>
                    {t('expenseComponents.payerSelector.label')}{' '}
                    <span className='text-semantic-error' data-testid='required-indicator'>
                        {t('expenseComponents.payerSelector.requiredIndicator')}
                    </span>
                </label>

                <div className='relative'>
                    {/* Trigger button */}
                    <button
                        ref={triggerRef}
                        id={inputId}
                        type='button'
                        onClick={toggle}
                        onKeyDown={handleKeyDown}
                        className={`
                            flex items-center justify-between w-full px-3 py-2.5
                            border rounded-md
                            transition-colors duration-200
                            bg-surface-raised backdrop-blur-xs text-text-primary cursor-pointer
                            hover:bg-surface-muted
                            focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-interactive-primary
                            ${hasError ? 'border-border-error' : 'border-border-default'}
                        `}
                        aria-expanded={isOpen}
                        aria-haspopup='listbox'
                        aria-controls={`${inputId}-listbox`}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? `${inputId}-error` : undefined}
                    >
                        <div className='flex items-center gap-3'>
                            {selectedMember
                                ? (
                                    <>
                                        <Avatar displayName={getGroupDisplayName(selectedMember)} userId={toUserId(selectedMember.uid)} size='sm' />
                                        <span className='text-sm font-medium'>{getGroupDisplayName(selectedMember)}</span>
                                    </>
                                )
                                : <span className='help-text'>{t('expenseComponents.payerSelector.selectPayer')}</span>}
                        </div>
                        <ChevronDownIcon
                            size={16}
                            className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            id={`${inputId}-listbox`}
                            role='listbox'
                            aria-label={t('expenseComponents.payerSelector.membersList')}
                            className='absolute z-50 mt-1 w-full bg-surface-base shadow-lg max-h-64 rounded-md overflow-hidden ring-1 ring-black ring-opacity-5'
                        >
                            {/* Search input */}
                            <div className='sticky top-0 bg-surface-base border-b border-border-default p-2'>
                                <input
                                    ref={searchInputRef}
                                    type='text'
                                    value={searchTerm}
                                    onInput={handleSearchChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder={t('expenseComponents.payerSelector.searchPlaceholder')}
                                    className='w-full px-3 py-1.5 text-sm border border-border-default rounded-md bg-surface-raised focus:outline-hidden focus:ring-1 focus:ring-interactive-primary'
                                    aria-label={t('expenseComponents.payerSelector.searchPlaceholder')}
                                />
                            </div>

                            {/* Member list */}
                            <div className='overflow-auto max-h-52'>
                                {filteredMembers.length === 0
                                    ? (
                                        <div className='px-3 py-4 help-text text-center' role='status'>
                                            {t('expenseComponents.payerSelector.noResults')}
                                        </div>
                                    )
                                    : (
                                        filteredMembers.map((member, index) => {
                                            const isHighlighted = highlightedIndex === index;
                                            const isSelected = paidBy === member.uid;

                                            return (
                                                <button
                                                    key={member.uid}
                                                    type='button'
                                                    role='option'
                                                    aria-selected={isSelected}
                                                    onClick={() => selectItem(member)}
                                                    onMouseEnter={() => setHighlightedIndex(index)}
                                                    className={`
                                                        w-full text-start px-3 py-2 text-sm
                                                        flex items-center gap-3
                                                        transition-colors duration-100
                                                        ${isHighlighted ? 'bg-interactive-primary text-interactive-primary-foreground' : 'hover:bg-surface-muted text-text-primary'}
                                                    `}
                                                >
                                                    <Avatar
                                                        displayName={getGroupDisplayName(member)}
                                                        userId={toUserId(member.uid)}
                                                        size='sm'
                                                    />
                                                    <span className='flex-1 truncate'>{getGroupDisplayName(member)}</span>
                                                    {isSelected && (
                                                        <CheckIcon
                                                            size={16}
                                                            className={isHighlighted ? 'text-interactive-primary-foreground' : 'text-interactive-primary'}
                                                        />
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                            </div>
                        </div>
                    )}
                </div>

                {validationErrors.paidBy && (
                    <p id={`${inputId}-error`} className='text-sm text-semantic-error' role='alert'>
                        {validationErrors.paidBy}
                    </p>
                )}
            </Stack>
        </Card>
    );
}
