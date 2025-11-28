import { usePayerSelector } from '@/app/hooks/usePayerSelector';
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
        <Card variant='glass' className='border-border-default relative z-10 !overflow-visible' data-testid='who-paid-section'>
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
                            bg-surface-raised backdrop-blur-sm text-text-primary cursor-pointer
                            hover:bg-surface-muted/60
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-primary
                            ${hasError ? 'border-border-error' : 'border-border-default'}
                        `}
                        aria-expanded={isOpen}
                        aria-haspopup='listbox'
                        aria-controls={`${inputId}-listbox`}
                        aria-invalid={hasError}
                        aria-describedby={hasError ? `${inputId}-error` : undefined}
                        data-testid='payer-selector-trigger'
                    >
                        <div className='flex items-center gap-3'>
                            {selectedMember
                                ? (
                                    <>
                                        <Avatar displayName={getGroupDisplayName(selectedMember)} userId={toUserId(selectedMember.uid)} size='sm' />
                                        <span className='text-sm font-medium'>{getGroupDisplayName(selectedMember)}</span>
                                    </>
                                )
                                : (
                                    <span className='text-sm text-text-muted'>{t('expenseComponents.payerSelector.selectPayer')}</span>
                                )}
                        </div>
                        <svg
                            className={`h-4 w-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            aria-hidden='true'
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 20 20'
                            fill='currentColor'
                        >
                            <path
                                fillRule='evenodd'
                                d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
                                clipRule='evenodd'
                            />
                        </svg>
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
                                    className='w-full px-3 py-1.5 text-sm border border-border-default rounded-md bg-surface-raised focus:outline-none focus:ring-1 focus:ring-interactive-primary'
                                    aria-label={t('expenseComponents.payerSelector.searchPlaceholder')}
                                    data-testid='payer-selector-search'
                                />
                            </div>

                            {/* Member list */}
                            <div className='overflow-auto max-h-52'>
                                {filteredMembers.length === 0
                                    ? (
                                        <div className='px-3 py-4 text-sm text-text-muted text-center' role='status'>
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
                                                        w-full text-left px-3 py-2 text-sm
                                                        flex items-center gap-3
                                                        transition-colors duration-100
                                                        ${isHighlighted ? 'bg-interactive-primary text-interactive-primary-foreground' : 'hover:bg-surface-muted text-text-primary'}
                                                    `}
                                                    data-testid={`payer-option-${member.uid}`}
                                                >
                                                    <Avatar
                                                        displayName={getGroupDisplayName(member)}
                                                        userId={toUserId(member.uid)}
                                                        size='sm'
                                                    />
                                                    <span className='flex-1 truncate'>{getGroupDisplayName(member)}</span>
                                                    {isSelected && (
                                                        <svg
                                                            className={`h-4 w-4 ${isHighlighted ? 'text-interactive-primary-foreground' : 'text-interactive-primary'}`}
                                                            xmlns='http://www.w3.org/2000/svg'
                                                            viewBox='0 0 20 20'
                                                            fill='currentColor'
                                                            aria-hidden='true'
                                                        >
                                                            <path
                                                                fillRule='evenodd'
                                                                d='M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z'
                                                                clipRule='evenodd'
                                                            />
                                                        </svg>
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
                    <p id={`${inputId}-error`} className='text-sm text-semantic-error' role='alert' data-testid='validation-error-paidBy'>
                        {validationErrors.paidBy}
                    </p>
                )}
            </Stack>
        </Card>
    );
}
