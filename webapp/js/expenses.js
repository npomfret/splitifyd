class ExpenseService {
  static async createExpense(expenseData) {
    return apiCall('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  }

  static async getExpense(expenseId) {
    return apiCall(`/expenses?id=${expenseId}`);
  }

  static async updateExpense(expenseId, updateData) {
    return apiCall(`/expenses?id=${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  static async deleteExpense(expenseId) {
    return apiCall(`/expenses?id=${expenseId}`, {
      method: 'DELETE'
    });
  }

  static async listGroupExpenses(groupId, limit = 50, cursor = null) {
    const params = new URLSearchParams({
      groupId,
      limit: limit.toString()
    });
    
    if (cursor) {
      params.append('cursor', cursor);
    }

    return apiCall(`/expenses/group?${params.toString()}`);
  }

  static async listUserExpenses(limit = 50, cursor = null) {
    const params = new URLSearchParams({
      limit: limit.toString()
    });
    
    if (cursor) {
      params.append('cursor', cursor);
    }

    return apiCall(`/expenses/user?${params.toString()}`);
  }

  static calculateEqualSplit(amount, participantCount) {
    const splitAmount = amount / participantCount;
    return Math.round(splitAmount * 100) / 100;
  }

  static validateSplitAmounts(amount, splits) {
    const total = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(total - amount) < 0.01;
  }

  static validateSplitPercentages(splits) {
    const total = splits.reduce((sum, split) => sum + split.percentage, 0);
    return Math.abs(total - 100) < 0.01;
  }

  static formatAmount(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  static formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  static getExpenseCategories() {
    return [
      { value: 'food', label: 'Food & Dining', icon: '🍽️' },
      { value: 'transport', label: 'Transportation', icon: '🚗' },
      { value: 'utilities', label: 'Utilities', icon: '💡' },
      { value: 'entertainment', label: 'Entertainment', icon: '🎮' },
      { value: 'shopping', label: 'Shopping', icon: '🛍️' },
      { value: 'accommodation', label: 'Accommodation', icon: '🏠' },
      { value: 'healthcare', label: 'Healthcare', icon: '🏥' },
      { value: 'education', label: 'Education', icon: '📚' },
      { value: 'other', label: 'Other', icon: '📌' }
    ];
  }

  static getCategoryIcon(category) {
    const categories = this.getExpenseCategories();
    const cat = categories.find(c => c.value === category);
    return cat ? cat.icon : '📌';
  }

  static getCategoryLabel(category) {
    const categories = this.getExpenseCategories();
    const cat = categories.find(c => c.value === category);
    return cat ? cat.label : 'Other';
  }
}