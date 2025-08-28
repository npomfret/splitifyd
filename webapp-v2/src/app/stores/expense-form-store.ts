import { signal, ReadonlySignal } from '@preact/signals';
import { CreateExpenseRequest, ExpenseData, ExpenseSplit, SplitTypes } from '@splitifyd/shared';
import { apiClient, ApiError } from '../apiClient';
import { enhancedGroupDetailStore } from './group-detail-store-enhanced';
import { enhancedGroupsStore as groupsStore } from './groups-store-enhanced';
import { logWarning } from '@/utils/browser-logger.ts';
import { getUTCDateTime, isDateInFuture } from '@/utils/dateUtils.ts';
import type { UserScopedStorage } from '@/utils/userScopedStorage.ts';

export interface ExpenseFormStore {
    // Form fields
    description: string;
    amount: string | number; // Allow string to preserve user input like "50.00"
    currency: string;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: string;
    category: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: string[];
    splits: ExpenseSplit[];

    // UI state
    loading: boolean;
    saving: boolean;
    error: string | null;
    validationErrors: Record<string, string>;

    // Readonly signal accessors for reactive components
    readonly descriptionSignal: ReadonlySignal<string>;
    readonly amountSignal: ReadonlySignal<string | number>;
    readonly currencySignal: ReadonlySignal<string>;
    readonly dateSignal: ReadonlySignal<string>;
    readonly timeSignal: ReadonlySignal<string>;
    readonly paidBySignal: ReadonlySignal<string>;
    readonly categorySignal: ReadonlySignal<string>;
    readonly splitTypeSignal: ReadonlySignal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>;
    readonly participantsSignal: ReadonlySignal<string[]>;
    readonly splitsSignal: ReadonlySignal<ExpenseSplit[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly savingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly validationErrorsSignal: ReadonlySignal<Record<string, string>>;

    // Actions
    updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void;
    setParticipants(participants: string[]): void;
    toggleParticipant(userId: string): void;
    calculateEqualSplits(): void;
    updateSplitAmount(userId: string, amount: number): void;
    updateSplitPercentage(userId: string, percentage: number): void;
    validateForm(): boolean;
    saveExpense(groupId: string): Promise<ExpenseData>;
    updateExpense(groupId: string, expenseId: string): Promise<ExpenseData>;
    clearError(): void;
    reset(): void;
    hasUnsavedChanges(): boolean;
    saveDraft(groupId: string): void;
    loadDraft(groupId: string): boolean;
    clearDraft(groupId: string): void;

    // Storage management
    setStorage(storage: UserScopedStorage): void;
    clearStorage(): void;
}

// Type for form data fields
interface ExpenseFormData {
    description: string;
    amount: string | number; // Allow string to preserve user input
    currency: string;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: string;
    category: string;
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
}

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Note: Signals are now encapsulated within the ExpenseFormStoreImpl class below

// Categories are now imported from shared types

// Storage management for user-scoped data
class ExpenseStorageManager {
    private storage: UserScopedStorage | null = null;
    private static readonly RECENT_CATEGORIES_KEY = 'recent-expense-categories';
    private static readonly RECENT_AMOUNTS_KEY = 'recent-expense-amounts';
    private static readonly MAX_RECENT_CATEGORIES = 3;
    private static readonly MAX_RECENT_AMOUNTS = 5;

    setStorage(storage: UserScopedStorage): void {
        this.storage = storage;
    }

    clearStorage(): void {
        this.storage = null;
    }

    getRecentCategories(): string[] {
        if (!this.storage) return [];

        try {
            const recent = this.storage.getItem(ExpenseStorageManager.RECENT_CATEGORIES_KEY);
            return recent ? JSON.parse(recent) : [];
        } catch {
            return [];
        }
    }

    addRecentCategory(category: string): void {
        if (!this.storage) return;

        try {
            const recent = this.getRecentCategories();
            const filtered = recent.filter((cat) => cat !== category);
            const updated = [category, ...filtered].slice(0, ExpenseStorageManager.MAX_RECENT_CATEGORIES);
            this.storage.setItem(ExpenseStorageManager.RECENT_CATEGORIES_KEY, JSON.stringify(updated));
        } catch {
            // Ignore storage errors
        }
    }

    getRecentAmounts(): number[] {
        if (!this.storage) return [];

        try {
            const recent = this.storage.getItem(ExpenseStorageManager.RECENT_AMOUNTS_KEY);
            return recent ? JSON.parse(recent) : [];
        } catch {
            return [];
        }
    }

