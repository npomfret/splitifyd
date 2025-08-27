import { route } from 'preact-router';
import { useExpenseForm } from '../app/hooks/useExpenseForm';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { Card, Button } from '@/components/ui';
import { Stack } from '@/components/ui';
import { LoadingState, ErrorState } from '@/components/ui';
import { BaseLayout } from '../components/layout/BaseLayout';
import { ExpenseFormHeader, ExpenseBasicFields, PayerSelector, ParticipantSelector, SplitTypeSelector, SplitAmountInputs, ExpenseFormActions } from '@/components/expense-form';

interface AddExpensePageProps {
    groupId?: string;
}

export default function AddExpensePage({ groupId }: AddExpensePageProps) {
    // Parse URL parameters for edit mode and copy mode
    const urlParams = new URLSearchParams(window.location.search);
    const expenseId = urlParams.get('id');
    const isEditMode = urlParams.get('edit') === 'true' && !!expenseId;
    const isCopyMode = urlParams.get('copy') === 'true';
    const sourceExpenseId = urlParams.get('sourceId');

    // Authentication check
    useAuthRequired();

    // Show error if no groupId
    if (!groupId) {
        return (
            <BaseLayout title="Error - Splitifyd">
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                    <Card className="max-w-md w-full">
                        <Stack spacing="md">
                            <h2 className="text-xl font-semibold text-red-600" role="alert" data-testid="page-error-title">Error</h2>
                            <p className="text-gray-600">No group specified. Cannot add expense without a group.</p>
                            <Button variant="primary" onClick={() => route('/dashboard')}>
                                Back to Dashboard
                            </Button>
                        </Stack>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Use the custom hook for all form logic
    const formState = useExpenseForm({
        groupId,
        expenseId,
        isEditMode,
        isCopyMode,
        sourceExpenseId,
    });

    // Show loading while initializing
    if (!formState.isDataReady && !formState.initError) {
        return (
            <BaseLayout title="Loading... - Splitifyd">
                <LoadingState fullPage message="Loading expense form..." />
            </BaseLayout>
        );
    }

    // Show error if initialization failed
    if (formState.initError) {
        return (
            <BaseLayout title="Error - Splitifyd">
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                    <Card className="max-w-md w-full">
                        <Stack spacing="md">
                            <h2 className="text-xl font-semibold text-red-600" role="alert" data-testid="page-error-title">Error</h2>
                            <p className="text-gray-600">{formState.initError}</p>
                            <Button variant="primary" onClick={() => route(`/groups/${groupId}`)}>
                                Back to Group
                            </Button>
                        </Stack>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Show error if group not found
    if (!formState.group) {
        return (
            <BaseLayout title="Error - Splitifyd">
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                    <Card className="max-w-md w-full">
                        <Stack spacing="md">
                            <h2 className="text-xl font-semibold text-red-600" role="alert" data-testid="page-error-title">Group Not Found</h2>
                            <p className="text-gray-600">The group you're trying to add an expense to doesn't exist or you don't have access to it.</p>
                            <Button variant="primary" onClick={() => route('/dashboard')}>
                                Back to Dashboard
                            </Button>
                        </Stack>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Determine page title and description based on mode
    const pageTitle = isCopyMode ? 'Copy Expense' : isEditMode ? 'Edit Expense' : 'Add Expense';
    const pageDescription = isCopyMode ? 'Copy expense' : isEditMode ? 'Edit expense' : 'Add a new expense';

    return (
        <BaseLayout title={`${pageTitle} - ${formState.group.name} - Splitifyd`} description={`${pageDescription} in ${formState.group.name}`} headerVariant="dashboard">
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <ExpenseFormHeader isEditMode={isEditMode} isCopyMode={isCopyMode} groupName={formState.group.name} onCancel={formState.handleCancel} />

                <div className="max-w-3xl mx-auto px-4 py-6">
                    <form onSubmit={formState.handleSubmit}>
                        <Stack spacing="md">
                            {/* Error message */}
                            {formState.formError && <ErrorState error={formState.formError} className="mb-4" />}

                            {/* Basic expense details */}
                            <ExpenseBasicFields
                                description={formState.description}
                                amount={formState.amount}
                                currency={formState.currency}
                                date={formState.date}
                                time={formState.time}
                                category={formState.category}
                                validationErrors={formState.validationErrors}
                                updateField={formState.updateField}
                                getRecentAmounts={formState.getRecentAmounts}
                                PREDEFINED_EXPENSE_CATEGORIES={formState.PREDEFINED_EXPENSE_CATEGORIES}
                            />

                            {/* Payer selection */}
                            <PayerSelector members={formState.members} paidBy={formState.paidBy} validationErrors={formState.validationErrors} updateField={formState.updateField} />

                            {/* Participant selection */}
                            <ParticipantSelector
                                members={formState.members}
                                participants={formState.participants}
                                paidBy={formState.paidBy}
                                validationErrors={formState.validationErrors}
                                handleParticipantToggle={formState.handleParticipantToggle}
                                handleSelectAll={formState.handleSelectAll}
                                handleSelectNone={formState.handleSelectNone}
                            />

                            {/* Split type and amounts */}
                            {formState.participants.length > 0 && (
                                <>
                                    <SplitTypeSelector splitType={formState.splitType} updateField={formState.updateField} />

                                    <Card>
                                        <SplitAmountInputs
                                            splitType={formState.splitType}
                                            amount={formState.amount}
                                            participants={formState.participants}
                                            splits={formState.splits}
                                            members={formState.members}
                                            updateSplitAmount={formState.updateSplitAmount}
                                            updateSplitPercentage={formState.updateSplitPercentage}
                                        />

                                        {formState.validationErrors.splits && <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert" data-testid="validation-error-splits">{formState.validationErrors.splits}</p>}
                                    </Card>
                                </>
                            )}

                            {/* Form actions */}
                            <ExpenseFormActions
                                isEditMode={isEditMode || isCopyMode}
                                saving={formState.saving}
                                participantsCount={formState.participants.length}
                                hasRequiredFields={formState.hasRequiredFields}
                                onCancel={formState.handleCancel}
                            />
                        </Stack>
                    </form>
                </div>
            </div>
        </BaseLayout>
    );
}
