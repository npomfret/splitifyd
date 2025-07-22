// Test data builders following the builder pattern
// These help create test data with sensible defaults while allowing customization

interface User {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  members: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  category: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserBuilder {
  private user: User = {
    uid: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: 'test@example.com',
    displayName: 'Test User',
    emailVerified: true,
  };

  withUid(uid: string): UserBuilder {
    this.user.uid = uid;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.user.email = email;
    return this;
  }

  withDisplayName(displayName: string): UserBuilder {
    this.user.displayName = displayName;
    return this;
  }

  unverified(): UserBuilder {
    this.user.emailVerified = false;
    return this;
  }

  build(): User {
    return { ...this.user };
  }
}

export class GroupBuilder {
  private group: Group = {
    id: `group-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Group',
    description: 'A test group',
    members: [],
    createdBy: 'user-123',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  withId(id: string): GroupBuilder {
    this.group.id = id;
    return this;
  }

  withName(name: string): GroupBuilder {
    this.group.name = name;
    return this;
  }

  withDescription(description: string): GroupBuilder {
    this.group.description = description;
    return this;
  }

  withMembers(members: string[]): GroupBuilder {
    this.group.members = [...members];
    return this;
  }

  withCreatedBy(userId: string): GroupBuilder {
    this.group.createdBy = userId;
    return this;
  }

  build(): Group {
    return { ...this.group };
  }
}

export class ExpenseBuilder {
  private expense: Expense = {
    id: `expense-${Math.random().toString(36).substr(2, 9)}`,
    groupId: 'group-123',
    description: 'Test Expense',
    amount: 100.00,
    paidBy: 'user-123',
    splitBetween: ['user-123'],
    category: 'food',
    date: new Date('2025-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  withId(id: string): ExpenseBuilder {
    this.expense.id = id;
    return this;
  }

  withGroupId(groupId: string): ExpenseBuilder {
    this.expense.groupId = groupId;
    return this;
  }

  withDescription(description: string): ExpenseBuilder {
    this.expense.description = description;
    return this;
  }

  withAmount(amount: number): ExpenseBuilder {
    this.expense.amount = amount;
    return this;
  }

  withPaidBy(userId: string): ExpenseBuilder {
    this.expense.paidBy = userId;
    return this;
  }

  withSplitBetween(userIds: string[]): ExpenseBuilder {
    this.expense.splitBetween = [...userIds];
    return this;
  }

  withCategory(category: string): ExpenseBuilder {
    this.expense.category = category;
    return this;
  }

  build(): Expense {
    return { ...this.expense };
  }
}

// Helper functions to create builders
export const aUser = (): UserBuilder => new UserBuilder();
export const aGroup = (): GroupBuilder => new GroupBuilder();  
export const anExpense = (): ExpenseBuilder => new ExpenseBuilder();