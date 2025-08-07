import { useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { useSignal, useComputed } from '@preact/signals';
import { expenseFormStore, EXPENSE_CATEGORIES, getRecentAmounts } from '../app/stores/expense-form-store';
import type { ExpenseCategory } from '@shared/types/webapp-shared-types';
import { groupDetailStore } from '../app/stores/group-detail-store';
import { useAuth } from '../app/hooks/useAuth';
import { apiClient } from '../app/apiClient';
import type { ExpenseData } from '@shared/types/webapp-shared-types';
import { LoadingSpinner, Card, Button, Avatar } from '../components/ui';
import { Stack } from '../components/ui/Stack';
import { logError } from '../utils/error-logger';

interface AddExpensePageProps {
  groupId?: string;
}

export default function AddExpensePage({ groupId }: AddExpensePageProps) {
  const isInitialized = useSignal(false);
  
  // Parse URL parameters for edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const expenseId = urlParams.get('id');
  const isEditMode = urlParams.get('edit') === 'true' && !!expenseId;
  
  // Computed values from stores
  const authStore = useAuth();
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
  const splitType = useComputed(() => expenseFormStore.splitType);
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
        
        if (isEditMode && expenseId) {
          // Edit mode: fetch existing expense and populate form
          try {
            const expense = await apiClient.request<ExpenseData>('/expenses', {
              method: 'GET',
              query: { id: expenseId }
            });
            
            if (expense) {
              // Populate form with existing expense data
              expenseFormStore.updateField('description', expense.description);
              expenseFormStore.updateField('amount', expense.amount);
              expenseFormStore.updateField('date', expense.date.split('T')[0]); // Extract date part
              expenseFormStore.updateField('paidBy', expense.paidBy);
              expenseFormStore.updateField('category', expense.category);
              expenseFormStore.updateField('splitType', expense.splitType);
              
              // Set participants from expense splits
              const participantIds = expense.splits.map(split => split.userId);
              expenseFormStore.setParticipants(participantIds);
              
              // Set splits based on split type
              expense.splits.forEach(split => {
                if (expense.splitType === 'exact') {
                  expenseFormStore.updateSplitAmount(split.userId, split.amount);
                } else if (expense.splitType === 'percentage') {
                  const percentage = (split.amount / expense.amount) * 100;
                  expenseFormStore.updateSplitPercentage(split.userId, percentage);
                }
              });
            } else {
              throw new Error('Expense not found');
            }
          } catch (error) {
            logError('Failed to load expense for editing', error);
            route(`/groups/${groupId}`);
            return;
          }
        } else {
          // Create mode: try to load draft first, then set defaults if no draft
          const draftLoaded = expenseFormStore.loadDraft(groupId);
          if (!draftLoaded) {
            // Set current user as payer by default only if no draft
            if (currentUser.value) {
              expenseFormStore.updateField('paidBy', currentUser.value.uid);
            }
            
            // For equal splits, select all group members by default
            if (group.value?.members) {
              const allMemberIds = group.value.members.map(m => m.uid);
              expenseFormStore.setParticipants(allMemberIds);
            }
          }
        }
        
        isInitialized.value = true;
      } catch (error) {
        logError('Failed to initialize add expense form', error);
        route(`/groups/${groupId}`);
      }
    };
    
    // Intentionally not awaited - useEffect cannot be async (React anti-pattern)
    initializeForm();
    
    // Cleanup on unmount
    return () => {
      expenseFormStore.reset();
    };
  }, [groupId]);
  
  // Auto-save draft when form changes (debounced)
  useEffect(() => {
    if (!isInitialized.value || !groupId) return;
    
    // Debounce auto-save to avoid excessive localStorage writes
    const saveTimer = setTimeout(() => {
      if (expenseFormStore.hasUnsavedChanges()) {
        expenseFormStore.saveDraft(groupId);
      }
    }, 1000); // Auto-save after 1 second of inactivity
    
    return () => clearTimeout(saveTimer);
  }, [
    description.value,
    amount.value,
    date.value,
    paidBy.value,
    category.value,
    splitType.value,
    participants.value,
    splits.value,
    isInitialized.value,
    groupId
  ]);
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!groupId) return;
    
    try {
      if (isEditMode && expenseId) {
        // Edit mode: update existing expense
        await expenseFormStore.updateExpense(groupId, expenseId);
        // Navigate back to expense detail after successful update
        route(`/groups/${groupId}/expenses/${expenseId}`);
      } else {
        // Create mode: save new expense
        await expenseFormStore.saveExpense(groupId);
        // Navigate back to group detail on success
        route(`/groups/${groupId}`);
      }
    } catch (error) {
      // Error is handled by the store
      logError('Failed to save expense', error);
    }
  };
  
  const handleCancel = () => {
    if (expenseFormStore.hasUnsavedChanges()) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) {
        return;
      }
    }
    
    if (isEditMode && expenseId) {
      // Navigate back to expense detail when canceling edit
      route(`/groups/${groupId}/expenses/${expenseId}`);
    } else {
      // Navigate back to group detail when canceling create
      route(`/groups/${groupId}`);
    }
  };
  
  const handleAmountChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const value = parseFloat(input.value) || 0;
    expenseFormStore.updateField('amount', value);
  };
  
  const handleParticipantToggle = (memberId: string) => {
    expenseFormStore.toggleParticipant(memberId);
  };
  
  const handleSelectAll = () => {
    const allMemberIds = members.map(m => m.uid);
    expenseFormStore.setParticipants(allMemberIds);
  };
  
  const handleSelectNone = () => {
    // Keep only the payer
    expenseFormStore.setParticipants(paidBy.value ? [paidBy.value] : []);
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Expense' : 'Add Expense'}
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
                    Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={description.value}
                    onInput={(e) => expenseFormStore.updateField('description', (e.target as HTMLInputElement).value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      validationErrors.value.description 
                        ? 'border-red-500 dark:border-red-500' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
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
                      Amount ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={amount.value || ''}
                      onInput={handleAmountChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      required
                    />
                    
                    {/* Recent amounts buttons */}
                    {(() => {
                      const recentAmounts = getRecentAmounts();
                      return recentAmounts.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Recent amounts:</p>
                          <div className="flex flex-wrap gap-1">
                            {recentAmounts.map((amt, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => expenseFormStore.updateField('amount', amt)}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                ${amt.toFixed(2)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    
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
                      {EXPENSE_CATEGORIES.map((cat: ExpenseCategory) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.icon} {cat.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date.value}
                    onInput={(e) => expenseFormStore.updateField('date', (e.target as HTMLInputElement).value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      validationErrors.value.date 
                        ? 'border-red-500 dark:border-red-500' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
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
                  Who paid? <span className="text-red-500">*</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {members.map(member => (
                    <label
                      key={member.uid}
                      className={`
                        flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
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
                      <Avatar 
                        displayName={member.displayName}
                        userId={member.uid}
                        size="sm"
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
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Split between <span className="text-red-500">*</span>
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectNone}
                    >
                      Select none
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {members.map(member => {
                    const isSelected = participants.value.includes(member.uid);
                    const isPayer = paidBy.value === member.uid;
                    return (
                      <label
                        key={member.uid}
                        className={`
                          flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
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
                        <Avatar 
                          displayName={member.displayName}
                          userId={member.uid}
                          size="sm"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
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
              </Stack>
            </Card>
            
            {/* Split Type Selection */}
            {participants.value.length > 0 && (
              <Card>
                <Stack spacing="md">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    How to split
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    <label className={`
                      flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center
                      ${splitType.value === 'equal'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}>
                      <input
                        type="radio"
                        name="splitType"
                        value="equal"
                        checked={splitType.value === 'equal'}
                        onChange={() => expenseFormStore.updateField('splitType', 'equal')}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Equal
                      </span>
                    </label>
                    
                    <label className={`
                      flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center
                      ${splitType.value === 'exact'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}>
                      <input
                        type="radio"
                        name="splitType"
                        value="exact"
                        checked={splitType.value === 'exact'}
                        onChange={() => expenseFormStore.updateField('splitType', 'exact')}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Exact amounts
                      </span>
                    </label>
                    
                    <label className={`
                      flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors text-center
                      ${splitType.value === 'percentage'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}>
                      <input
                        type="radio"
                        name="splitType"
                        value="percentage"
                        checked={splitType.value === 'percentage'}
                        onChange={() => expenseFormStore.updateField('splitType', 'percentage')}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Percentage
                      </span>
                    </label>
                  </div>
                  
                  {/* Split inputs based on type */}
                  {splitType.value === 'exact' && amount.value > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Enter exact amounts for each person:
                      </p>
                      {participants.value.map(participantId => {
                        const member = memberMap[participantId];
                        const split = splits.value.find(s => s.userId === participantId);
                        return (
                          <div key={participantId} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar 
                                displayName={member?.displayName || 'Unknown'}
                                userId={participantId}
                                size="sm"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {member?.displayName || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                value={split?.amount || 0}
                                onInput={(e) => {
                                  const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                                  expenseFormStore.updateSplitAmount(participantId, value);
                                }}
                                className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-right"
                                step="0.01"
                                min="0.01"
                                inputMode="decimal"
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
                          <span className={`font-medium ${
                            Math.abs(splits.value.reduce((sum, s) => sum + s.amount, 0) - amount.value) < 0.01
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            ${splits.value.reduce((sum, s) => sum + s.amount, 0).toFixed(2)} / ${amount.value.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {splitType.value === 'percentage' && amount.value > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Enter percentage for each person:
                      </p>
                      {participants.value.map(participantId => {
                        const member = memberMap[participantId];
                        const split = splits.value.find(s => s.userId === participantId);
                        return (
                          <div key={participantId} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar 
                                displayName={member?.displayName || 'Unknown'}
                                userId={participantId}
                                size="sm"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {member?.displayName || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={split?.percentage || 0}
                                onInput={(e) => {
                                  const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                                  expenseFormStore.updateSplitPercentage(participantId, value);
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-right"
                                step="0.1"
                                min="0"
                                max="100"
                                inputMode="decimal"
                              />
                              <span className="text-gray-500">%</span>
                              <span className="text-xs text-gray-500 w-16 text-right">
                                ${split?.amount.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
                          <span className={`font-medium ${
                            Math.abs(splits.value.reduce((sum, s) => sum + (s.percentage || 0), 0) - 100) < 0.01
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {splits.value.reduce((sum, s) => sum + (s.percentage || 0), 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {splitType.value === 'equal' && amount.value > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Each person pays:
                      </p>
                      <div className="space-y-1">
                        {splits.value.map(split => {
                          const member = memberMap[split.userId];
                          return (
                            <div key={split.userId} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Avatar 
                                  displayName={member?.displayName || 'Unknown'}
                                  userId={split.userId}
                                  size="sm"
                                />
                                <span className="text-gray-600 dark:text-gray-400">
                                  {member?.displayName || 'Unknown'}
                                </span>
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                ${split.amount.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {validationErrors.value.splits && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {validationErrors.value.splits}
                    </p>
                  )}
                </Stack>
              </Card>
            )}
            
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
                {saving.value 
                  ? (isEditMode ? 'Updating...' : 'Saving...') 
                  : (isEditMode ? 'Update Expense' : 'Save Expense')
                }
              </Button>
            </div>
          </Stack>
        </form>
      </div>
    </div>
  );
}