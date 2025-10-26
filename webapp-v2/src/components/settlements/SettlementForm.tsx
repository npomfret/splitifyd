import { apiClient } from '@/app/apiClient.ts';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { CurrencyService } from '@/app/services/currencyService.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { formatCurrency } from '@/utils/currency';
import { getAmountPrecisionError } from '@/utils/currency-validation.ts';
import { getUTCMidnight, isDateInFuture } from '@/utils/dateUtils.ts';
import { getGroupDisplayName } from '@/utils/displayName';
import {
    amountToSmallestUnit,
    CreateSettlementRequest,
    getCurrencyDecimals,
    GroupId,
    GroupMember,
    normalizeAmount,
    SettlementWithMembers,
    SimplifiedDebt,
    smallestUnitToAmountString,
    UserId,
    ZERO,
} from '@splitifyd/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, CurrencyAmount, CurrencyAmountInput, Form, Tooltip } from '../ui';

/**
 * Get the maximum allowed amount string for a given currency
 * Returns a properly formatted amount with correct decimal places
 * Example: JPY (0 decimals) -> '999999', USD (2 decimals) -> '999999.99'
 */
function getMaxAmountForCurrency(currency: string): string {
    const decimals = getCurrencyDecimals(currency);
    if (decimals === 0) {
        return '999999';
    }
    const fractionalPart = '9'.repeat(decimals);
    return `999999.${fractionalPart}`;
}

interface SettlementFormProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: GroupId;
    preselectedDebt?: SimplifiedDebt;
    onSuccess?: () => void;
    editMode?: boolean;
    settlementToEdit?: SettlementWithMembers;
}

