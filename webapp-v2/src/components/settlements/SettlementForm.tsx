import { apiClient } from '@/app/apiClient.ts';
import { useAsyncAction } from '@/app/hooks';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { useModalOpen } from '@/app/hooks/useModalOpen';
import { CurrencyService } from '@/app/services/currencyService.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { Clickable } from '@/components/ui/Clickable';
import { XIcon } from '@/components/ui/icons';
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/currency';
import { getAmountPrecisionError } from '@/utils/currency-validation.ts';
import { getUTCMidnight, isDateInFuture } from '@/utils/dateUtils.ts';
import { getGroupDisplayName } from '@/utils/displayName';
import { translateApiError } from '@/utils/error-translation';
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
    toCurrencyISOCode,
    toUserId,
    UserId,
    ZERO,
} from '@billsplit-wl/shared';
import { signal } from '@preact/signals';
import { useComputed } from '@preact/signals';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
import { Button, CurrencyAmount, CurrencyAmountInput, FieldError, Form, Stack, Tooltip, Typography } from '../ui';

/**
 * Get the maximum allowed amount string for a given currency
 * Returns a properly formatted amount with correct decimal places
 * Example: JPY (0 decimals) -> '999999', USD (2 decimals) -> '999999.99'
 */
function getMaxAmountForCurrency(currency: string): string {
    const decimals = getCurrencyDecimals(toCurrencyISOCode(currency));
    if (decimals === 0) {
        return '999999';
    }
    const fractionalPart = '9'.repeat(decimals);
    return `999999.${fractionalPart}`;
}