    addRecentAmount(amount: number): void {
        if (!this.storage) return;

        try {
            const recent = this.getRecentAmounts();
            const filtered = recent.filter((amt) => amt !== amount);
            const updated = [amount, ...filtered].slice(0, ExpenseStorageManager.MAX_RECENT_AMOUNTS);
            this.storage.setItem(ExpenseStorageManager.RECENT_AMOUNTS_KEY, JSON.stringify(updated));
        } catch {
            // Ignore storage errors
        }
    }

    saveDraft(groupId: string, draftData: any): void {
        if (!this.storage) return;

        try {
            const draftKey = `expense-draft-${groupId}`;
            this.storage.setItem(draftKey, JSON.stringify(draftData));
        } catch (error) {
            logWarning('Failed to save expense draft to user-scoped storage', { error });
        }
    }

    loadDraft(groupId: string): any | null {
        if (!this.storage) return null;

        try {
            const draftKey = `expense-draft-${groupId}`;
            const draftJson = this.storage.getItem(draftKey);
            return draftJson ? JSON.parse(draftJson) : null;
        } catch (error) {
            logWarning('Failed to load expense draft from user-scoped storage', { error });
            return null;
        }
    }

    clearDraft(groupId: string): void {
        if (!this.storage) return;

        try {
            const draftKey = `expense-draft-${groupId}`;
            this.storage.removeItem(draftKey);
        } catch (error) {
            logWarning('Failed to clear expense draft from user-scoped storage', { error });
        }
    }
}

// Create singleton storage manager
const storageManager = new ExpenseStorageManager();

// Export functions for backward compatibility
export function getRecentCategories(): string[] {
    return storageManager.getRecentCategories();
}

export function getRecentAmounts(): number[] {
    return storageManager.getRecentAmounts();
}

class ExpenseFormStoreImpl implements ExpenseFormStore {
    // Private signals - encapsulated within the class
    readonly #descriptionSignal = signal<string>('');
    readonly #amountSignal = signal<string | number>(''); // Store as string to preserve user input
    readonly #currencySignal = signal<string>('USD'); // Default to USD since UI doesn't expose currency selection yet
    readonly #dateSignal = signal<string>(getTodayDate());
    readonly #timeSignal = signal<string>('12:00'); // Default to noon (12:00 PM)
    readonly #paidBySignal = signal<string>('');
    readonly #categorySignal = signal<string>('food');
    readonly #splitTypeSignal = signal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>(SplitTypes.EQUAL);
    readonly #participantsSignal = signal<string[]>([]);
    readonly #splitsSignal = signal<ExpenseSplit[]>([]);

    // UI state signals
    readonly #loadingSignal = signal<boolean>(false);
    readonly #savingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #validationErrorsSignal = signal<Record<string, string>>({});

    // State getters - readonly values for external consumers
    get description() {
        return this.#descriptionSignal.value;
    }
    get amount() {
        return this.#amountSignal.value;
    }
    get currency() {
        return this.#currencySignal.value;
    }
    get date() {
        return this.#dateSignal.value;
    }
    get time() {
        return this.#timeSignal.value;
    }
    get paidBy() {
        return this.#paidBySignal.value;
    }
    get category() {
        return this.#categorySignal.value;
    }
    get splitType() {
        return this.#splitTypeSignal.value;
    }
    get participants() {
        return this.#participantsSignal.value;
    }
    get splits() {
        return this.#splitsSignal.value;
    }
    get loading() {
        return this.#loadingSignal.value;
    }
    get saving() {
        return this.#savingSignal.value;
    }
    get error() {
        return this.#errorSignal.value;
    }
    get validationErrors() {
        return this.#validationErrorsSignal.value;
    }

