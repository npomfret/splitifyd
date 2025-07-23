import type { TransformedGroup, User, GroupDetail } from '../../types/webapp-shared-types';
import type { TestGroup } from '../../../../firebase/functions/__tests__/support/builders/GroupBuilder';
import { v4 as uuidv4 } from 'uuid';

/**
 * Adapter utilities to convert Firebase test builders to webapp types
 * Following the builder pattern directive from testing.md
 */

export class TransformedGroupAdapter {
  /**
   * Converts a TestGroup from GroupBuilder to TransformedGroup for component testing
   */
  static fromTestGroup(testGroup: TestGroup, overrides: Partial<TransformedGroup> = {}): TransformedGroup {
    const members: User[] = testGroup.members?.map((member: any) => ({
      uid: member.uid,
      displayName: member.displayName,
      email: member.email
    })) || [];

    const result = {
      id: uuidv4(),
      name: testGroup.name,
      memberCount: members.length,
      yourBalance: 0,
      lastActivity: 'Just created',
      lastActivityRaw: new Date().toISOString(),
      lastExpense: null,
      members,
      expenseCount: 0,
      lastExpenseTime: null,
      ...overrides
    };

    // Update memberCount if members were overridden
    if (overrides.members !== undefined) {
      result.memberCount = overrides.members.length;
    }

    return result;
  }

  /**
   * Creates a TransformedGroup with specific balance state for testing
   */
  static withBalance(testGroup: TestGroup, balance: number): TransformedGroup {
    return this.fromTestGroup(testGroup, { yourBalance: balance });
  }

  /**
   * Creates a TransformedGroup with recent activity for testing
   */
  static withRecentActivity(testGroup: TestGroup, activity: string): TransformedGroup {
    return this.fromTestGroup(testGroup, {
      lastActivity: activity,
      lastActivityRaw: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    });
  }

  /**
   * Creates a TransformedGroup with expenses for testing
   */
  static withExpenses(testGroup: TestGroup, expenseCount: number, lastExpenseDescription?: string): TransformedGroup {
    const overrides: Partial<TransformedGroup> = {
      expenseCount,
      lastExpenseTime: new Date().toISOString()
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

export class GroupDetailAdapter {
  /**
   * Converts a TestGroup to GroupDetail for store testing
   */
  static fromTestGroup(testGroup: TestGroup, overrides: Partial<GroupDetail> = {}): GroupDetail {
    const members: User[] = testGroup.members?.map((member: any) => ({
      uid: member.uid,
      displayName: member.displayName,
      email: member.email
    })) || [];

    const result: GroupDetail = {
      id: uuidv4(),
      name: testGroup.name,
      description: testGroup.description,
      memberIds: members.map(m => m.uid),
      memberEmails: members.map(m => m.email),
      members,
      createdBy: members[0]?.uid || 'test-user-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expenseCount: 0,
      ...overrides
    };

    return result;
  }
}