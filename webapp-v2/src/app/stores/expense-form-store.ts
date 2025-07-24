import { signal } from '@preact/signals';
import type { CreateExpenseRequest, ExpenseData, ExpenseSplit } from '../../types/webapp-shared-types';
import { apiClient, ApiError } from '../apiClient';

export interface ExpenseFormStore {
  // Form fields
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits: ExpenseSplit[];
  
  // UI state
  loading: boolean;
  saving: boolean;
  error: string | null;
  validationErrors: Record<string, string>;
  
  // Actions
  updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void;
  setParticipants(participants: string[]): void;
  toggleParticipant(userId: string): void;
  calculateEqualSplits(): void;
  updateSplitAmount(userId: string, amount: number): void;
  updateSplitPercentage(userId: string, percentage: number): void;
  validateForm(): boolean;
  saveExpense(groupId: string): Promise<ExpenseData>;
  clearError(): void;
  reset(): void;
}

// Type for form data fields
interface ExpenseFormData {
  description: string;
  amount: number;
  date: string;
  paidBy: string;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage';
}

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Signals for form state
const descriptionSignal = signal<string>('');
const amountSignal = signal<number>(0);
const dateSignal = signal<string>(getTodayDate());
const paidBySignal = signal<string>('');
const categorySignal = signal<string>('General');
const splitTypeSignal = signal<'equal' | 'exact' | 'percentage'>('equal');
const participantsSignal = signal<string[]>([]);
const splitsSignal = signal<ExpenseSplit[]>([]);

// UI state signals
const loadingSignal = signal<boolean>(false);
const savingSignal = signal<boolean>(false);
const errorSignal = signal<string | null>(null);
const validationErrorsSignal = signal<Record<string, string>>({});

// Common expense categories
export const EXPENSE_CATEGORIES = [
  'General',
  'Food & Dining',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Bills & Utilities',
  'Travel',
  'Healthcare',
  'Other'
];

class ExpenseFormStoreImpl implements ExpenseFormStore {
  // State getters
  get description() { return descriptionSignal.value; }
  get amount() { return amountSignal.value; }
  get date() { return dateSignal.value; }
  get paidBy() { return paidBySignal.value; }
  get category() { return categorySignal.value; }
  get splitType() { return splitTypeSignal.value; }
  get participants() { return participantsSignal.value; }
  get splits() { return splitsSignal.value; }
  get loading() { return loadingSignal.value; }
  get saving() { return savingSignal.value; }
  get error() { return errorSignal.value; }
  get validationErrors() { return validationErrorsSignal.value; }

  updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void {
    errorSignal.value = null;
    
    // Clear validation error for this field
    const errors = { ...validationErrorsSignal.value };
    delete errors[field];
    validationErrorsSignal.value = errors;
    
    switch (field) {
      case 'description':
        descriptionSignal.value = value as string;
        break;
      case 'amount':
        amountSignal.value = value as number;
        // Recalculate splits based on current type
        if (splitTypeSignal.value === 'equal') {
          this.calculateEqualSplits();
        } else if (splitTypeSignal.value === 'percentage') {
          // Recalculate amounts for percentage splits
          const currentSplits = [...splitsSignal.value];
          currentSplits.forEach(split => {
            if (split.percentage !== undefined) {
              split.amount = (value as number * split.percentage) / 100;
            }
          });
          splitsSignal.value = currentSplits;
        }
        break;
      case 'date':
        dateSignal.value = value as string;
        break;
      case 'paidBy':
        paidBySignal.value = value as string;
        // Auto-add payer to participants if not already included
        if (!participantsSignal.value.includes(value as string)) {
          participantsSignal.value = [...participantsSignal.value, value as string];
        }
        break;
      case 'category':
        categorySignal.value = value as string;
        break;
      case 'splitType':
        splitTypeSignal.value = value as 'equal' | 'exact' | 'percentage';
        // Recalculate splits when type changes
        this.handleSplitTypeChange(value as 'equal' | 'exact' | 'percentage');
        break;
    }
  }

  setParticipants(participants: string[]): void {
    participantsSignal.value = participants;
    // Always include payer in participants
    if (paidBySignal.value && !participants.includes(paidBySignal.value)) {
      participantsSignal.value = [...participants, paidBySignal.value];
    }
    // Recalculate splits based on current type
    this.handleSplitTypeChange(splitTypeSignal.value);
  }

  toggleParticipant(userId: string): void {
    const current = participantsSignal.value;
    const isIncluded = current.includes(userId);
    
    // Don't allow removing the payer
    if (userId === paidBySignal.value && isIncluded) {
      return;
    }
    
    if (isIncluded) {
      participantsSignal.value = current.filter(id => id !== userId);
    } else {
      participantsSignal.value = [...current, userId];
    }
    
    // Recalculate splits based on current type
    this.handleSplitTypeChange(splitTypeSignal.value);
  }

  calculateEqualSplits(): void {
    const participants = participantsSignal.value;
    const amount = amountSignal.value;
    
    if (participants.length === 0 || amount <= 0) {
      splitsSignal.value = [];
      return;
    }
    
    // Calculate equal split amount
    const splitAmount = Math.floor((amount * 100) / participants.length) / 100;
    const remainder = amount - (splitAmount * participants.length);
    
    // Create splits
    const splits: ExpenseSplit[] = participants.map((userId, index) => ({
      userId,
      amount: index === 0 ? splitAmount + remainder : splitAmount
    }));
    
    splitsSignal.value = splits;
  }

