import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { expenseFormStore, EXPENSE_CATEGORIES } from '../app/stores/expense-form-store';
import { groupDetailStore } from '../app/stores/group-detail-store';
import { authStore } from '../app/stores/auth-store';
import { LoadingSpinner, Card, Button } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { V2Indicator } from '../components/ui/V2Indicator';

interface AddExpensePageProps {
  groupId?: string;
}

export default function AddExpensePage({ groupId }: AddExpensePageProps) {
  const isInitialized = useSignal(false);
  
  // Computed values from stores
  const currentUser = useComputed(() => authStore.user);
  const group = useComputed(() => groupDetailStore.group);
  const loading = useComputed(() => groupDetailStore.loading);
  const saving = useComputed(() => expenseFormStore.saving);
  const formError = useComputed(() => expenseFormStore.error);
  const validationErrors = useComputed(() => expenseFormStore.validationErrors);
  
  // Form field values
  const description = useComputed(() => expenseFormStore.description);
  const amount = useComputed(() => expenseFormStore.amount);
  const date = useComputed(() => expenseFormStore.date);
  const paidBy = useComputed(() => expenseFormStore.paidBy);
  const category = useComputed(() => expenseFormStore.category);
  const participants = useComputed(() => expenseFormStore.participants);
  const splits = useComputed(() => expenseFormStore.splits);
  
  // Initialize form on mount
  useEffect(() => {
    if (!groupId) {
      route('/dashboard');
      return;
    }
    
    const initializeForm = async () => {
      try {
        // Reset form to clean state
        expenseFormStore.reset();
        
        // Ensure group data is loaded
        if (!group.value || group.value.id !== groupId) {
          await groupDetailStore.fetchGroup(groupId);
        }
        
        // Set current user as payer by default
        if (currentUser.value) {
          expenseFormStore.updateField('paidBy', currentUser.value.uid);
        }
        
        isInitialized.value = true;
      } catch (error) {
        console.error('Failed to initialize add expense form:', error);
        route(`/groups/${groupId}`);
      }
    };
    
    initializeForm();
    
    // Cleanup on unmount
    return () => {
      expenseFormStore.reset();
    };
  }, [groupId]);
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!groupId) return;
    
    try {
      await expenseFormStore.saveExpense(groupId);
      // Navigate back to group detail on success
      route(`/groups/${groupId}`);
    } catch (error) {
      // Error is handled by the store
      console.error('Failed to save expense:', error);
    }
  };
  
  const handleCancel = () => {
    // TODO: Add confirmation if form has unsaved changes
    route(`/groups/${groupId}`);
  };
  
  const handleAmountChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const value = parseFloat(input.value) || 0;
    expenseFormStore.updateField('amount', value);
  };
  
  const handleParticipantToggle = (memberId: string) => {
    expenseFormStore.toggleParticipant(memberId);
  };
  
  // Show loading while initializing
  if (!isInitialized.value || loading.value) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Redirect if no group found
  if (!group.value) {
    route('/dashboard');
    return null;
  }
  
  const members = group.value.members || [];
  const memberMap = members.reduce((acc, member) => {
    acc[member.uid] = member;
    return acc;
  }, {} as Record<string, typeof members[0]>);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <V2Indicator />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Add Expense
            </h1>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {group.value.name}
          </p>
        </div>
      </div>
      
      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <Stack spacing="md">
            {/* Error message */}
            {formError.value && (
              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">{formError.value}</p>
              </Card>
            )}
            
            {/* Basic Details */}
            <Card>
              <Stack spacing="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Expense Details
                </h2>
                
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description.value}
                    onInput={(e) => expenseFormStore.updateField('description', (e.target as HTMLInputElement).value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="What was this expense for?"
                    required
                  />
                  {validationErrors.value.description && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {validationErrors.value.description}
                    </p>
                  )}
                </div>
                
                {/* Amount and Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      value={amount.value || ''}
                      onInput={handleAmountChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                    {validationErrors.value.amount && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {validationErrors.value.amount}
                      </p>
                    )}
                  </div>
                  
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={category.value}
                      onChange={(e) => expenseFormStore.updateField('category', (e.target as HTMLSelectElement).value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date.value}
                    onInput={(e) => expenseFormStore.updateField('date', (e.target as HTMLInputElement).value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  {validationErrors.value.date && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {validationErrors.value.date}
                    </p>
                  )}
                </div>
              </Stack>
            </Card>
            
            {/* Payer Selection */}
            <Card>
              <Stack spacing="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Who paid?
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {members.map(member => (
                    <label
                      key={member.uid}
                      className={`
                        flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors
                        ${paidBy.value === member.uid
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="paidBy"
                        value={member.uid}
                        checked={paidBy.value === member.uid}
                        onChange={() => expenseFormStore.updateField('paidBy', member.uid)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.displayName}
                      </span>
                    </label>
                  ))}
                </div>
                {validationErrors.value.paidBy && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {validationErrors.value.paidBy}
                  </p>
                )}
              </Stack>
            </Card>
            
            {/* Split Between */}
            <Card>
              <Stack spacing="md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Split between
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {members.map(member => {
                    const isSelected = participants.value.includes(member.uid);
                    const isPayer = paidBy.value === member.uid;
                    return (
                      <label
                        key={member.uid}
                        className={`
                          flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }
                          ${isPayer ? 'ring-2 ring-green-500' : ''}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleParticipantToggle(member.uid)}
                          disabled={isPayer}
                          className="text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.displayName}
                          {isPayer && <span className="text-green-600 dark:text-green-400 ml-1">(Payer)</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {validationErrors.value.participants && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {validationErrors.value.participants}
                  </p>
                )}
                
                {/* Split Preview */}
                {participants.value.length > 0 && amount.value > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Equal split preview:
                    </p>
                    <div className="space-y-1">
                      {splits.value.map(split => {
                        const member = memberMap[split.userId];
                        return (
                          <div key={split.userId} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              {member?.displayName || 'Unknown'}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${split.amount.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Stack>
            </Card>
            
            {/* Actions */}
            <div className="flex flex-row justify-end space-x-2">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={saving.value}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving.value || participants.value.length === 0}
              >
                {saving.value ? 'Saving...' : 'Save Expense'}
              </Button>
            </div>
          </Stack>
        </form>
      </div>
    </div>
  );
}