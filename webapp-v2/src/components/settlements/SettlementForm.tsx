import { signal } from '@preact/signals';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, Form } from '../ui';
import type { 
  CreateSettlementRequest, 
  User, 
  SimplifiedDebt 
} from '../../../../firebase/functions/src/types/webapp-shared-types';
import { apiClient } from '../../app/apiClient';
import { groupDetailStore } from '../../app/stores/group-detail-store';
import { useAuthRequired } from '../../app/hooks/useAuthRequired';

const payerIdSignal = signal('');
const payeeIdSignal = signal('');
const amountSignal = signal('');
// Currency is always USD - no multi-currency support yet
const DEFAULT_CURRENCY = 'USD';
const currencySignal = signal(DEFAULT_CURRENCY);
const dateSignal = signal(new Date().toISOString().split('T')[0]);
const noteSignal = signal('');

interface SettlementFormProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  preselectedDebt?: SimplifiedDebt;
  onSuccess?: () => void;
}

export function SettlementForm({ 
  isOpen, 
  onClose, 
  groupId, 
  preselectedDebt,
  onSuccess 
}: SettlementFormProps) {
  const authStore = useAuthRequired();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const currentUser = authStore.user;
  const members = groupDetailStore.members || [];

  useEffect(() => {
    if (isOpen) {
      if (preselectedDebt && currentUser) {
        payerIdSignal.value = preselectedDebt.from.userId;
        payeeIdSignal.value = preselectedDebt.to.userId;
        amountSignal.value = preselectedDebt.amount.toFixed(2);
        // Currency is always USD
      } else if (currentUser) {
        payerIdSignal.value = currentUser.uid;
        payeeIdSignal.value = '';
        amountSignal.value = '';
        // Currency is always USD
      }
      
      dateSignal.value = new Date().toISOString().split('T')[0];
      noteSignal.value = '';
      setValidationError(null);
    }
  }, [isOpen, preselectedDebt, currentUser]);

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
    const amount = parseFloat(amountSignal.value);
    
    if (!payerIdSignal.value) {
      return 'Please select who paid';
    }
    
    if (!payeeIdSignal.value) {
      return 'Please select who received the payment';
    }
    
    if (payerIdSignal.value === payeeIdSignal.value) {
      return 'Payer and recipient cannot be the same person';
    }
    
    if (!amountSignal.value || isNaN(amount) || amount <= 0) {
      return 'Please enter a valid amount greater than 0';
    }
    
    if (amount > 999999.99) {
      return 'Amount cannot exceed 999,999.99';
    }
    
    // Currency is always USD, no need to validate
    
    if (!dateSignal.value) {
      return 'Please select a date';
    }
    
    const selectedDate = new Date(dateSignal.value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
      return 'Date cannot be in the future';
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
      const settlementData: CreateSettlementRequest = {
        groupId,
        payerId: payerIdSignal.value,
        payeeId: payeeIdSignal.value,
        amount: parseFloat(amountSignal.value),
        date: new Date(dateSignal.value).toISOString(),
        note: noteSignal.value.trim() || undefined
      };

      await apiClient.createSettlement(settlementData);
      
      await groupDetailStore.fetchGroup(groupId);
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  
  const getMemberName = (userId: string): string => {
    const member = members.find((m: User) => m.uid === userId);
    return member?.displayName || 'Unknown User';
  };

  return (
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        class="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
        onClick={(e: Event) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-form-title"
      >
        <div class="flex justify-between items-center mb-4">
          <h2 id="settlement-form-title" class="text-xl font-semibold text-gray-900">Record Payment</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-500"
            aria-label="Close modal"
          >
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
                Who paid?
              </label>
              <select
                id="payer"
                value={payerIdSignal.value}
                onChange={(e) => payerIdSignal.value = (e.target as HTMLSelectElement).value}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Select person</option>
                {members.map((member: User) => (
                  <option key={member.uid} value={member.uid}>
                    {member.displayName}
                    {member.uid === currentUser?.uid && ' (You)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Payee Selection */}
            <div>
              <label for="payee" class="block text-sm font-medium text-gray-700 mb-1">
                Who received the payment?
              </label>
              <select
                id="payee"
                value={payeeIdSignal.value}
                onChange={(e) => payeeIdSignal.value = (e.target as HTMLSelectElement).value}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Select person</option>
                {members
                  .filter((m: User) => m.uid !== payerIdSignal.value)
                  .map((member: User) => (
                    <option key={member.uid} value={member.uid}>
                      {member.displayName}
                      {member.uid === currentUser?.uid && ' (You)'}
                    </option>
                  ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label for="amount" class="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="999999.99"
                placeholder="0.00"
                value={amountSignal.value}
                onInput={(e: Event) => amountSignal.value = (e.target as HTMLInputElement).value}
                disabled={isSubmitting}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date */}
            <div>
              <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={dateSignal.value}
                onInput={(e: Event) => dateSignal.value = (e.target as HTMLInputElement).value}
                max={new Date().toISOString().split('T')[0]}
                disabled={isSubmitting}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Note (optional) */}
            <div>
              <label for="note" class="block text-sm font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <input
                id="note"
                type="text"
                placeholder="e.g., Venmo, cash, bank transfer"
                value={noteSignal.value}
                onInput={(e: Event) => noteSignal.value = (e.target as HTMLInputElement).value}
                disabled={isSubmitting}
                maxLength={500}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Summary */}
            {payerIdSignal.value && payeeIdSignal.value && amountSignal.value && (
              <div class="p-3 bg-gray-50 rounded-md">
                <p class="text-sm text-gray-600">
                  <span class="font-medium">{getMemberName(payerIdSignal.value)}</span>
                  {' paid '}
                  <span class="font-medium">{getMemberName(payeeIdSignal.value)}</span>
                  {' '}
                  <span class="font-bold text-gray-900">
                    ${parseFloat(amountSignal.value).toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            {/* Error Message */}
            {validationError && (
              <div class="p-3 bg-red-50 border border-red-200 rounded-md">
                <p class="text-sm text-red-600">{validationError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div class="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!!validateForm() || isSubmitting}
                loading={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}