  updateSplitAmount(userId: string, amount: number): void {
    const currentSplits = [...splitsSignal.value];
    const splitIndex = currentSplits.findIndex(s => s.userId === userId);
    
    if (splitIndex >= 0) {
      currentSplits[splitIndex] = { ...currentSplits[splitIndex], amount };
    } else {
      currentSplits.push({ userId, amount });
    }
    
    splitsSignal.value = currentSplits;
  }

  updateSplitPercentage(userId: string, percentage: number): void {
    const currentSplits = [...splitsSignal.value];
    const splitIndex = currentSplits.findIndex(s => s.userId === userId);
    
    if (splitIndex >= 0) {
      currentSplits[splitIndex] = { 
        ...currentSplits[splitIndex], 
        percentage,
        amount: (amountSignal.value * percentage) / 100
      };
    } else {
      currentSplits.push({ 
        userId, 
        percentage,
        amount: (amountSignal.value * percentage) / 100
      });
    }
    
    splitsSignal.value = currentSplits;
  }

  private handleSplitTypeChange(newType: 'equal' | 'exact' | 'percentage'): void {
    const participants = participantsSignal.value;
    const amount = amountSignal.value;
    
    if (participants.length === 0 || amount <= 0) {
      splitsSignal.value = [];
      return;
    }
    
    switch (newType) {
      case 'equal':
        this.calculateEqualSplits();
        break;
        
      case 'exact':
        // Initialize with equal amounts as a starting point
        const exactAmount = amount / participants.length;
        splitsSignal.value = participants.map(userId => ({
          userId,
          amount: exactAmount
        }));
        break;
        
      case 'percentage':
        // Initialize with equal percentages
        const equalPercentage = 100 / participants.length;
        splitsSignal.value = participants.map(userId => ({
          userId,
          percentage: equalPercentage,
          amount: (amount * equalPercentage) / 100
        }));
        break;
    }
  }

  validateForm(): boolean {
    const errors: Record<string, string> = {};
    
    // Validate description
    if (!descriptionSignal.value.trim()) {
      errors.description = 'Description is required';
    } else if (descriptionSignal.value.length > 100) {
      errors.description = 'Description must be less than 100 characters';
    }
    
    // Validate amount
    if (amountSignal.value <= 0) {
      errors.amount = 'Amount must be greater than 0';
    } else if (amountSignal.value > 1000000) {
      errors.amount = 'Amount seems too large';
    }
    
    // Validate date
    if (!dateSignal.value) {
      errors.date = 'Date is required';
    }
    
    // Validate payer
    if (!paidBySignal.value) {
      errors.paidBy = 'Please select who paid';
    }
    
    // Validate participants
    if (participantsSignal.value.length === 0) {
      errors.participants = 'At least one participant is required';
    }
    
    // Validate splits based on split type
    if (splitTypeSignal.value === 'equal') {
      // Equal splits are auto-calculated, no validation needed
    } else if (splitTypeSignal.value === 'exact') {
      const totalSplit = splitsSignal.value.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplit - amountSignal.value) > 0.01) {
        errors.splits = `Split amounts must equal the total expense amount`;
      }
    } else if (splitTypeSignal.value === 'percentage') {
      const totalPercentage = splitsSignal.value.reduce((sum, split) => sum + (split.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.splits = 'Percentages must add up to 100%';
      }
    }
    
    validationErrorsSignal.value = errors;
    return Object.keys(errors).length === 0;
  }

  async saveExpense(groupId: string): Promise<ExpenseData> {
    if (!this.validateForm()) {
      throw new Error('Please fix validation errors');
    }
    
    savingSignal.value = true;
    errorSignal.value = null;
    
    try {
      // Convert date string to ISO format with time
      const dateTime = new Date(dateSignal.value);
      dateTime.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      const request: CreateExpenseRequest = {
        groupId,
        description: descriptionSignal.value.trim(),
        amount: amountSignal.value,
        paidBy: paidBySignal.value,
        category: categorySignal.value,
        date: dateTime.toISOString(),
        splitType: splitTypeSignal.value,
        participants: participantsSignal.value,
        splits: splitsSignal.value
      };
      
      const expense = await apiClient.createExpense(request);
      
      // Reset form after successful save
      this.reset();
      
      return expense;
    } catch (error) {
      errorSignal.value = this.getErrorMessage(error);
      throw error;
    } finally {
      savingSignal.value = false;
    }
  }

  clearError(): void {
    errorSignal.value = null;
  }

  reset(): void {
    descriptionSignal.value = '';
    amountSignal.value = 0;
    dateSignal.value = getTodayDate();
    paidBySignal.value = '';
    categorySignal.value = 'General';
    splitTypeSignal.value = 'equal';
    participantsSignal.value = [];
    splitsSignal.value = [];
    errorSignal.value = null;
    validationErrorsSignal.value = {};
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return error.message;
    } else if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}

// Export singleton instance
export const expenseFormStore = new ExpenseFormStoreImpl();