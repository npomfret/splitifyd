import i18n from '@/i18n';
import { logWarning } from '@/utils/browser-logger.ts';
import { getAmountPrecisionError } from '@/utils/currency-validation.ts';
import { getUTCDateTime, isDateInFuture } from '@/utils/dateUtils.ts';
import { translateApiError } from '@/utils/error-translation';
import type { UserScopedStorage } from '@/utils/userScopedStorage.ts';
import {
    Amount,
    amountToSmallestUnit,
    AttachmentId,
    calculateEqualSplits,
    calculateExactSplits,
    calculatePercentageSplits,
    createAmountSchema,
    CreateExpenseRequest,
    CurrencyCodeSchema,
    ExpenseDTO,
    ExpenseId,
    ExpenseLabel,
    ExpenseLocation,
    ExpenseSplit,
    GroupId,
    smallestUnitToAmountString,
    SplitTypes,
    toAttachmentId,
    toCurrencyISOCode,
} from '@billsplit-wl/shared';
import type { CurrencyISOCode, UserId } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { z } from 'zod';
import { apiClient } from '../apiClient';

// Form-level validation schema for simple fields
// Complex fields (splits, date, participants) use manual validation
const ExpenseFormFieldsSchema = z.object({
    description: z
        .string()
        .min(1, 'Description is required')
        .max(200, 'Description must be less than 200 characters'),
    amount: createAmountSchema(),
    currency: CurrencyCodeSchema,
    // Labels are optional (0-3 items), each 1-50 chars
    labels: z.array(z.string().min(1).max(50)).max(3).default([]),
    paidBy: z.string().min(1, 'Please select who paid'),
});

interface ExpenseFormStore {
    // Form fields
    description: string;
    amount: Amount;
    currency: string;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: UserId | '';
    labels: ExpenseLabel[];
    splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
    participants: UserId[];
    splits: ExpenseSplit[];

    // Receipt state
    receiptFile: File | null;
    receiptUrl: string | null;
    receiptUploading: boolean;
    receiptError: string | null;

    // UI state
    loading: boolean;
    saving: boolean;
    error: string | null;
    validationErrors: Record<string, string>;

    // Readonly signal accessors for reactive components
    readonly descriptionSignal: ReadonlySignal<string>;
    readonly amountSignal: ReadonlySignal<string>;
    readonly currencySignal: ReadonlySignal<string>;
    readonly dateSignal: ReadonlySignal<string>;
    readonly timeSignal: ReadonlySignal<string>;
    readonly paidBySignal: ReadonlySignal<string>;
    readonly labelsSignal: ReadonlySignal<ExpenseLabel[]>;
    readonly splitTypeSignal: ReadonlySignal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>;
    readonly participantsSignal: ReadonlySignal<string[]>;
    readonly splitsSignal: ReadonlySignal<ExpenseSplit[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly savingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;
    readonly validationErrorsSignal: ReadonlySignal<Record<string, string>>;
    readonly receiptFileSignal: ReadonlySignal<File | null>;
    readonly receiptUrlSignal: ReadonlySignal<string | null>;
    readonly receiptUploadingSignal: ReadonlySignal<boolean>;
    readonly receiptErrorSignal: ReadonlySignal<string | null>;

    // Actions
    updateField<K extends keyof ExpenseFormData>(field: K, value: ExpenseFormData[K]): void;
    validateOnBlur(field: keyof ExpenseFormData): void;
    setParticipants(participants: UserId[]): void;
    toggleParticipant(uid: string): void;
    calculateEqualSplits(): void;
    updateSplitAmount(uid: string, amount: Amount): void;
    updateSplitPercentage(uid: string, percentage: number): void;
    validateForm(): boolean;
    saveExpense(groupId: GroupId): Promise<ExpenseDTO>;
    updateExpense(groupId: GroupId, expenseId: ExpenseId): Promise<ExpenseDTO>;
    clearError(): void;
    reset(): void;
    captureInitialState(): void;
    hasUnsavedChanges(): boolean;
    saveDraft(groupId: GroupId): void;
    loadDraft(groupId: GroupId): boolean;
    clearDraft(groupId: GroupId): void;

    // Receipt management
    setReceiptFile(file: File | null): void;
    setReceiptUrl(url: string | null): void;
    clearReceiptError(): void;

    // Storage management
    setStorage(storage: UserScopedStorage): void;
    clearStorage(): void;
}

// Type for form data fields
interface ExpenseFormData {
    description: string;
    amount: Amount;
    currency: CurrencyISOCode;
    date: string;
    time: string; // Time in HH:mm format (24-hour)
    paidBy: UserId | '';
    labels: ExpenseLabel[];
    location: ExpenseLocation | null;
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

// Labels are now imported from shared types

// Storage management for user-scoped data
class ExpenseStorageManager {
    private storage: UserScopedStorage | null = null;
    private static readonly RECENT_LABELS_KEY = 'recent-expense-labels';
    private static readonly MAX_RECENT_LABELS = 3;