function findMember(members: GroupMember[], uid: UserId): GroupMember | undefined {
    return members.find((m) => m.uid === uid);
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

    // Validation error for sync validation (form validation before submit)
    const [validationError, setValidationError] = useState<string | null>(null);

    // Component-local signals - initialized within useState to avoid stale state across instances
    const [warningMessageSignal] = useState(() => signal<string | null>(null));
    const [payerIdSignal] = useState(() => signal<UserId | ''>(''));
    const [payeeIdSignal] = useState(() => signal<UserId | ''>(''));
    const [amountSignal] = useState(() => signal(ZERO));
    const [currencySignal] = useState(() => signal(''));
    const [dateSignal] = useState(() => signal(new Date().toISOString().split('T')[0]));
    const [noteSignal] = useState(() => signal(''));
    const [amountPrecisionErrorSignal] = useState(() => signal<string | null>(null));

    // Extract signal values for use in render
    const warningMessage = warningMessageSignal.value;
    const payerId = payerIdSignal.value;
    const payeeId = payeeIdSignal.value;
    const amount = amountSignal.value;
    const currency = currencySignal.value;
    const date = dateSignal.value;
    const note = noteSignal.value;
    const amountPrecisionError = amountPrecisionErrorSignal.value;

    const currentUser = authStore.user;
    const members = enhancedGroupDetailStore.members || [];

    // Use useComputed to reactively track balances changes
    const balances = useComputed(() => enhancedGroupDetailStore.balances);

    // Compute quick settle debts reactively
    const quickSettleDebts = useComputed(() => {
        if (!balances.value?.simplifiedDebts || !currentUser) {
            return [];
        }
        return balances.value.simplifiedDebts.filter(
            (debt: SimplifiedDebt) => debt.from.uid === currentUser.uid,
        );
    });

    // Initialize form when modal opens
    useModalOpen(isOpen, {
        onOpen: useCallback(() => {
            if (editMode && settlementToEdit) {
                // Check if settlement is locked
                if (settlementToEdit.isLocked) {
                    setValidationError(t('settlementForm.errors.settlementLocked'));
                    return;
                }

                // Pre-populate form with settlement data for editing
                payerIdSignal.value = settlementToEdit.payer.uid;
                payeeIdSignal.value = settlementToEdit.payee.uid;
                amountSignal.value = settlementToEdit.amount;
                currencySignal.value = settlementToEdit.currency;
                dateSignal.value = settlementToEdit.date.split('T')[0];
                noteSignal.value = settlementToEdit.note || '';
            } else if (preselectedDebt && preselectedDebt.from && preselectedDebt.to && currentUser) {
                payerIdSignal.value = preselectedDebt.from.uid;
                payeeIdSignal.value = preselectedDebt.to.uid;
                amountSignal.value = preselectedDebt.amount;
                currencySignal.value = preselectedDebt.currency;
                dateSignal.value = new Date().toISOString().split('T')[0];
                noteSignal.value = '';
            } else if (currentUser) {
                payerIdSignal.value = currentUser.uid;
                payeeIdSignal.value = '';
                amountSignal.value = ZERO;
                // Determine currency from existing group balances or recent expenses
                const expenses = enhancedGroupDetailStore.expenses;
                let detectedCurrency = '';

                // First try: get currency from existing debts involving current user
                if (balances.value?.simplifiedDebts && balances.value.simplifiedDebts.length > 0) {
                    const userDebt = balances.value.simplifiedDebts.find((debt: SimplifiedDebt) => debt.from.uid === currentUser.uid || debt.to.uid === currentUser.uid);
                    if (userDebt) {
                        detectedCurrency = userDebt.currency;
                    }
                } // Second try: get currency from most recent expense if no user debts
                else if (expenses && expenses.length > 0) {
                    detectedCurrency = expenses[0].currency;
                }

                // Force user to select currency - no defaults allowed
                currencySignal.value = detectedCurrency; // Will be empty string if no currency can be detected
                dateSignal.value = new Date().toISOString().split('T')[0];
                noteSignal.value = '';
            }
            setValidationError(null);
            amountPrecisionErrorSignal.value = null;
        }, [editMode, settlementToEdit, preselectedDebt, currentUser, balances.value, t]),
    });

    // Helper functions - defined before useEffects that use them
    const getMemberName = (userId: UserId): string => {
        const member = members.find((m: GroupMember) => m.uid === userId);
        if (!member) {
            throw new Error(`SettlementForm: member ${userId} not found`);
        }
        return getGroupDisplayName(member);
    };

    const getCurrentDebt = (): string => {
        if (!payerId || !payeeId || !currency || !balances.value) {
            return ZERO;
        }

        const simplifiedDebts = balances.value.simplifiedDebts;
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
        if (amountPrecisionError) {
            warningMessageSignal.value = null;
            return;
        }

        if (!payerId || !payeeId || !currency || !amount) {
            warningMessageSignal.value = null;
            return;
        }

        const normalizedAmount = normalizeAmount(amount, toCurrencyISOCode(currency));
        const amountUnits = amountToSmallestUnit(normalizedAmount, toCurrencyISOCode(currency));
        if (amountUnits <= 0) {
            warningMessageSignal.value = null;
            return;
        }

        const currentDebt = normalizeAmount(getCurrentDebt(), toCurrencyISOCode(currency));
        const currentDebtUnits = amountToSmallestUnit(currentDebt, toCurrencyISOCode(currency));

        if (currentDebtUnits === 0) {
            const payerName = getMemberName(payerId);
            const payeeName = getMemberName(payeeId);
            warningMessageSignal.value = t('settlementForm.warnings.noDebt', { payer: payerName, payee: payeeName, currency });
            return;
        }

        if (amountUnits > currentDebtUnits) {
            const payerName = getMemberName(payerId);
            const payeeName = getMemberName(payeeId);
            warningMessageSignal.value = t('settlementForm.warnings.overpayment', {
                payer: payerName,
                payee: payeeName,
                debt: formatCurrency(currentDebt, toCurrencyISOCode(currency)),
                amount: formatCurrency(normalizedAmount, toCurrencyISOCode(currency)),
            });
            return;
        }

        if (amountUnits < currentDebtUnits) {
            const payerName = getMemberName(payerId);
            const payeeName = getMemberName(payeeId);
            const remainingUnits = currentDebtUnits - amountUnits;
            const remainingAmount = smallestUnitToAmountString(remainingUnits, toCurrencyISOCode(currency));
            warningMessageSignal.value = t('settlementForm.warnings.underpayment', {
                payer: payerName,
                payee: payeeName,
                amount: formatCurrency(normalizedAmount, toCurrencyISOCode(currency)),
                remaining: formatCurrency(remainingAmount, toCurrencyISOCode(currency)),
            });
            return;
        }

        warningMessageSignal.value = null;
    }, [payerId, payeeId, amount, currency, balances.value, amountPrecisionError, t]);

    const recalculatePrecisionError = (amountValue: string, currencyCode: string) => {
        if (!currencyCode || !amountValue || amountValue.trim() === '') {
            amountPrecisionErrorSignal.value = null;
            return;
        }

        const precisionMessage = getAmountPrecisionError(amountValue, toCurrencyISOCode(currencyCode));
        amountPrecisionErrorSignal.value = precisionMessage;
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

        const precisionError = getAmountPrecisionError(amount, toCurrencyISOCode(currency));
        if (precisionError) {
            return precisionError;
        }

        let amountUnits: number;
        try {
            const normalizedAmount = normalizeAmount(amount, toCurrencyISOCode(currency));
            amountUnits = amountToSmallestUnit(normalizedAmount, toCurrencyISOCode(currency));
        } catch {
            return t('settlementForm.validation.validAmountRequired');
        }

        if (amountUnits <= 0) {
            return t('settlementForm.validation.validAmountRequired');
        }

        if (currency && amountUnits > amountToSmallestUnit(getMaxAmountForCurrency(currency), toCurrencyISOCode(currency))) {
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

    // Async action for submitting the settlement
    const submitAction = useAsyncAction(
        async () => {
            if (editMode && settlementToEdit) {
                // Update existing settlement - only send fields that can be updated
                const updateData = {
                    amount: amount,
                    currency: toCurrencyISOCode(currency),
                    date: getUTCMidnight(date), // Always send UTC to server
                    note: note.trim() || undefined,
                };
                await apiClient.updateSettlement(settlementToEdit.id, updateData);
            } else {
                // Create new settlement - send all fields
                if (!payerId || !payeeId) {
                    throw new Error('Payer and payee are required');
                }

                const settlementData: CreateSettlementRequest = {
                    groupId,
                    payerId,
                    payeeId,
                    amount: amount,
                    currency: toCurrencyISOCode(currency),
                    date: getUTCMidnight(date), // Always send UTC to server
                    note: note.trim() || undefined,
                };
                await apiClient.createSettlement(settlementData);
            }
        },
        {
            onSuccess: () => {
                // Activity feed handles refresh automatically via SSE
                onSuccess?.();
                onClose();
            },
            onError: (error) => {
                return translateApiError(error, t, t('settlementForm.validation.recordPaymentFailed'));
            },
        },
    );

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const formValidationError = validateForm();
        if (formValidationError) {
            setValidationError(formValidationError);
            return;
        }

        setValidationError(null);
        await submitAction.execute();
    };

    // Combined error display (validation errors or API errors)
    const displayError = validationError || submitAction.error;

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

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

        if (getAmountPrecisionError(amount, toCurrencyISOCode(currency))) {
            return false;
        }

        try {
            const normalizedAmount = normalizeAmount(amount, toCurrencyISOCode(currency));
            const amountUnits = amountToSmallestUnit(normalizedAmount, toCurrencyISOCode(currency));
            const maxUnits = amountToSmallestUnit(getMaxAmountForCurrency(currency), toCurrencyISOCode(currency));
            return amountUnits > 0 && amountUnits <= maxUnits;
        } catch (error) {
            // If amount validation fails, form is invalid
            return false;
        }
    })();

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size='sm'
            labelledBy='settlement-form-title'
        >
            <ModalHeader>
                <div className='flex justify-between items-center'>
                    <Typography variant='heading' id='settlement-form-title'>
                        {editMode ? t('settlementForm.updateSettlement') : t('settlementForm.recordSettlement')}
                    </Typography>
                    <Tooltip content={t('settlementForm.closeModal')} showOnFocus={false}>
                        <Clickable
                            as='button'
                            type='button'
                            onClick={onClose}
                            className='text-text-muted hover:text-text-muted'
                            aria-label={t('settlementForm.closeModal')}
                            eventName='modal_close'
                            eventProps={{ modalName: 'settlement_form', method: 'x_button' }}
                        >
                            <XIcon size={24} />
                        </Clickable>
                    </Tooltip>
                </div>
            </ModalHeader>

            <ModalContent>
                {/* Quick Settlement Buttons - only show in create mode when not pre-filled from balances */}
                {!editMode && !preselectedDebt && quickSettleDebts.value.length > 0 && (
                    <div className='mb-4 pb-4 border-b border-border-default' role='group' aria-label={t('settlementForm.quickSettleLabel')}>
                        <label className='block text-sm font-medium text-text-primary mb-2 text-center'>
                            {t('settlementForm.quickSettleLabel')}
                        </label>
                        <div className='flex flex-wrap gap-2 justify-center'>
                            {quickSettleDebts
                                .value
                                .map((debt: SimplifiedDebt) => {
                                    const { from, to, amount: debtAmount, currency: debtCurrency } = debt;
                                    const payerUid = from
                                        .uid;
                                    const payeeUid = to
                                        .uid;
                                    const payeeMember = findMember(members, payeeUid);
                                    if (!payeeMember) {
                                        return null;
                                    }

                                    return (
                                        <button
                                            key={`${payeeUid}-${debtCurrency}`}
                                            type='button'
                                            onClick={() => {
                                                payerIdSignal.value = payerUid;
                                                payeeIdSignal
                                                    .value = payeeUid;
                                                amountSignal
                                                    .value = debtAmount;
                                                currencySignal
                                                    .value = debtCurrency;
                                                dateSignal
                                                    .value = new Date()
                                                        .toISOString()
                                                        .split('T')[0];
                                                noteSignal
                                                    .value = '';
                                                recalculatePrecisionError(debtAmount, debtCurrency);
                                            }}
                                            className='inline-flex items-center justify-start gap-2 px-4 py-2 bg-interactive-primary/10 border border-border-default rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted hover:border-interactive-primary transition-colors focus:outline-hidden focus:ring-2 focus-visible:ring-interactive-primary w-full sm:w-[280px]'
                                            title={`${formatCurrency(debtAmount, toCurrencyISOCode(debtCurrency))} → ${getGroupDisplayName(payeeMember)}`}
                                        >
                                            {/* Avatar */}
                                            <div
                                                className='w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-text-inverted'
                                                style={{
                                                    backgroundColor: payeeMember
                                                        .themeColor
                                                        ?.light || '#6366f1',
                                                }}
                                            >
                                                {getGroupDisplayName(payeeMember)
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                            {/* Amount and Name */}
                                            <CurrencyAmount
                                                amount={debtAmount}
                                                currency={debtCurrency}
                                                displayOptions={{ includeCurrencyCode: false }}
                                                className='font-semibold text-text-primary whitespace-nowrap'
                                            />
                                            <span className='text-text-muted'>→</span>
                                            <span className='text-text-primary truncate max-w-[120px] whitespace-nowrap'>
                                                {getGroupDisplayName(payeeMember)}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                )}

                <Form onSubmit={handleSubmit}>
                    <Stack spacing='lg'>
                        {/* Payer Selection */}
                        <div>
                            <label for='payer' className='block text-sm font-medium text-text-primary mb-1'>
                                {t('settlementForm.whoPaidLabel')}
                            </label>
                            <select
                                id='payer'
                                value={payerId}
                                onChange={(e) => {
                                    const value = (e.target as HTMLSelectElement).value;
                                    payerIdSignal.value = value ? toUserId(value) : '';
                                }}
                                className='w-full px-3 py-2 border border-border-default rounded-md bg-surface-raised backdrop-blur-xs text-text-primary focus:outline-hidden focus:ring-2 focus-visible:ring-interactive-primary transition-colors duration-200'
                                disabled={submitAction.isLoading}
                            >
                                <option value=''>{t('settlementForm.selectPersonPlaceholder')}</option>
                                {members.map((member: GroupMember) => (
                                    <option key={member.uid} value={member.uid}>
                                        {getGroupDisplayName(member)}
                                        {member.uid === currentUser.uid && t('settlementForm.youSuffix')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Payee Selection */}
                        <div>
                            <label for='payee' className='block text-sm font-medium text-text-primary mb-1'>
                                {t('settlementForm.whoReceivedPaymentLabel')}
                            </label>
                            <select
                                id='payee'
                                value={payeeId}
                                onChange={(e) => {
                                    const value = (e.target as HTMLSelectElement).value;
                                    payeeIdSignal.value = value ? toUserId(value) : '';
                                }}
                                className='w-full px-3 py-2 border border-border-default rounded-md bg-surface-raised backdrop-blur-xs text-text-primary focus:outline-hidden focus:ring-2 focus-visible:ring-interactive-primary transition-colors duration-200'
                                disabled={submitAction.isLoading}
                            >
                                <option value=''>{t('settlementForm.selectPersonPlaceholder')}</option>
                                {members
                                    .filter((m: GroupMember) => m.uid !== payerId)
                                    .map((member: GroupMember) => (
                                        <option key={member.uid} value={member.uid}>
                                            {getGroupDisplayName(member)}
                                            {member.uid === currentUser.uid && t('settlementForm.youSuffix')}
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
                                    amountSignal.value = value;
                                    recalculatePrecisionError(value, currency);
                                }}
                                onCurrencyChange={(value) => {
                                    currencySignal.value = value;
                                    CurrencyService.getInstance().addToRecentCurrencies(toCurrencyISOCode(value));
                                    recalculatePrecisionError(amount, value);
                                }}
                                label={t('settlementForm.amountLabel')}
                                required
                                disabled={submitAction.isLoading}
                                placeholder={t('settlementForm.amountPlaceholder')}
                                recentCurrencies={CurrencyService.getInstance().getRecentCurrencies()}
                            />
                            {amountPrecisionError && (
                                <FieldError>
                                    {amountPrecisionError}
                                </FieldError>
                            )}
                        </div>

                        {/* Date */}
                        <div>
                            <label for='date' className='block text-sm font-medium text-text-primary mb-1'>
                                {t('settlementForm.dateLabel')}
                            </label>
                            <input
                                id='date'
                                type='date'
                                value={date}
                                onInput={(e: Event) => {
                                    dateSignal.value = (e.target as HTMLInputElement).value;
                                }}
                                max={new Date().toISOString().split('T')[0]}
                                disabled={submitAction.isLoading}
                                required
                                className='w-full px-3 py-2 border border-border-default rounded-md bg-surface-raised backdrop-blur-xs text-text-primary focus:outline-hidden focus:ring-2 focus-visible:ring-interactive-primary transition-colors duration-200'
                                autoComplete='off'
                            />
                        </div>

                        {/* Note (optional) */}
                        <div>
                            <label for='note' className='block text-sm font-medium text-text-primary mb-1'>
                                {t('settlementForm.noteLabel')}
                            </label>
                            <input
                                id='note'
                                type='text'
                                placeholder={t('settlementForm.notePlaceholder')}
                                value={note}
                                onInput={(e: Event) => {
                                    noteSignal.value = (e.target as HTMLInputElement).value;
                                }}
                                disabled={submitAction.isLoading}
                                maxLength={500}
                                className='w-full px-3 py-2 border border-border-default rounded-md bg-surface-raised backdrop-blur-xs text-text-primary placeholder:text-text-muted/70 focus:outline-hidden focus:ring-2 focus-visible:ring-interactive-primary transition-colors duration-200'
                                autoComplete='off'
                            />
                        </div>

                        {/* Warning Message */}
                        {warningMessage && (
                            <div className='p-3 bg-surface-warning border border-border-warning rounded-md'>
                                <p className='text-sm text-semantic-warning' role='status'>
                                    ⚠️ {warningMessage}
                                </p>
                            </div>
                        )}

                        {/* Error Message */}
                        {displayError && (
                            <div className='p-3 bg-surface-error border border-border-error rounded-md'>
                                <p className='text-sm text-semantic-error' role='alert'>
                                    {displayError}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className='flex gap-3 pt-2'>
                            <Button type='button' variant='secondary' onClick={onClose} disabled={submitAction.isLoading} className='flex-1'>
                                {t('settlementForm.cancelButton')}
                            </Button>
                            <Button
                                type='submit'
                                variant='primary'
                                disabled={!isFormValid || submitAction.isLoading || (editMode && settlementToEdit?.isLocked)}
                                loading={submitAction.isLoading}
                                className='flex-1'
                            >
                                {submitAction.isLoading
                                    ? editMode
                                        ? t('settlementForm.updatingButton')
                                        : t('settlementForm.recordingButton')
                                    : editMode
                                    ? t('settlementForm.updateSettlement')
                                    : t('settlementForm.recordSettlement')}
                            </Button>
                        </div>
                    </Stack>
                </Form>
            </ModalContent>
        </Modal>
    );
}
