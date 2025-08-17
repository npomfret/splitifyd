import { Button } from '../ui';

interface ExpenseFormActionsProps {
    isEditMode: boolean;
    saving: boolean;
    participantsCount: number;
    hasRequiredFields: boolean;
    onCancel: () => void;
}

export function ExpenseFormActions({ isEditMode, saving, participantsCount, hasRequiredFields, onCancel }: ExpenseFormActionsProps) {
    return (
        <div className="flex flex-row justify-end space-x-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || participantsCount === 0 || !hasRequiredFields}>
                {saving ? (isEditMode ? 'Updating...' : 'Saving...') : isEditMode ? 'Update Expense' : 'Save Expense'}
            </Button>
        </div>
    );
}
