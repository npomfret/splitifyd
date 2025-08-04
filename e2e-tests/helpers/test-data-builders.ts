/**
 * Test data builders following the builder pattern
 * These help create consistent test data while highlighting what's important in each test
 */

export interface TestGroup {
  name: string;
  description?: string;
  members?: TestUser[];
}

export interface TestUser {
  displayName: string;
  email: string;
  password?: string;
  timezone?: string;
}

export interface TestExpense {
  description: string;
  amount: number;
  paidBy?: string;
  category?: string;
  date?: Date;
  splitType?: 'equal' | 'exact' | 'percentage';
  participants?: string[];
  splits?: Array<{
    userId: string;
    amount?: number;
    percentage?: number;
    shares?: number;
  }>;
}

/**
 * Builder for creating test groups with various configurations
 */
export class GroupBuilder {
  private group: TestGroup = {
    name: `Test Group ${Date.now()}`
  };

  withName(name: string): GroupBuilder {
    this.group.name = name;
    return this;
  }

  withDescription(description: string): GroupBuilder {
    this.group.description = description;
    return this;
  }


  withMembers(members: TestUser[]): GroupBuilder {
    this.group.members = members;
    return this;
  }

  withMember(member: TestUser): GroupBuilder {
    if (!this.group.members) {
      this.group.members = [];
    }
    this.group.members.push(member);
    return this;
  }

  build(): TestGroup {
    return { ...this.group };
  }
}

/**
 * Builder for creating test expenses with different configurations
 */
export class ExpenseBuilder {
  private expense: TestExpense = {
    description: `Test Expense ${Date.now()}`,
    amount: 100.00
  };

  withDescription(description: string): ExpenseBuilder {
    this.expense.description = description;
    return this;
  }

  withAmount(amount: number): ExpenseBuilder {
    this.expense.amount = amount;
    return this;
  }

  paidBy(userId: string): ExpenseBuilder {
    this.expense.paidBy = userId;
    return this;
  }

  withCategory(category: string): ExpenseBuilder {
    this.expense.category = category;
    return this;
  }

  onDate(date: Date): ExpenseBuilder {
    this.expense.date = date;
    return this;
  }

  withEqualSplit(participants: string[]): ExpenseBuilder {
    this.expense.splitType = 'equal';
    this.expense.participants = participants;
    return this;
  }

  withExactSplit(splits: Array<{ userId: string; amount: number }>): ExpenseBuilder {
    this.expense.splitType = 'exact';
    this.expense.splits = splits;
    this.expense.participants = splits.map(s => s.userId);
    return this;
  }

  withPercentageSplit(splits: Array<{ userId: string; percentage: number }>): ExpenseBuilder {
    this.expense.splitType = 'percentage';
    this.expense.splits = splits;
    this.expense.participants = splits.map(s => s.userId);
    return this;
  }




  build(): TestExpense {
    // Set defaults if not specified
    if (!this.expense.splitType) {
      this.expense.splitType = 'equal';
    }
    if (!this.expense.date) {
      this.expense.date = new Date();
    }
    if (!this.expense.category) {
      this.expense.category = 'other';
    }
    
    return { ...this.expense };
  }
}

/**
 * Builder for creating test users with different configurations
 */
export class UserBuilder {
  private user: TestUser = {
    displayName: `Test User ${Date.now()}`,
    email: `test-${Date.now()}-${Math.random()}@example.com`
  };

  withDisplayName(displayName: string): UserBuilder {
    this.user.displayName = displayName;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.user.email = email;
    return this;
  }

  withPassword(password: string): UserBuilder {
    this.user.password = password;
    return this;
  }


  withTimezone(timezone: string): UserBuilder {
    this.user.timezone = timezone;
    return this;
  }

  build(): TestUser {
    // Set default password if not specified
    if (!this.user.password) {
      this.user.password = 'TestPassword123!';
    }
    
    return { ...this.user };
  }
}