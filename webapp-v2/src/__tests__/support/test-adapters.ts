import type { Group, User } from '../../types/webapp-shared-types';
import type { TestGroup } from '../../../../firebase/functions/__tests__/support/builders/GroupBuilder';
import { v4 as uuidv4 } from 'uuid';

/**
 * Adapter utilities to convert Firebase test builders to webapp types
 * Following the builder pattern directive from testing.md
 */

export class GroupAdapter {
  /**
   * Converts a TestGroup from GroupBuilder to Group for component testing
   */
  static fromTestGroup(testGroup: TestGroup, overrides: Partial<Group> = {}): Group {
    const members: User[] = testGroup.members?.map((member: any) => ({
      uid: member.uid,
      displayName: member.displayName,
      email: member.email
    })) || [];

    const result = {
      id: uuidv4(),
      name: testGroup.name,
      memberCount: members.length,
      balance: {
        userBalance: {
          userId: 'test-user',
          name: 'Test User',
          netBalance: 0,
          owes: {},
          owedBy: {}
        },
        totalOwed: 0,
        totalOwing: 0
      },
      lastActivity: 'Just created',
      lastActivityRaw: new Date().toISOString(),
      lastExpense: undefined,
      members,
      expenseCount: 0,
      ...overrides
    };

    // Update memberCount if members were overridden
    if (overrides.members !== undefined) {
      result.memberCount = overrides.members.length;
    }

    return result;
  }

  /**
   * Creates a Group with specific balance state for testing
   */
  static withBalance(testGroup: TestGroup, balance: number): Group {
    return this.fromTestGroup(testGroup, {
      balance: {
        userBalance: {
          userId: 'test-user',
          name: 'Test User',
          netBalance: balance,
          owes: {},
          owedBy: {}
        },
        totalOwed: 0,
        totalOwing: 0
      }
    });
  }

  /**
   * Creates a Group with recent activity for testing
   */
  static withRecentActivity(testGroup: TestGroup, activity: string): Group {
    return this.fromTestGroup(testGroup, {
      lastActivity: activity,
      lastActivityRaw: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    });
  }

  /**
   * Creates a Group with expenses for testing
   */
  static withExpenses(testGroup: TestGroup, expenseCount: number, lastExpenseDescription?: string): Group {
    const overrides: Partial<Group> = {
      expenseCount
    };

    if (lastExpenseDescription) {
      overrides.lastExpense = {
        description: lastExpenseDescription,
        amount: 25.50,
        date: new Date().toISOString()
      };
    }

    return this.fromTestGroup(testGroup, overrides);
  }
}

// Note: GroupDetailAdapter removed as we now use single Group type