    // Signal accessors for reactive components - return readonly signals
    get descriptionSignal(): ReadonlySignal<string> {
        return this.#descriptionSignal;
    }
    get amountSignal(): ReadonlySignal<string | number> {
        return this.#amountSignal;
    }
    get currencySignal(): ReadonlySignal<string> {
        return this.#currencySignal;
    }
    get dateSignal(): ReadonlySignal<string> {
        return this.#dateSignal;
    }
    get timeSignal(): ReadonlySignal<string> {
        return this.#timeSignal;
    }
    get paidBySignal(): ReadonlySignal<string> {
        return this.#paidBySignal;
    }
    get categorySignal(): ReadonlySignal<string> {
        return this.#categorySignal;
    }
    get splitTypeSignal(): ReadonlySignal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE> {
        return this.#splitTypeSignal;
    }
    get participantsSignal(): ReadonlySignal<string[]> {
        return this.#participantsSignal;
    }
    get splitsSignal(): ReadonlySignal<ExpenseSplit[]> {
        return this.#splitsSignal;
    }
    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }
    get savingSignal(): ReadonlySignal<boolean> {
        return this.#savingSignal;
    }
    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }
    get validationErrorsSignal(): ReadonlySignal<Record<string, string>> {
        return this.#validationErrorsSignal;
    }

    // Computed property to check if required fields are filled (for button enabling)
    get hasRequiredFields(): boolean {
        // Check basic required fields are filled (not empty)
        if (!this.#descriptionSignal.value?.trim()) return false;
        if (!this.#amountSignal.value) return false; // Just check if filled, not if valid
        if (!this.#dateSignal.value) return false;
        if (!this.#paidBySignal.value) return false;
        if (this.#participantsSignal.value.length === 0) return false;

        // For exact and percentage splits, also check if splits are properly configured
        if (this.#splitTypeSignal.value === SplitTypes.EXACT || this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
            const splitsError = this.validateField('splits');
            if (splitsError) return false;
        }

        return true;
    }

    // Computed property to check if form is valid
    get isFormValid(): boolean {
        // First check if required fields are filled
        if (!this.hasRequiredFields) return false;

        // Then check if values are valid
        if (parseFloat(this.#amountSignal.value.toString()) <= 0) return false;

        // Validate each field
        const descError = this.validateField('description');
        if (descError) return false;

        const amountError = this.validateField('amount');
        if (amountError) return false;

        const dateError = this.validateField('date');
        if (dateError) return false;

        const paidByError = this.validateField('paidBy');
        if (paidByError) return false;

        const participantsError = this.validateField('participants');
        if (participantsError) return false;

        const splitsError = this.validateField('splits');
        if (splitsError) return false;

        // Check if there are any existing validation errors
        return Object.keys(this.#validationErrorsSignal.value).length === 0;
    }

    updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void {
        this.#errorSignal.value = null;

        // Update the field value first
        switch (field) {
            case 'description':
                this.#descriptionSignal.value = value as string;
                break;
            case 'amount':
                this.#amountSignal.value = value as string | number;
                // Convert to number for calculations
                const numericAmount = typeof value === 'string' ? parseFloat(value) || 0 : (value as number);
                // Recalculate splits based on current type
                if (this.#splitTypeSignal.value === SplitTypes.EQUAL) {
                    this.calculateEqualSplits();
                } else if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
                    // Recalculate amounts for percentage splits
                    const currentSplits = [...this.#splitsSignal.value];
                    currentSplits.forEach((split) => {
                        if (split.percentage !== undefined) {
                            split.amount = (numericAmount * split.percentage) / 100;
                        }
                    });
                    this.#splitsSignal.value = currentSplits;
                }
                break;
            case 'currency':
                this.#currencySignal.value = value as string;
                break;
            case 'date':
                this.#dateSignal.value = value as string;
                break;
            case 'time':
                this.#timeSignal.value = value as string;
                break;
            case 'paidBy':
                this.#paidBySignal.value = value as string;
                // Auto-add payer to participants if not already included
                if (!this.#participantsSignal.value.includes(value as string)) {
                    this.#participantsSignal.value = [...this.#participantsSignal.value, value as string];
                }
                break;
            case 'category':
                this.#categorySignal.value = value as string;
                break;
            case 'splitType':
                this.#splitTypeSignal.value = value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
                this.handleSplitTypeChange(value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE);
                break;
        }

        // Perform real-time validation for the field
        const errors = { ...this.#validationErrorsSignal.value };
        const fieldError = this.validateField(field, value);

        if (fieldError) {
            errors[field] = fieldError;
        } else {
            delete errors[field];
        }

        if (field === 'amount' || field === 'splitType') {
            const splitsError = this.validateField('splits');
            if (splitsError) {
                errors.splits = splitsError;
            } else {
                delete errors.splits;
            }
        }

        this.#validationErrorsSignal.value = errors;
    }

    setParticipants(participants: string[]): void {
        this.#participantsSignal.value = participants;
        // Always include payer in participants
        if (this.#paidBySignal.value && !participants.includes(this.#paidBySignal.value)) {
            this.#participantsSignal.value = [...participants, this.#paidBySignal.value];
        }
        // Recalculate splits based on current type
        this.handleSplitTypeChange(this.#splitTypeSignal.value);

        // Validate participants
        const errors = { ...this.#validationErrorsSignal.value };
        const participantsError = this.validateField('participants');
        if (participantsError) {
            errors.participants = participantsError;
        } else {
            delete errors.participants;
        }
        this.#validationErrorsSignal.value = errors;
    }

    toggleParticipant(userId: string): void {
        const current = this.#participantsSignal.value;
        const isIncluded = current.includes(userId);

        // Don't allow removing the payer
        if (userId === this.#paidBySignal.value && isIncluded) {
            return;
        }

        if (isIncluded) {
            this.#participantsSignal.value = current.filter((id) => id !== userId);
        } else {
            this.#participantsSignal.value = [...current, userId];
        }

        // Recalculate splits based on current type
        this.handleSplitTypeChange(this.#splitTypeSignal.value);
    }

    calculateEqualSplits(): void {
        const participants = this.#participantsSignal.value;
        const amount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;

        if (participants.length === 0 || amount <= 0) {
            this.#splitsSignal.value = [];
            return;
        }

        // Calculate equal split amount
        const splitAmount = Math.floor((amount * 100) / participants.length) / 100;
        const remainder = amount - splitAmount * participants.length;

        // Create splits
        const splits: ExpenseSplit[] = participants.map((userId, index) => ({
            userId,
            amount: index === 0 ? splitAmount + remainder : splitAmount,
        }));

        this.#splitsSignal.value = splits;
    }

    updateSplitAmount(userId: string, amount: number): void {
        const currentSplits = [...this.#splitsSignal.value];
        const splitIndex = currentSplits.findIndex((s) => s.userId === userId);

        if (splitIndex >= 0) {
            currentSplits[splitIndex] = { ...currentSplits[splitIndex], amount };
        } else {
            currentSplits.push({ userId, amount });
        }

        this.#splitsSignal.value = currentSplits;

        // Validate splits
        const errors = { ...this.#validationErrorsSignal.value };
        const splitsError = this.validateField('splits');
        if (splitsError) {
            errors.splits = splitsError;
        } else {
            delete errors.splits;
        }
        this.#validationErrorsSignal.value = errors;
    }

    updateSplitPercentage(userId: string, percentage: number): void {
        const currentSplits = [...this.#splitsSignal.value];
        const splitIndex = currentSplits.findIndex((s) => s.userId === userId);

        if (splitIndex >= 0) {
            const numericAmount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;
            currentSplits[splitIndex] = {
                ...currentSplits[splitIndex],
                percentage,
                amount: (numericAmount * percentage) / 100,
            };
        } else {
            const numericAmount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;
            currentSplits.push({
                userId,
                percentage,
                amount: (numericAmount * percentage) / 100,
            });
        }

        this.#splitsSignal.value = currentSplits;

        // Validate splits
        const errors = { ...this.#validationErrorsSignal.value };
        const splitsError = this.validateField('splits');
        if (splitsError) {
            errors.splits = splitsError;
        } else {
            delete errors.splits;
        }
        this.#validationErrorsSignal.value = errors;
    }

    private handleSplitTypeChange(newType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE): void {
        const participants = this.#participantsSignal.value;
        const amount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;

        if (participants.length === 0 || amount <= 0) {
            this.#splitsSignal.value = [];
            return;
        }

        switch (newType) {
            case SplitTypes.EQUAL:
                this.calculateEqualSplits();
                break;

            case SplitTypes.EXACT:
                // Initialize with equal amounts as a starting point
                const exactAmount = amount / participants.length;
                this.#splitsSignal.value = participants.map((userId) => ({
                    userId,
                    amount: exactAmount,
                }));
                break;

            case SplitTypes.PERCENTAGE:
                // Initialize with equal percentages
                const equalPercentage = 100 / participants.length;
                this.#splitsSignal.value = participants.map((userId) => ({
                    userId,
                    percentage: equalPercentage,
                    amount: (amount * equalPercentage) / 100,
                }));
                break;
        }
    }

    private validateField(field: string, value?: any): string | null {
        switch (field) {
            case 'description':
                const desc = value ?? this.#descriptionSignal.value;
                if (!desc.trim()) {
                    return 'Description is required';
                } else if (desc.length > 100) {
                    return 'Description must be less than 100 characters';
                }
                break;

            case 'amount':
                const amt = value ?? this.#amountSignal.value;
                const numericAmt = typeof amt === 'string' ? parseFloat(amt) || 0 : amt;
                if (numericAmt <= 0) {
                    return 'Amount must be greater than 0';
                } else if (numericAmt > 1000000) {
                    return 'Amount seems too large';
                }
                break;

            case 'currency':
                const curr = value ?? this.#currencySignal.value;
                if (!curr || curr.trim() === '') {
                    return 'Currency is required';
                }
                if (curr.length !== 3) {
                    return 'Currency must be a 3-letter code (e.g., USD, EUR)';
                }
                break;

            case 'date':
                const dt = value ?? this.#dateSignal.value;
                if (!dt) {
                    return 'Date is required';
                }
                // Check if date is in the future (compares local dates properly)
                if (isDateInFuture(dt)) {
                    return 'Date cannot be in the future';
                }
                break;

            case 'paidBy':
                const pb = value ?? this.#paidBySignal.value;
                if (!pb) {
                    return 'Please select who paid';
                }
                break;

            case 'participants':
                const parts = value ?? this.#participantsSignal.value;
                if (parts.length === 0) {
                    return 'At least one participant is required';
                }
                break;

            case 'splits':
                // Validate splits based on split type
                if (this.#splitTypeSignal.value === SplitTypes.EXACT) {
                    const totalSplit = this.#splitsSignal.value.reduce((sum, split) => sum + split.amount, 0);
                    const numericAmount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;
                    if (Math.abs(totalSplit - numericAmount) > 0.01) {
                        return `Split amounts must equal the total expense amount`;
                    }
                } else if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
                    const totalPercentage = this.#splitsSignal.value.reduce((sum, split) => sum + (split.percentage || 0), 0);
                    if (Math.abs(totalPercentage - 100) > 0.01) {
                        return 'Percentages must add up to 100%';
                    }
                }
                break;
        }
        return null;
    }

    validateForm(): boolean {
        const errors: Record<string, string> = {};

        // Validate all fields
        const descError = this.validateField('description');
        if (descError) errors.description = descError;

        const amountError = this.validateField('amount');
        if (amountError) errors.amount = amountError;

        const currencyError = this.validateField('currency');
        if (currencyError) errors.currency = currencyError;

        const dateError = this.validateField('date');
        if (dateError) errors.date = dateError;

        const payerError = this.validateField('paidBy');
        if (payerError) errors.paidBy = payerError;

        const participantsError = this.validateField('participants');
        if (participantsError) errors.participants = participantsError;

        const splitsError = this.validateField('splits');
        if (splitsError) errors.splits = splitsError;

        this.#validationErrorsSignal.value = errors;
        const isValid = Object.keys(errors).length === 0;

        // Log validation failures using browser logger
        if (!isValid) {
            logWarning('[ExpenseForm] Validation failed', { errors });
        }

        return isValid;
    }

    async saveExpense(groupId: string): Promise<ExpenseData> {
        if (!this.validateForm()) {
            const errors = this.#validationErrorsSignal.value;
            logWarning('[ExpenseForm] Cannot submit form due to validation errors', { errors });
            throw new Error('Please fix validation errors');
        }

        this.#savingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Convert date and time to UTC timestamp
            const utcDateTime = getUTCDateTime(this.#dateSignal.value, this.#timeSignal.value);

            const numericAmount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;
            const request: CreateExpenseRequest = {
                groupId,
                description: this.#descriptionSignal.value.trim(),
                amount: numericAmount,
                currency: this.#currencySignal.value,
                paidBy: this.#paidBySignal.value,
                category: this.#categorySignal.value,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
            };

            const expense = await apiClient.createExpense(request);

            // Track recent category and amount
            storageManager.addRecentCategory(this.#categorySignal.value);
            storageManager.addRecentAmount(numericAmount);

            // Refresh group data to show the new expense immediately
            try {
                await Promise.all([enhancedGroupDetailStore.refreshAll(), groupsStore.refreshGroups()]);
            } catch (refreshError) {
                // Log refresh error but don't fail the expense creation
                logWarning('Failed to refresh data after creating expense', { error: refreshError });
            }

            // Clear draft and reset form after successful save
            this.clearDraft(groupId);
            this.reset();

            return expense;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#savingSignal.value = false;
        }
    }

    async updateExpense(groupId: string, expenseId: string): Promise<ExpenseData> {
        if (!this.validateForm()) {
            throw new Error('Please fix validation errors');
        }

        this.#savingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Convert date and time to UTC timestamp
            const utcDateTime = getUTCDateTime(this.#dateSignal.value, this.#timeSignal.value);

            // For updates, only include fields that can be changed
            // Backend doesn't allow changing: groupId, paidBy
            const numericAmount = typeof this.#amountSignal.value === 'string' ? parseFloat(this.#amountSignal.value) || 0 : this.#amountSignal.value;
            const updateRequest = {
                description: this.#descriptionSignal.value.trim(),
                amount: numericAmount,
                currency: this.#currencySignal.value,
                category: this.#categorySignal.value,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
            };

            const expense = await apiClient.updateExpense(expenseId, updateRequest as CreateExpenseRequest);

            // Track recent category and amount
            storageManager.addRecentCategory(this.#categorySignal.value);
            storageManager.addRecentAmount(numericAmount);

            // Refresh group data to show the updated expense immediately
            try {
                await Promise.all([enhancedGroupDetailStore.refreshAll(), groupsStore.refreshGroups()]);
            } catch (refreshError) {
                // Log refresh error but don't fail the expense update
                logWarning('Failed to refresh data after updating expense', { error: refreshError });
            }

            // Clear draft after successful update
            this.clearDraft(groupId);

            return expense;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#savingSignal.value = false;
        }
    }

    clearError(): void {
        this.#errorSignal.value = null;
    }

    reset(): void {
        this.#descriptionSignal.value = '';
        this.#amountSignal.value = ''; // Reset to empty string
        this.#currencySignal.value = 'USD'; // Default to USD
        this.#dateSignal.value = getTodayDate();
        this.#timeSignal.value = '12:00'; // Default to noon
        this.#paidBySignal.value = '';
        this.#categorySignal.value = 'food';
        this.#splitTypeSignal.value = SplitTypes.EQUAL;
        this.#participantsSignal.value = [];
        this.#splitsSignal.value = [];
        this.#errorSignal.value = null;
        this.#validationErrorsSignal.value = {};
    }

    hasUnsavedChanges(): boolean {
        // Check if any field has been modified from initial state
        const hasAmount = typeof this.#amountSignal.value === 'string' ? this.#amountSignal.value.trim() !== '' : this.#amountSignal.value > 0;
        return (
            this.#descriptionSignal.value.trim() !== '' ||
            hasAmount ||
            this.#currencySignal.value !== 'USD' ||
            this.#dateSignal.value !== getTodayDate() ||
            this.#paidBySignal.value !== '' ||
            this.#categorySignal.value !== 'food' ||
            this.#splitTypeSignal.value !== SplitTypes.EQUAL ||
            this.#participantsSignal.value.length > 0 ||
            this.#splitsSignal.value.length > 0
        );
    }

    setStorage(storage: UserScopedStorage): void {
        storageManager.setStorage(storage);
    }

    clearStorage(): void {
        storageManager.clearStorage();
    }

    saveDraft(groupId: string): void {
        const draftData = {
            description: this.#descriptionSignal.value,
            amount: this.#amountSignal.value,
            currency: this.#currencySignal.value,
            date: this.#dateSignal.value,
            time: this.#timeSignal.value,
            paidBy: this.#paidBySignal.value,
            category: this.#categorySignal.value,
            splitType: this.#splitTypeSignal.value,
            participants: this.#participantsSignal.value,
            splits: this.#splitsSignal.value,
            timestamp: Date.now(),
        };

        storageManager.saveDraft(groupId, draftData);
    }

    loadDraft(groupId: string): boolean {
        try {
            const draftData = storageManager.loadDraft(groupId);

            if (!draftData) {
                return false;
            }

            // Check if draft is not too old (24 hours)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            if (Date.now() - draftData.timestamp > maxAge) {
                this.clearDraft(groupId);
                return false;
            }

            // Restore form data
            this.#descriptionSignal.value = draftData.description || '';
            this.#amountSignal.value = draftData.amount || 0;
            this.#currencySignal.value = draftData.currency || 'USD'; // Default to USD
            this.#dateSignal.value = draftData.date || getTodayDate();
            this.#timeSignal.value = draftData.time || '12:00'; // Default to noon
            this.#paidBySignal.value = draftData.paidBy || '';
            this.#categorySignal.value = draftData.category || 'food';
            this.#splitTypeSignal.value = draftData.splitType || SplitTypes.EQUAL;
            this.#participantsSignal.value = draftData.participants || [];
            this.#splitsSignal.value = draftData.splits || [];

            return true;
        } catch (error) {
            logWarning('Failed to load expense draft from user-scoped storage', { error });
            return false;
        }
    }

    clearDraft(groupId: string): void {
        storageManager.clearDraft(groupId);
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
