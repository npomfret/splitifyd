import { ExpenseBasicFields, ExpenseFormActions, ExpenseFormHeader, ParticipantSelector, PayerSelector, SplitAmountInputs, SplitTypeSelector } from '@/components/expense-form';
import { Button, Card } from '@/components/ui';
import { Stack } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/ui';
import { navigationService } from '@/services/navigation.service';
import { useTranslation } from 'react-i18next';
import { useAuthRequired } from '../app/hooks/useAuthRequired';
import { useExpenseForm } from '../app/hooks/useExpenseForm';
import { BaseLayout } from '../components/layout/BaseLayout';

interface AddExpensePageProps {
    groupId?: string;
}

export default function AddExpensePage({ groupId }: AddExpensePageProps) {
    const { t } = useTranslation();
    // Parse URL parameters for edit mode and copy mode
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const expenseId = searchParams?.get('id');
    const isEditMode = searchParams?.get('edit') === 'true' && !!expenseId;
    const isCopyMode = searchParams?.get('copy') === 'true';
    const sourceExpenseId = searchParams?.get('sourceId') || undefined;

    // Authentication check
    useAuthRequired();

    // Show error if no groupId
    if (!groupId) {
        return (
            <BaseLayout title={t('pages.addExpensePage.errorTitle')}>
                <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4'>
                    <Card className='max-w-md w-full'>
                        <Stack spacing='md'>
                            <h2 className='text-xl font-semibold text-red-600' role='alert' data-testid='page-error-title'>
                                {t('pages.addExpensePage.error')}
                            </h2>
                            <p className='text-gray-600'>{t('pages.addExpensePage.noGroupMessage')}</p>
                            <Button variant='primary' onClick={() => navigationService.goToDashboard()}>
                                {t('pages.addExpensePage.backToDashboard')}
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
            <BaseLayout title={t('pages.addExpensePage.loadingTitle')}>
                <LoadingState fullPage message={t('app.loadingExpenseForm')} />
            </BaseLayout>
        );
    }

    // Show error if initialization failed
    if (formState.initError) {
        return (
            <BaseLayout title={t('pages.addExpensePage.errorTitle')}>
                <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4'>
                    <Card className='max-w-md w-full'>
                        <Stack spacing='md'>
                            <h2 className='text-xl font-semibold text-red-600' role='alert' data-testid='page-error-title'>
                                {t('pages.addExpensePage.error')}
                            </h2>
                            <p className='text-gray-600'>{formState.initError}</p>
                            <Button variant='primary' onClick={() => navigationService.goToGroup(groupId)}>
                                {t('pages.addExpensePage.backToGroup')}
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
            <BaseLayout title={t('pages.addExpensePage.errorTitle')}>
                <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4'>
                    <Card className='max-w-md w-full'>
                        <Stack spacing='md'>
                            <h2 className='text-xl font-semibold text-red-600' role='alert' data-testid='page-error-title'>
                                {t('pages.addExpensePage.groupNotFound')}
                            </h2>
                            <p className='text-gray-600'>{t('pages.addExpensePage.groupNotFoundMessage')}</p>
                            <Button variant='primary' onClick={() => navigationService.goToDashboard()}>
                                {t('pages.addExpensePage.backToDashboard')}
                            </Button>
                        </Stack>
                    </Card>
                </div>
            </BaseLayout>
        );
    }

    // Determine page title and description based on mode
    const pageTitle = isCopyMode ? t('pages.addExpensePage.copyExpenseTitle') : isEditMode ? t('pages.addExpensePage.editExpenseTitle') : t('pages.addExpensePage.addExpenseTitle');
    const pageDescription = isCopyMode ? t('pages.addExpensePage.copyExpenseAction') : isEditMode ? t('pages.addExpensePage.editExpenseAction') : t('pages.addExpensePage.addExpenseAction');

    return (
        <BaseLayout
            title={`${pageTitle} - ${formState.group.name}${t('pages.addExpensePage.titleSuffix')}`}
            description={`${pageDescription}${t('pages.addExpensePage.titleIn')}${formState.group.name}`}
            headerVariant='dashboard'
        >
            <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
                <ExpenseFormHeader isEditMode={isEditMode} isCopyMode={isCopyMode} groupName={formState.group.name} onCancel={formState.handleCancel} />

                <div className='max-w-3xl mx-auto px-4 py-6'>
                    <form onSubmit={formState.handleSubmit}>
                        <Stack spacing='md'>
                            {/* Error message */}
                            {formState.formError && <ErrorState error={formState.formError} className='mb-4' />}

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
                                            currency={formState.currency}
                                            participants={formState.participants}
                                            splits={formState.splits}
                                            members={formState.members}
                                            updateSplitAmount={formState.updateSplitAmount}
                                            updateSplitPercentage={formState.updateSplitPercentage}
                                        />

                                        {formState.validationErrors.splits && (
                                            <p className='text-sm text-red-600 dark:text-red-400 mt-2' role='alert' data-testid='validation-error-splits'>
                                                {formState.validationErrors.splits}
                                            </p>
                                        )}
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
