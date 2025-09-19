import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, Form, CurrencyAmountInput } from '../ui';
import { CurrencyService } from '@/app/services/currencyService.ts';
import type { CreateSettlementRequest, RegisteredUser, SimplifiedDebt, SettlementListItem } from '@splitifyd/shared';
import { apiClient } from '@/app/apiClient.ts';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced.ts';
import { useAuthRequired } from '@/app/hooks/useAuthRequired.ts';
import { getUTCMidnight, isDateInFuture } from '@/utils/dateUtils.ts';
import { formatCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';

interface SettlementFormProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    preselectedDebt?: SimplifiedDebt;
    onSuccess?: () => void;
    editMode?: boolean;
    settlementToEdit?: SettlementListItem;
}

export function SettlementForm({ isOpen, onClose, groupId, preselectedDebt, onSuccess, editMode = false, settlementToEdit }: SettlementFormProps) {
    const { t } = useTranslation();
    const authStore = useAuthRequired();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Form state - converted from module-level signals to component state
    const [payerId, setPayerId] = useState('');
    const [payeeId, setPayeeId] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');

    const currentUser = authStore.user;
    const members = enhancedGroupDetailStore.members || [];

    useEffect(() => {
        if (isOpen) {
            if (editMode && settlementToEdit) {
                // Pre-populate form with settlement data for editing
                setPayerId(settlementToEdit.payer.uid);
                setPayeeId(settlementToEdit.payee.uid);
                setAmount(settlementToEdit.amount.toFixed(2));
                setCurrency(settlementToEdit.currency);
                setDate(settlementToEdit.date.split('T')[0]);
                setNote(settlementToEdit.note || '');
            } else if (preselectedDebt && currentUser) {
                setPayerId(preselectedDebt.from.userId);
                setPayeeId(preselectedDebt.to.userId);
                setAmount(preselectedDebt.amount.toFixed(2));
                setCurrency(preselectedDebt.currency);
                setDate(new Date().toISOString().split('T')[0]);
                setNote('');
            } else if (currentUser) {
                setPayerId(currentUser.uid);
                setPayeeId('');
                setAmount('');
                setCurrency('USD');
                setDate(new Date().toISOString().split('T')[0]);
                setNote('');
            }
            setValidationError(null);
        }
    }, [isOpen, editMode, settlementToEdit, preselectedDebt, currentUser]); // Include all dependencies

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

    const handleBackdropClick = (e: Event) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const validateForm = (): string | null => {
        const amountNum = parseFloat(amount);

        if (!payerId) {
            return t('settlementForm.validation.selectPayer');
        }

        if (!payeeId) {
            return t('settlementForm.validation.selectPayee');
        }

        if (payerId === payeeId) {
            return t('settlementForm.validation.samePersonError');
        }

        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            return t('settlementForm.validation.validAmountRequired');
        }

        if (amountNum > 999999.99) {
            return t('settlementForm.validation.amountTooLarge');
        }

        if (!currency || currency.length !== 3) {
            return t('settlementForm.validation.validCurrencyRequired');
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
                    amount: parseFloat(amount),
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
                    amount: parseFloat(amount),
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
        const amountNum = parseFloat(amount);
        return payerId && payeeId && payerId !== payeeId && amount && !isNaN(amountNum) && amountNum > 0 && amountNum <= 999999.99 && date && !isDateInFuture(date);
    })();

    const getMemberName = (userId: string): string => {
        const member = members.find((m: RegisteredUser) => m.uid === userId);
        return member?.displayName || 'Unknown User';
    };

    return (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
            <div
                ref={modalRef}
                data-testid="settlement-form-modal"
                class="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
                onClick={(e: Event) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settlement-form-title"
            >
                <div class="flex justify-between items-center mb-4">
                    <h2 id="settlement-form-title" class="text-xl font-semibold text-gray-900">
                        {editMode ? t('settlementForm.updatePayment') : t('settlementForm.recordPayment')}
                    </h2>
                    <button onClick={onClose} class="text-gray-400 hover:text-gray-500" aria-label={t('settlementForm.closeModal')}>
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div class="space-y-4">
                        {/* Payer Selection */}
                        <div>
                            <label for="payer" class="block text-sm font-medium text-gray-700 mb-1">
                                {t('settlementForm.whoPaidLabel')}
                            </label>
                            <select
                                id="payer"
                                data-testid="settlement-payer-select"
                                value={payerId}
                                onChange={(e) => setPayerId((e.target as HTMLSelectElement).value)}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            >
                                <option value="">{t('settlementForm.selectPersonPlaceholder')}</option>
                                {members.map((member: RegisteredUser) => (
                                    <option key={member.uid} value={member.uid}>
                                        {member.displayName}
                                        {member.uid === currentUser?.uid && t('settlementForm.youSuffix')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Payee Selection */}
                        <div>
                            <label for="payee" class="block text-sm font-medium text-gray-700 mb-1">
                                {t('settlementForm.whoReceivedPaymentLabel')}
                            </label>
                            <select
                                id="payee"
                                data-testid="settlement-payee-select"
                                value={payeeId}
                                onChange={(e) => setPayeeId((e.target as HTMLSelectElement).value)}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            >
                                <option value="">{t('settlementForm.selectPersonPlaceholder')}</option>
                                {members
                                    .filter((m: RegisteredUser) => m.uid !== payerId)
                                    .map((member: RegisteredUser) => (
                                        <option key={member.uid} value={member.uid}>
                                            {member.displayName}
                                            {member.uid === currentUser?.uid && t('settlementForm.youSuffix')}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Amount with integrated Currency selector */}
                        <div>
                            <CurrencyAmountInput
                                amount={parseFloat(amount) || 0}
                                currency={currency}
                                onAmountChange={(value) => {
                                    setAmount(value);
                                }}
                                onCurrencyChange={(value) => {
                                    setCurrency(value);
                                    CurrencyService.getInstance().addToRecentCurrencies(value);
                                }}
                                label={t('settlementForm.amountLabel')}
                                required
                                disabled={isSubmitting}
                                placeholder={t('settlementForm.amountPlaceholder')}
                                recentCurrencies={CurrencyService.getInstance().getRecentCurrencies()}
                                data-testid="settlement-amount-input"
                            />
                        </div>

                        {/* Date */}
                        <div>
                            <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
                                {t('settlementForm.dateLabel')}
                            </label>
                            <input
                                id="date"
                                data-testid="settlement-date-input"
                                type="date"
                                value={date}
                                onInput={(e: Event) => setDate((e.target as HTMLInputElement).value)}
                                max={new Date().toISOString().split('T')[0]}
                                disabled={isSubmitting}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Note (optional) */}
                        <div>
                            <label for="note" class="block text-sm font-medium text-gray-700 mb-1">
                                {t('settlementForm.noteLabel')}
                            </label>
                            <input
                                id="note"
                                data-testid="settlement-note-input"
                                type="text"
                                placeholder={t('settlementForm.notePlaceholder')}
                                value={note}
                                onInput={(e: Event) => setNote((e.target as HTMLInputElement).value)}
                                disabled={isSubmitting}
                                maxLength={500}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Summary */}
                        {payerId && payeeId && amount && (
                            <div class="p-3 bg-gray-50 rounded-md">
                                <p class="text-sm text-gray-600">
                                    {t('settlementForm.paymentSummary', {
                                        payer: getMemberName(payerId),
                                        payee: getMemberName(payeeId),
                                        amount: formatCurrency(parseFloat(amount), currency),
                                    })}
                                </p>
                            </div>
                        )}

                        {/* Error Message */}
                        {validationError && (
                            <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                                <p class="text-sm text-red-600" role="alert" data-testid="settlement-validation-error">
                                    {validationError}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div class="flex gap-3 pt-2">
                            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} className="flex-1" data-testid="cancel-settlement-button">
                                {t('settlementForm.cancelButton')}
                            </Button>
                            <Button type="submit" variant="primary" disabled={!isFormValid || isSubmitting} loading={isSubmitting} className="flex-1" data-testid="save-settlement-button">
                                {isSubmitting
                                    ? editMode
                                        ? t('settlementForm.updatingButton')
                                        : t('settlementForm.recordingButton')
                                    : editMode
                                      ? t('settlementForm.updatePayment')
                                      : t('settlementForm.recordPayment')}
                            </Button>
                        </div>
                    </div>
                </Form>
            </div>
        </div>
    );
}