    setStorage(storage: UserScopedStorage): void {
        this.storage = storage;
    }

    clearStorage(): void {
        this.storage = null;
    }

    getRecentLabels(): string[] {
        if (!this.storage) return [];

        try {
            const recent = this.storage.getItem(ExpenseStorageManager.RECENT_LABELS_KEY);
            return recent ? JSON.parse(recent) : [];
        } catch {
            return [];
        }
    }

    addRecentLabel(label: string): void {
        if (!this.storage) return;

        try {
            const recent = this.getRecentLabels();
            const filtered = recent.filter((cat) => cat !== label);
            const updated = [label, ...filtered].slice(0, ExpenseStorageManager.MAX_RECENT_LABELS);
            this.storage.setItem(ExpenseStorageManager.RECENT_LABELS_KEY, JSON.stringify(updated));
        } catch {
            // Ignore storage errors
        }
    }

    saveDraft(groupId: GroupId, draftData: any): void {
        if (!this.storage) return;

        try {
            const draftKey = `expense-draft-${groupId}`;
            this.storage.setItem(draftKey, JSON.stringify(draftData));
        } catch (error) {
            logWarning('Failed to save expense draft to user-scoped storage', { error });
        }
    }

    loadDraft(groupId: GroupId): any | null {
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

    clearDraft(groupId: GroupId): void {
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

class ExpenseFormStoreImpl implements ExpenseFormStore {
    // Private signals - encapsulated within the class
    readonly #descriptionSignal = signal<string>('');
    readonly #amountSignal = signal<string>('');
    readonly #currencySignal = signal<string>(''); // Force user to select currency - detected from group data or left empty
    readonly #dateSignal = signal<string>(getTodayDate());
    readonly #timeSignal = signal<string>('12:00'); // Default to noon (12:00 PM)
    readonly #paidBySignal = signal<UserId | ''>('');
    readonly #labelsSignal = signal<ExpenseLabel[]>([]);
    readonly #locationSignal = signal<ExpenseLocation | null>(null);
    readonly #splitTypeSignal = signal<typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE>(SplitTypes.EQUAL);
    readonly #participantsSignal = signal<UserId[]>([]);
    readonly #splitsSignal = signal<ExpenseSplit[]>([]);

    // UI state signals
    readonly #loadingSignal = signal<boolean>(false);
    readonly #savingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);
    readonly #validationErrorsSignal = signal<Record<string, string>>({});

    // Receipt signals
    readonly #receiptFileSignal = signal<File | null>(null);
    readonly #receiptUrlSignal = signal<string | null>(null);
    readonly #receiptUploadingSignal = signal<boolean>(false);
    readonly #receiptErrorSignal = signal<string | null>(null);
    #originalReceiptUrl: string | null = null; // For tracking receipt replacement

    // Initial state snapshot for tracking unsaved changes
    #initialState: {
        description: string;
        amount: Amount;
        currency: string;
        date: string;
        time: string;
        paidBy: string;
        labels: ExpenseLabel[];
        splitType: typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
        participants: string[];
        splits: ExpenseSplit[];
        receiptUrl: string | null;
    } | null = null;

    private getActiveCurrency(): CurrencyISOCode | null {
        const currency = this.#currencySignal.value;
        return currency ? toCurrencyISOCode(currency) : null;
    }

    private getFieldValue(field: string): unknown {
        switch (field) {
            case 'description':
                return this.#descriptionSignal.value;
            case 'amount':
                return this.#amountSignal.value;
            case 'currency':
                return this.#currencySignal.value;
            case 'labels':
                return this.#labelsSignal.value;
            case 'location':
                return this.#locationSignal.value;
            case 'paidBy':
                return this.#paidBySignal.value;
            default:
                return undefined;
        }
    }

    private toUnits(amount: Amount): number {
        if (typeof amount === 'string' && amount.trim() === '') {
            return 0;
        }
        const currency = this.getActiveCurrency();
        if (!currency) {
            const parsed = parseFloat(amount);
            return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
        }
        try {
            return amountToSmallestUnit(amount, currency);
        } catch {
            return 0;
        }
    }

    private fromUnits(units: number): Amount {
        const currency = this.getActiveCurrency();
        if (!currency) {
            return (units / 100).toFixed(2);
        }
        return smallestUnitToAmountString(units, currency);
    }

    private normalizeAmountInput(value: Amount | number): Amount {
        if (typeof value === 'number') {
            return value.toString();
        }
        return value;
    }

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
    get labels() {
        return this.#labelsSignal.value;
    }
    get location() {
        return this.#locationSignal.value;
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
    get receiptFile() {
        return this.#receiptFileSignal.value;
    }
    get receiptUrl() {
        return this.#receiptUrlSignal.value;
    }
    get receiptUploading() {
        return this.#receiptUploadingSignal.value;
    }
    get receiptError() {
        return this.#receiptErrorSignal.value;
    }

    // Signal accessors for reactive components - return readonly signals
    get descriptionSignal(): ReadonlySignal<string> {
        return this.#descriptionSignal;
    }
    get amountSignal(): ReadonlySignal<string> {
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
    get labelsSignal(): ReadonlySignal<ExpenseLabel[]> {
        return this.#labelsSignal;
    }
    get locationSignal(): ReadonlySignal<ExpenseLocation | null> {
        return this.#locationSignal;
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
    get receiptFileSignal(): ReadonlySignal<File | null> {
        return this.#receiptFileSignal;
    }
    get receiptUrlSignal(): ReadonlySignal<string | null> {
        return this.#receiptUrlSignal;
    }
    get receiptUploadingSignal(): ReadonlySignal<boolean> {
        return this.#receiptUploadingSignal;
    }
    get receiptErrorSignal(): ReadonlySignal<string | null> {
        return this.#receiptErrorSignal;
    }

    // Computed property to check if required fields are filled (for button enabling)
    get hasRequiredFields(): boolean {
        // Check basic required fields are filled (not empty)
        if (!this.#descriptionSignal.value?.trim()) return false;
        if (this.toUnits(this.#amountSignal.value) <= 0) return false;
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
        if (this.toUnits(this.#amountSignal.value) <= 0) return false;

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
            case 'amount': {
                const amountValue = this.normalizeAmountInput(value as Amount | number);
                const currency = this.getActiveCurrency();
                const previousAmount = this.#amountSignal.value;

                this.#amountSignal.value = amountValue;

                if (amountValue.trim() === '') {
                    this.#splitsSignal.value = [];
                    break;
                }

                if (!currency) {
                    break;
                }

                const precisionError = getAmountPrecisionError(amountValue, currency);
                if (precisionError) {
                    this.#splitsSignal.value = [];
                    break;
                }

                if (this.#splitTypeSignal.value === SplitTypes.EQUAL) {
                    this.calculateEqualSplits();
                } else if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
                    const amountUnits = this.toUnits(amountValue);
                    const updatedSplits = this.#splitsSignal.value.map((split) => {
                        if (split.percentage === undefined) {
                            return split;
                        }
                        const splitUnits = Math.round((amountUnits * split.percentage) / 100);
                        return {
                            ...split,
                            amount: this.fromUnits(splitUnits),
                        };
                    });
                    this.#splitsSignal.value = updatedSplits;
                } else if (this.#splitTypeSignal.value === SplitTypes.EXACT) {
                    const currentSplits = [...this.#splitsSignal.value];
                    const newUnits = this.toUnits(amountValue);
                    const oldUnits = this.toUnits(previousAmount);

                    if (oldUnits > 0 && currentSplits.length > 0) {
                        let allocated = 0;
                        currentSplits.forEach((split, index) => {
                            const splitUnits = this.toUnits(split.amount);
                            let updatedUnits: number;
                            if (index === currentSplits.length - 1) {
                                updatedUnits = Math.max(0, newUnits - allocated);
                            } else {
                                updatedUnits = Math.round((splitUnits * newUnits) / oldUnits);
                                allocated += updatedUnits;
                            }
                            currentSplits[index] = {
                                ...split,
                                amount: this.fromUnits(updatedUnits),
                            };
                        });
                        this.#splitsSignal.value = currentSplits;
                    } else {
                        this.#splitsSignal.value = calculateExactSplits(amountValue, currency, this.#participantsSignal.value);
                    }
                }
                break;
            }
            case 'currency':
                this.#currencySignal.value = value as string;

                // Revalidate amount when currency changes (precision rules depend on currency)
                const currentErrors = { ...this.#validationErrorsSignal.value };
                const amountIsEmpty = this.#amountSignal.value.trim() === '';
                if (!amountIsEmpty) {
                    const amountError = this.validateField('amount');
                    if (amountError) {
                        currentErrors.amount = amountError;
                    } else {
                        delete currentErrors.amount;
                    }
                } else {
                    delete currentErrors.amount;
                }
                this.#validationErrorsSignal.value = currentErrors;

                // Recalculate splits when currency changes (currency affects split precision)
                // Only recalculate if we have all required data
                if (this.toUnits(this.#amountSignal.value) > 0 && this.#participantsSignal.value.length > 0) {
                    this.handleSplitTypeChange(this.#splitTypeSignal.value);
                }
                break;
            case 'date':
                this.#dateSignal.value = value as string;
                break;
            case 'time':
                this.#timeSignal.value = value as string;
                break;
            case 'paidBy': {
                const paidByValue = value as UserId | '';
                this.#paidBySignal.value = paidByValue;
                // Auto-add payer to participants if not already included
                if (paidByValue && !this.#participantsSignal.value.includes(paidByValue)) {
                    this.#participantsSignal.value = [...this.#participantsSignal.value, paidByValue];
                }
                // Always recalculate splits when payer changes
                // This handles the case where participants list changed (e.g., member left group)
                // Only recalculate if we have all required data
                if (this.#currencySignal.value && this.toUnits(this.#amountSignal.value) > 0 && this.#participantsSignal.value.length > 0) {
                    this.handleSplitTypeChange(this.#splitTypeSignal.value);
                }
                break;
            }
            case 'labels':
                this.#labelsSignal.value = value as ExpenseLabel[];
                break;
            case 'location':
                this.#locationSignal.value = value as ExpenseLocation | null;
                break;
            case 'splitType':
                this.#splitTypeSignal.value = value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE;
                this.handleSplitTypeChange(value as typeof SplitTypes.EQUAL | typeof SplitTypes.EXACT | typeof SplitTypes.PERCENTAGE);
                break;
        }

        // Perform real-time validation for the field
        // Skip validation for currency if it's empty (user hasn't selected one yet)
        const valueAsString = typeof value === 'string' ? value : undefined;
        const isAmountCleared = field === 'amount' && valueAsString === '';
        let shouldValidate = field !== 'currency' || (value as string) !== '';

        if (isAmountCleared) {
            shouldValidate = false;
        }

        const errors = { ...this.#validationErrorsSignal.value };
        if (shouldValidate) {
            const fieldError = this.validateField(field, value);

            if (fieldError) {
                errors[field] = fieldError;
            } else {
                delete errors[field];
            }
        } else {
            // Clear any existing error for this field
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

    /**
     * Validate a field on blur event (when user leaves the field).
     * This ensures validation runs even for empty fields that were skipped during onChange.
     */
    validateOnBlur(field: keyof ExpenseFormData): void {
        const errors = { ...this.#validationErrorsSignal.value };
        const fieldError = this.validateField(field);

        if (fieldError) {
            errors[field] = fieldError;
        } else {
            delete errors[field];
        }

        this.#validationErrorsSignal.value = errors;
    }

    setParticipants(participants: UserId[]): void {
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

    toggleParticipant(uid: UserId): void {
        const current = this.#participantsSignal.value;
        const isIncluded = current.includes(uid);

        // Don't allow removing the payer
        if (uid === this.#paidBySignal.value && isIncluded) {
            return;
        }

        if (isIncluded) {
            this.#participantsSignal.value = current.filter((id) => id !== uid);
        } else {
            this.#participantsSignal.value = [...current, uid];
        }

        // Recalculate splits based on current type
        this.handleSplitTypeChange(this.#splitTypeSignal.value);
    }

    calculateEqualSplits(): void {
        const participants = this.#participantsSignal.value;
        const amount = this.#amountSignal.value;
        const currency = this.getActiveCurrency();

        if (participants.length === 0 || this.toUnits(amount) <= 0 || !currency) {
            this.#splitsSignal.value = [];
            return;
        }

        const precisionError = getAmountPrecisionError(amount, currency);
        if (precisionError) {
            this.#splitsSignal.value = [];
            return;
        }

        // Use shared currency-aware split calculation
        this.#splitsSignal.value = calculateEqualSplits(amount, currency, participants);
    }

    updateSplitAmount(uid: UserId, amount: Amount | number): void {
        const currentSplits = [...this.#splitsSignal.value];
        const splitIndex = currentSplits.findIndex((s) => s.uid === uid);
        const normalizedAmount = this.normalizeAmountInput(amount);

        if (splitIndex >= 0) {
            currentSplits[splitIndex] = { ...currentSplits[splitIndex], amount: normalizedAmount };
        } else {
            currentSplits.push({ uid, amount: normalizedAmount });
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

    updateSplitPercentage(uid: UserId, percentage: number): void {
        const currentSplits = [...this.#splitsSignal.value];
        const splitIndex = currentSplits.findIndex((s) => s.uid === uid);
        const currency = this.getActiveCurrency();

        if (!currency) {
            return;
        }

        const amountUnits = this.toUnits(this.#amountSignal.value);
        const splitUnits = Math.round((amountUnits * percentage) / 100);
        const formattedAmount = this.fromUnits(splitUnits);

        if (splitIndex >= 0) {
            currentSplits[splitIndex] = {
                ...currentSplits[splitIndex],
                percentage,
                amount: formattedAmount,
            };
        } else {
            currentSplits.push({
                uid,
                percentage,
                amount: formattedAmount,
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
        const amount = this.#amountSignal.value;
        const currency = this.getActiveCurrency();

        if (participants.length === 0 || this.toUnits(amount) <= 0 || !currency) {
            this.#splitsSignal.value = [];
            return;
        }

        const precisionError = getAmountPrecisionError(amount, currency);
        if (precisionError) {
            this.#splitsSignal.value = [];
            return;
        }

        switch (newType) {
            case SplitTypes.EQUAL:
                // Use shared currency-aware equal split calculation
                this.#splitsSignal.value = calculateEqualSplits(amount, currency, participants);
                break;

            case SplitTypes.EXACT:
                // Use shared currency-aware exact split calculation (equal amounts as starting point)
                this.#splitsSignal.value = calculateExactSplits(amount, currency, participants);
                break;

            case SplitTypes.PERCENTAGE:
                // Use shared currency-aware percentage split calculation
                this.#splitsSignal.value = calculatePercentageSplits(amount, currency, participants);
                break;
        }
    }

    private validateField(field: string, value?: any): string | null {
        // Schema-validated fields
        const schemaFields = ['description', 'amount', 'currency', 'labels', 'paidBy'] as const;

        if (schemaFields.includes(field as typeof schemaFields[number])) {
            const fieldValue = value ?? this.getFieldValue(field);
            const fieldSchema = ExpenseFormFieldsSchema.shape[field as keyof typeof ExpenseFormFieldsSchema.shape];
            const result = fieldSchema.safeParse(fieldValue);

            if (!result.success) {
                return result.error.issues[0]?.message || 'Invalid value';
            }

            // Additional currency-dependent amount precision check (not in schema)
            if (field === 'amount') {
                const currency = this.getActiveCurrency();
                if (currency) {
                    const amountValue = this.normalizeAmountInput(fieldValue as Amount | number);
                    const precisionError = getAmountPrecisionError(amountValue, currency);
                    if (precisionError) {
                        return precisionError;
                    }
                }
            }

            return null;
        }

        // Manual validation for complex fields
        switch (field) {
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

            case 'participants':
                const parts = value ?? this.#participantsSignal.value;
                if (parts.length === 0) {
                    return 'At least one participant is required';
                }
                break;

            case 'splits':
                // Validate splits based on split type
                if (this.#splitTypeSignal.value === SplitTypes.EXACT) {
                    const currencyRequired = this.getActiveCurrency();
                    if (!currencyRequired) {
                        return 'Currency must be selected before configuring splits';
                    }
                    const totalSplitUnits = this.#splitsSignal.value.reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currencyRequired), 0);
                    const amountUnits = amountToSmallestUnit(this.#amountSignal.value, currencyRequired);
                    if (totalSplitUnits !== amountUnits) {
                        return `Split amounts must equal the total expense amount`;
                    }
                } else if (this.#splitTypeSignal.value === SplitTypes.PERCENTAGE) {
                    const currencyRequired = this.getActiveCurrency();
                    if (!currencyRequired) {
                        return 'Currency must be selected before configuring splits';
                    }
                    const totalPercentage = this.#splitsSignal.value.reduce((sum, split) => sum + (split.percentage || 0), 0);
                    if (Math.round(totalPercentage * 1000) !== 100 * 1000) {
                        return 'Percentages must add up to 100%';
                    }
                    const totalSplitUnits = this.#splitsSignal.value.reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currencyRequired), 0);
                    const amountUnits = amountToSmallestUnit(this.#amountSignal.value, currencyRequired);
                    if (totalSplitUnits !== amountUnits) {
                        return 'Split amounts must equal the total expense amount';
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

        const labelsError = this.validateField('labels');
        if (labelsError) errors.labels = labelsError;

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

    async saveExpense(groupId: GroupId): Promise<ExpenseDTO> {
        if (!this.validateForm()) {
            const errors = this.#validationErrorsSignal.value;
            logWarning('[ExpenseForm] Cannot submit form due to validation errors', { errors });
            throw new Error('Please fix validation errors');
        }

        this.#savingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Upload receipt if file selected
            let receiptUrl: string | undefined = this.#receiptUrlSignal.value ?? undefined;
            if (this.#receiptFileSignal.value) {
                this.#receiptUploadingSignal.value = true;
                try {
                    const response = await apiClient.uploadAttachment(
                        groupId,
                        'receipt',
                        this.#receiptFileSignal.value,
                        this.#receiptFileSignal.value.type,
                    );
                    receiptUrl = response.url;
                } catch (uploadError) {
                    this.#receiptErrorSignal.value = 'Failed to upload receipt';
                    throw uploadError;
                } finally {
                    this.#receiptUploadingSignal.value = false;
                }
            }

            // Convert date and time to UTC timestamp
            const utcDateTime = getUTCDateTime(this.#dateSignal.value, this.#timeSignal.value);

            const amount = this.#amountSignal.value;
            const paidBy = this.#paidBySignal.value;

            // Validation ensures paidBy is not empty
            if (!paidBy) {
                throw new Error('paidBy is required');
            }

            const request: CreateExpenseRequest = {
                groupId,
                description: this.#descriptionSignal.value.trim(),
                amount: amount,
                currency: toCurrencyISOCode(this.#currencySignal.value),
                paidBy,
                labels: this.#labelsSignal.value,
                location: this.#locationSignal.value ?? undefined,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
                receiptUrl,
            };

            const expense = await apiClient.createExpense(request);

            // Track recent labels
            for (const label of this.#labelsSignal.value) {
                storageManager.addRecentLabel(label);
            }

            // Clear draft and reset form immediately after successful creation
            this.clearDraft(groupId);
            this.reset();

            // Activity feed handles refresh automatically via SSE

            return expense;
        } catch (error) {
            this.#errorSignal.value = this.getErrorMessage(error);
            throw error;
        } finally {
            this.#savingSignal.value = false;
        }
    }

    async updateExpense(groupId: GroupId, expenseId: ExpenseId): Promise<ExpenseDTO> {
        if (!this.validateForm()) {
            throw new Error('Please fix validation errors');
        }

        this.#savingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            // Handle receipt upload/replacement/removal
            let receiptUrl: string | undefined = this.#receiptUrlSignal.value ?? undefined;

            // Upload new receipt if file selected
            if (this.#receiptFileSignal.value) {
                this.#receiptUploadingSignal.value = true;
                try {
                    const response = await apiClient.uploadAttachment(
                        groupId,
                        'receipt',
                        this.#receiptFileSignal.value,
                        this.#receiptFileSignal.value.type,
                    );
                    receiptUrl = response.url;
                } catch (uploadError) {
                    this.#receiptErrorSignal.value = 'Failed to upload receipt';
                    throw uploadError;
                } finally {
                    this.#receiptUploadingSignal.value = false;
                }
            }

            // Delete old receipt if replacing or removing (fire-and-forget)
            const oldReceiptUrl = this.#originalReceiptUrl;
            const isReplacingReceipt = this.#receiptFileSignal.value !== null;
            const isRemovingReceipt = !this.#receiptUrlSignal.value && !this.#receiptFileSignal.value;
            if (oldReceiptUrl && (isReplacingReceipt || isRemovingReceipt)) {
                const oldAttachmentId = this.extractAttachmentIdFromUrl(oldReceiptUrl);
                if (oldAttachmentId) {
                    apiClient.deleteAttachment(groupId, oldAttachmentId).catch((err) => {
                        logWarning('[ExpenseForm] Failed to delete old receipt', { error: err });
                    });
                }
            }

            // Convert date and time to UTC timestamp
            const utcDateTime = getUTCDateTime(this.#dateSignal.value, this.#timeSignal.value);

            // For updates, only include fields that can be changed
            // Backend doesn't allow changing: groupId, paidBy
            const amount = this.#amountSignal.value;
            const updateRequest = {
                description: this.#descriptionSignal.value.trim(),
                amount: amount,
                currency: this.#currencySignal.value,
                labels: this.#labelsSignal.value,
                location: this.#locationSignal.value ?? undefined,
                date: utcDateTime,
                splitType: this.#splitTypeSignal.value,
                participants: this.#participantsSignal.value,
                splits: this.#splitsSignal.value,
                receiptUrl,
            };

            // updateExpense returns the NEW expense (edit history creates a new document with new ID)
            const updatedExpense = await apiClient.updateExpense(expenseId, updateRequest as CreateExpenseRequest);

            // Track recent labels
            for (const label of this.#labelsSignal.value) {
                storageManager.addRecentLabel(label);
            }

            // Clear draft immediately after successful update
            this.clearDraft(groupId);

            // Activity feed handles refresh automatically via SSE

            return updatedExpense;
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

    // Receipt management methods
    setReceiptFile(file: File | null): void {
        this.#receiptFileSignal.value = file;
        this.#receiptErrorSignal.value = null;
        // When a new file is selected, clear the URL (we'll get a new one after upload)
        if (file) {
            this.#receiptUrlSignal.value = null;
        }
    }

    setReceiptUrl(url: string | null): void {
        this.#receiptUrlSignal.value = url;
        // Track original URL for replacement detection
        this.#originalReceiptUrl = url;
        this.#receiptFileSignal.value = null;
        this.#receiptErrorSignal.value = null;
    }

    clearReceiptError(): void {
        this.#receiptErrorSignal.value = null;
    }

    /**
     * Extract attachment ID from proxy URL.
     * URL format: /api/groups/{groupId}/attachments/{attachmentId}
     */
    private extractAttachmentIdFromUrl(url: string): AttachmentId | null {
        const match = url.match(/\/attachments\/([^/?]+)/);
        return match ? toAttachmentId(match[1]) : null;
    }

    reset(): void {
        this.#descriptionSignal.value = '';
        this.#amountSignal.value = '';
        this.#currencySignal.value = ''; // Force user to select currency
        this.#dateSignal.value = getTodayDate();
        this.#timeSignal.value = '12:00'; // Default to noon
        this.#paidBySignal.value = '';
        this.#labelsSignal.value = [];
        this.#locationSignal.value = null;
        this.#splitTypeSignal.value = SplitTypes.EQUAL;
        this.#participantsSignal.value = [];
        this.#splitsSignal.value = [];
        this.#errorSignal.value = null;
        this.#validationErrorsSignal.value = {};
        // Reset receipt state
        this.#receiptFileSignal.value = null;
        this.#receiptUrlSignal.value = null;
        this.#receiptUploadingSignal.value = false;
        this.#receiptErrorSignal.value = null;
        this.#originalReceiptUrl = null;
    }

    /**
     * Capture the current form state as the initial state for change tracking
     */
    captureInitialState(): void {
        this.#initialState = {
            description: this.#descriptionSignal.value,
            amount: this.#amountSignal.value,
            currency: this.#currencySignal.value,
            date: this.#dateSignal.value,
            time: this.#timeSignal.value,
            paidBy: this.#paidBySignal.value,
            labels: [...this.#labelsSignal.value],
            splitType: this.#splitTypeSignal.value,
            participants: [...this.#participantsSignal.value],
            splits: [...this.#splitsSignal.value],
            receiptUrl: this.#receiptUrlSignal.value,
        };
    }

    hasUnsavedChanges(): boolean {
        // If no initial state captured yet, compare against empty/default state
        if (!this.#initialState) {
            const hasAmount = this.toUnits(this.#amountSignal.value) > 0;
            return (
                this.#descriptionSignal.value.trim() !== ''
                || hasAmount
                || this.#currencySignal.value !== ''
                || this.#dateSignal.value !== getTodayDate()
                || this.#paidBySignal.value !== ''
                || this.#labelsSignal.value.length > 0
                || this.#splitTypeSignal.value !== SplitTypes.EQUAL
                || this.#participantsSignal.value.length > 0
                || this.#splitsSignal.value.length > 0
                || this.#receiptFileSignal.value !== null
                || this.#receiptUrlSignal.value !== null
            );
        }

        // Compare current state against captured initial state
        // Receipt has changed if: file selected, URL changed, or URL removed
        const receiptChanged = this.#receiptFileSignal.value !== null
            || this.#receiptUrlSignal.value !== this.#initialState.receiptUrl;

        return (
            this.#descriptionSignal.value !== this.#initialState.description
            || this.#amountSignal.value !== this.#initialState.amount
            || this.#currencySignal.value !== this.#initialState.currency
            || this.#dateSignal.value !== this.#initialState.date
            || this.#timeSignal.value !== this.#initialState.time
            || this.#paidBySignal.value !== this.#initialState.paidBy
            || JSON.stringify(this.#labelsSignal.value) !== JSON.stringify(this.#initialState.labels)
            || this.#splitTypeSignal.value !== this.#initialState.splitType
            || JSON.stringify(this.#participantsSignal.value) !== JSON.stringify(this.#initialState.participants)
            || JSON.stringify(this.#splitsSignal.value) !== JSON.stringify(this.#initialState.splits)
            || receiptChanged
        );
    }

    setStorage(storage: UserScopedStorage): void {
        storageManager.setStorage(storage);
    }

    clearStorage(): void {
        storageManager.clearStorage();
    }

    saveDraft(groupId: GroupId): void {
        const draftData = {
            description: this.#descriptionSignal.value,
            amount: this.#amountSignal.value,
            currency: this.#currencySignal.value,
            date: this.#dateSignal.value,
            time: this.#timeSignal.value,
            paidBy: this.#paidBySignal.value,
            labels: this.#labelsSignal.value,
            location: this.#locationSignal.value ?? undefined,
            splitType: this.#splitTypeSignal.value,
            participants: this.#participantsSignal.value,
            splits: this.#splitsSignal.value,
            timestamp: Date.now(),
        };

        storageManager.saveDraft(groupId, draftData);
    }

    loadDraft(groupId: GroupId): boolean {
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
            this.#amountSignal.value = draftData.amount ?? '';
            this.#currencySignal.value = draftData.currency || ''; // Force user to select if draft has none
            this.#dateSignal.value = draftData.date || getTodayDate();
            this.#timeSignal.value = draftData.time || '12:00'; // Default to noon
            this.#paidBySignal.value = draftData.paidBy || '';
            this.#labelsSignal.value = draftData.labels || [];
            this.#locationSignal.value = draftData.location ?? null;
            this.#splitTypeSignal.value = draftData.splitType || SplitTypes.EQUAL;
            this.#participantsSignal.value = draftData.participants || [];
            this.#splitsSignal.value = draftData.splits || [];

            return true;
        } catch (error) {
            logWarning('Failed to load expense draft from user-scoped storage', { error });
            return false;
        }
    }

    clearDraft(groupId: GroupId): void {
        storageManager.clearDraft(groupId);
    }

    private getErrorMessage(error: unknown): string {
        const t = i18n.t.bind(i18n);
        return translateApiError(error, t);
    }
}

// Export singleton instance
export const expenseFormStore = new ExpenseFormStoreImpl();
