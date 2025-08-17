import { Button } from '../ui';

interface ExpenseFormHeaderProps {
    isEditMode: boolean;
    isCopyMode?: boolean;
    groupName: string;
    onCancel: () => void;
}

export function ExpenseFormHeader({ isEditMode, isCopyMode, groupName, onCancel }: ExpenseFormHeaderProps) {
    return (
        <div className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="max-w-3xl mx-auto px-4 py-4">
                <div className="flex flex-row items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isCopyMode ? 'Copy Expense' : isEditMode ? 'Edit Expense' : 'Add Expense'}</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{groupName}</p>
                    </div>
                    <Button variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}