export function SettlementForm({ isOpen, onClose, groupId, preselectedDebt, onSuccess, editMode = false, settlementToEdit }: SettlementFormProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Form state - converted from module-level signals to component state
    const [payerId, setPayerId] = useState('');
    const [payeeId, setPayeeId] = useState('');
    const [amount, setAmount] = useState(ZERO);
    const [currency, setCurrency] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [amountPrecisionError, setAmountPrecisionError] = useState<string | null>(null);

    const currentUser = authStore.user;
    const members = enhancedGroupDetailStore.members || [];

    useEffect(() => {
        if (isOpen) {
            if (editMode && settlementToEdit) {
                // Check if settlement is locked
                if (settlementToEdit.isLocked) {
                    setValidationError(t('settlementForm.errors.settlementLocked'));
                    setIsSubmitting(false);
                    return;
                }

                // Pre-populate form with settlement data for editing
                setPayerId(settlementToEdit.payer.uid);
                setPayeeId(settlementToEdit.payee.uid);
                setAmount(settlementToEdit.amount);
                setCurrency(settlementToEdit.currency);
                setDate(settlementToEdit.date.split('T')[0]);
                setNote(settlementToEdit.note || '');
            } else if (preselectedDebt && currentUser) {
                setPayerId(preselectedDebt.from.uid);
                setPayeeId(preselectedDebt.to.uid);
                setAmount(preselectedDebt.amount);
                setCurrency(preselectedDebt.currency);
                setDate(new Date().toISOString().split('T')[0]);
                setNote('');
            } else if (currentUser) {
                setPayerId(currentUser.uid);
                setPayeeId('');
                setAmount(ZERO);
                // Determine currency from existing group balances or recent expenses
                const balances = enhancedGroupDetailStore.balances;
                const expenses = enhancedGroupDetailStore.expenses;
                let detectedCurrency = '';

                // First try: get currency from existing debts involving current user
                if (balances?.simplifiedDebts && balances.simplifiedDebts.length > 0) {
                    const userDebt = balances.simplifiedDebts.find((debt: SimplifiedDebt) => debt.from.uid === currentUser.uid || debt.to.uid === currentUser.uid);
                    if (userDebt) {
                        detectedCurrency = userDebt.currency;
                    }
                } // Second try: get currency from most recent expense if no user debts
                else if (expenses && expenses.length > 0) {
                    detectedCurrency = expenses[0].currency;
                }

                // Force user to select currency - no defaults allowed
                setCurrency(detectedCurrency); // Will be empty string if no currency can be detected
                setDate(new Date().toISOString().split('T')[0]);
                setNote('');
            }
            setValidationError(null);
            setAmountPrecisionError(null);
        }
    }, [isOpen, editMode, settlementToEdit, preselectedDebt, currentUser]); // Include all dependencies

    // Helper functions - defined before useEffects that use them
    const getMemberName = (userId: UserId): string => {
        const member = members.find((m: GroupMember) => m.uid === userId);
        if (!member) {
            throw new Error(`SettlementForm: member ${userId} not found`);
        }
        return getGroupDisplayName(member);
    };

    const getCurrentDebt = (): string => {
        if (!payerId || !payeeId || !currency || !enhancedGroupDetailStore.balances) {
            return ZERO;
        }

        const simplifiedDebts = enhancedGroupDetailStore.balances.simplifiedDebts;
        if (!simplifiedDebts) return ZERO;

        // Find the simplified debt from payer to payee in the specified currency
        const debt = simplifiedDebts.find(
            (d: SimplifiedDebt) =>
                d.from.uid === payerId
                && d.to.uid === payeeId
                && d.currency === currency,
        );

        // Return the debt amount if found, otherwise ZERO
        return debt?.amount || ZERO;
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (amountPrecisionError) {
            setWarningMessage(null);
            return;
        }

        if (!payerId || !payeeId || !currency || !amount) {
            setWarningMessage(null);
            return;
        }

        const normalizedAmount = normalizeAmount(amount, currency);
        const amountUnits = amountToSmallestUnit(normalizedAmount, currency);
        if (amountUnits <= 0) {
            setWarningMessage(null);
            return;
        }

        const currentDebt = normalizeAmount(getCurrentDebt(), currency);
        const currentDebtUnits = amountToSmallestUnit(currentDebt, currency);

        if (currentDebtUnits === 0) {
            const payerName = getMemberName(payerId);
            const payeeName = getMemberName(payeeId);
            setWarningMessage(t('settlementForm.warnings.noDebt', { payer: payerName, payee: payeeName, currency }));
            return;
        }

        if (amountUnits > currentDebtUnits) {
            const payerName = getMemberName(payerId);
            const payeeName = getMemberName(payeeId);
            setWarningMessage(
                t('settlementForm.warnings.overpayment', {
                    payer: payerName,
                    payee: payeeName,
                    debt: formatCurrency(currentDebt, currency),
                    amount: formatCurrency(normalizedAmount, currency),
                }),
            );
            return;
        }

        if (amountUnits < currentDebtUnits) {
            const payerName = getMemberName(payerId);
            const payeeName = getMemberName(payeeId);
            const remainingUnits = currentDebtUnits - amountUnits;
            const remainingAmount = smallestUnitToAmountString(remainingUnits, currency);
            setWarningMessage(
                t('settlementForm.warnings.underpayment', {
                    payer: payerName,
                    payee: payeeName,
                    amount: formatCurrency(normalizedAmount, currency),
                    remaining: formatCurrency(remainingAmount, currency),
                }),
            );
            return;
        }

        setWarningMessage(null);
    }, [payerId, payeeId, amount, currency, enhancedGroupDetailStore.balances, amountPrecisionError, t]);

    const recalculatePrecisionError = (amountValue: string, currencyCode: string) => {
        if (!currencyCode || !amountValue || amountValue.trim() === '') {
            setAmountPrecisionError(null);
            return;
        }

        const precisionMessage = getAmountPrecisionError(amountValue, currencyCode);
        setAmountPrecisionError(precisionMessage);
    };

    const handleBackdropClick = (e: Event) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const validateForm = (): string | null => {
        if (!payerId) {
            return t('settlementForm.validation.selectPayer');
        }

        if (!payeeId) {
            return t('settlementForm.validation.selectPayee');
        }

        if (payerId === payeeId) {
            return t('settlementForm.validation.samePersonError');
        }

        if (!currency || currency.trim() === '' || currency.length !== 3) {
            return t('settlementForm.validation.validCurrencyRequired');
        }

        if (!amount || `${amount}`.trim() === '') {
            return t('settlementForm.validation.validAmountRequired');
        }

        const precisionError = getAmountPrecisionError(amount, currency);
        if (precisionError) {
            return precisionError;
        }

        let amountUnits: number;
        try {
            const normalizedAmount = normalizeAmount(amount, currency);
            amountUnits = amountToSmallestUnit(normalizedAmount, currency);
        } catch {
            return t('settlementForm.validation.validAmountRequired');
        }

        if (amountUnits <= 0) {
            return t('settlementForm.validation.validAmountRequired');
        }

        if (currency && amountUnits > amountToSmallestUnit(getMaxAmountForCurrency(currency), currency)) {
            return t('settlementForm.validation.amountTooLarge');
        }

        if (!date) {
            return t('settlementForm.validation.dateRequired');
        }

        // Check if date is in the future (compares local dates properly)
        if (isDateInFuture(date)) {
            return t('settlementForm.validation.dateInFuture');
        }

        return null;
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            setValidationError(validationError);
            return;
        }

        setIsSubmitting(true);
        setValidationError(null);

        try {
            if (editMode && settlementToEdit) {
                // Update existing settlement - only send fields that can be updated
                const updateData = {
                    amount: amount,
                    currency: currency,
                    date: getUTCMidnight(date), // Always send UTC to server
                    note: note.trim() || undefined,
                };
                await apiClient.updateSettlement(settlementToEdit.id, updateData);
            } else {
                // Create new settlement - send all fields
                const settlementData: CreateSettlementRequest = {
                    groupId,
                    payerId: payerId,
                    payeeId: payeeId,
                    amount: amount,
                    currency: currency,
                    date: getUTCMidnight(date), // Always send UTC to server
                    note: note.trim() || undefined,
                };
                await apiClient.createSettlement(settlementData);
            }

            await enhancedGroupDetailStore.refreshAll();

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error) {
            setValidationError(error instanceof Error ? error.message : t('settlementForm.validation.recordPaymentFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Computed property for form validity
    const isFormValid = (() => {
        if (!payerId || !payeeId || payerId === payeeId || !currency) {
            return false;
        }

        if (!date || isDateInFuture(date)) {
            return false;
        }

        if (!amount || `${amount}`.trim() === '') {
            return false;
        }

        if (getAmountPrecisionError(amount, currency)) {
            return false;
        }

        try {
            const normalizedAmount = normalizeAmount(amount, currency);
            const amountUnits = amountToSmallestUnit(normalizedAmount, currency);
            const maxUnits = amountToSmallestUnit(getMaxAmountForCurrency(currency), currency);
            return amountUnits > 0 && amountUnits <= maxUnits;
        } catch (error) {
            // If amount validation fails, form is invalid
            return false;
        }
    })();

    return (
        <div class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4' onClick={handleBackdropClick}>
            <div
                ref={modalRef}
                data-testid='settlement-form-modal'
                class='bg-white rounded-lg max-w-md w-full p-6 shadow-xl'
                onClick={(e: Event) => e.stopPropagation()}
                role='dialog'
                aria-modal='true'
                aria-labelledby='settlement-form-title'
            >
                <div class='flex justify-between items-center mb-4'>
                    <h2 id='settlement-form-title' class='text-xl font-semibold text-gray-900'>
                        {editMode ? t('settlementForm.updateSettlement') : t('settlementForm.recordSettlement')}
                    </h2>
                    <Tooltip content={t('settlementForm.closeModal')}>
                        <button onClick={onClose} class='text-gray-400 hover:text-gray-500' aria-label={t('settlementForm.closeModal')}>
                            <svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
                            </svg>
                        </button>
                    </Tooltip>
                </div>

                {/* Quick Settlement Buttons - only show in create mode when not pre-filled from balances */}
                {!editMode && !preselectedDebt && currentUser && enhancedGroupDetailStore.balances?.simplifiedDebts && (() => {
                    const userDebts = enhancedGroupDetailStore.balances.simplifiedDebts.filter(
                        (debt: SimplifiedDebt) => debt.from.uid === currentUser.uid,
                    );

                    if (userDebts.length === 0) return null;

                    return (
                        <div class='mb-4 pb-4 border-b border-gray-200'>
                            <label class='block text-sm font-medium text-gray-700 mb-2 text-center'>
                                Quick settle:
                            </label>
                            <div class='flex flex-wrap gap-2 justify-center'>
                                {userDebts.map((debt: SimplifiedDebt) => {
                                    const payeeMember = members.find((m: GroupMember) => m.uid === debt.to.uid);
                                    if (!payeeMember) return null;

                                    return (
                                        <button
                                            key={`${debt.to.uid}-${debt.currency}`}
                                            type='button'
                                            onClick={() => {
                                                setPayerId(debt.from.uid);
                                                setPayeeId(debt.to.uid);
                                                setAmount(debt.amount);
                                                setCurrency(debt.currency);
                                                setDate(new Date().toISOString().split('T')[0]);
                                                setNote('');
                                                recalculatePrecisionError(debt.amount, debt.currency);
                                            }}
                                            class='inline-flex items-center justify-start gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-[280px]'
                                            title={`${formatCurrency(debt.amount, debt.currency)} → ${getGroupDisplayName(payeeMember)}`}
                                        >
                                            {/* Avatar */}
                                            <div
                                                class='w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white'
                                                style={{ backgroundColor: payeeMember.themeColor?.light || '#6366f1' }}
                                            >
                                                {getGroupDisplayName(payeeMember).charAt(0).toUpperCase()}
                                            </div>
                                            {/* Amount and Name */}
                                            <CurrencyAmount
                                                amount={debt.amount}
                                                currency={debt.currency}
                                                displayOptions={{ includeCurrencyCode: false }}
                                                className='font-semibold text-gray-900 whitespace-nowrap'
                                            />
                                            <span class='text-gray-500'>→</span>
                                            <span class='text-gray-700 truncate max-w-[120px] whitespace-nowrap'>
                                                {getGroupDisplayName(payeeMember)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                <Form onSubmit={handleSubmit}>
                    <div class='space-y-4'>
                        {/* Payer Selection */}
                        <div>
                            <label for='payer' class='block text-sm font-medium text-gray-700 mb-1'>
                                {t('settlementForm.whoPaidLabel')}
                            </label>
                            <select
                                id='payer'
                                data-testid='settlement-payer-select'
                                value={payerId}
                                onChange={(e) => setPayerId((e.target as HTMLSelectElement).value)}
                                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                                disabled={isSubmitting}
                            >
                                <option value=''>{t('settlementForm.selectPersonPlaceholder')}</option>
                                {members.map((member: GroupMember) => (
                                    <option key={member.uid} value={member.uid}>
                                        {getGroupDisplayName(member)}
                                        {member.uid === currentUser?.uid && t('settlementForm.youSuffix')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Payee Selection */}
                        <div>
                            <label for='payee' class='block text-sm font-medium text-gray-700 mb-1'>
                                {t('settlementForm.whoReceivedPaymentLabel')}
                            </label>
                            <select
                                id='payee'
                                data-testid='settlement-payee-select'
                                value={payeeId}
                                onChange={(e) => setPayeeId((e.target as HTMLSelectElement).value)}
                                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                                disabled={isSubmitting}
                            >
                                <option value=''>{t('settlementForm.selectPersonPlaceholder')}</option>
                                {members
                                    .filter((m: GroupMember) => m.uid !== payerId)
                                    .map((member: GroupMember) => (
                                        <option key={member.uid} value={member.uid}>
                                            {getGroupDisplayName(member)}
                                            {member.uid === currentUser?.uid && t('settlementForm.youSuffix')}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Amount with integrated Currency selector */}
                        <div>
                            <CurrencyAmountInput
                                amount={amount || ZERO}
                                currency={currency}
                                onAmountChange={(value) => {
                                    setAmount(value);
                                    recalculatePrecisionError(value, currency);
                                }}
                                onCurrencyChange={(value) => {
                                    setCurrency(value);
                                    CurrencyService.getInstance().addToRecentCurrencies(value);
                                    recalculatePrecisionError(amount, value);
                                }}
                                label={t('settlementForm.amountLabel')}
                                required
                                disabled={isSubmitting}
                                placeholder={t('settlementForm.amountPlaceholder')}
                                recentCurrencies={CurrencyService.getInstance().getRecentCurrencies()}
                                data-testid='settlement-amount-input'
                            />
                            {amountPrecisionError && (
                                <p class='mt-2 text-sm text-red-600' role='alert' data-testid='settlement-amount-error'>
                                    {amountPrecisionError}
                                </p>
                            )}
                        </div>

                        {/* Date */}
                        <div>
                            <label for='date' class='block text-sm font-medium text-gray-700 mb-1'>
                                {t('settlementForm.dateLabel')}
                            </label>
                            <input
                                id='date'
                                data-testid='settlement-date-input'
                                type='date'
                                value={date}
                                onInput={(e: Event) => setDate((e.target as HTMLInputElement).value)}
                                max={new Date().toISOString().split('T')[0]}
                                disabled={isSubmitting}
                                required
                                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                                autoComplete='off'
                            />
                        </div>

                        {/* Note (optional) */}
                        <div>
                            <label for='note' class='block text-sm font-medium text-gray-700 mb-1'>
                                {t('settlementForm.noteLabel')}
                            </label>
                            <input
                                id='note'
                                data-testid='settlement-note-input'
                                type='text'
                                placeholder={t('settlementForm.notePlaceholder')}
                                value={note}
                                onInput={(e: Event) => setNote((e.target as HTMLInputElement).value)}
                                disabled={isSubmitting}
                                maxLength={500}
                                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                                autoComplete='off'
                            />
                        </div>

                        {/* Warning Message */}
                        {warningMessage && (
                            <div class='p-3 bg-yellow-50 border border-yellow-200 rounded-md'>
                                <p class='text-sm text-yellow-800' role='status' data-testid='settlement-warning-message'>
                                    ⚠️ {warningMessage}
                                </p>
                            </div>
                        )}

                        {/* Error Message */}
                        {validationError && (
                            <div class='p-3 bg-red-50 border border-red-200 rounded-md'>
                                <p class='text-sm text-red-600' role='alert' data-testid='settlement-validation-error'>
                                    {validationError}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div class='flex gap-3 pt-2'>
                            <Button type='button' variant='secondary' onClick={onClose} disabled={isSubmitting} className='flex-1' data-testid='cancel-settlement-button'>
                                {t('settlementForm.cancelButton')}
                            </Button>
                            <Button
                                type='submit'
                                variant='primary'
                                disabled={!isFormValid || isSubmitting || (editMode && settlementToEdit?.isLocked)}
                                loading={isSubmitting}
                                className='flex-1'
                                data-testid='save-settlement-button'
                            >
                                {isSubmitting
                                    ? editMode
                                        ? t('settlementForm.updatingButton')
                                        : t('settlementForm.recordingButton')
                                    : editMode
                                    ? t('settlementForm.updateSettlement')
                                    : t('settlementForm.recordSettlement')}
                            </Button>
                        </div>
                    </div>
                </Form>
            </div>
        </div>
    );
}
