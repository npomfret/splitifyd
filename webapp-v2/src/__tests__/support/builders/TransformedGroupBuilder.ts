import { v4 as uuidv4 } from 'uuid';
import type { Group, User } from '../../../types/webapp-shared-types';

export class GroupBuilder {
  private group: Group;

  constructor() {
    this.group = {
      id: uuidv4(),
      name: `Test Group ${uuidv4().slice(0, 8)}`,
      memberCount: 1,
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
      members: [],
      expenseCount: 0
    };
  }

  withId(id: string): this {
    this.group.id = id;
    return this;
  }

  withName(name: string): this {
    this.group.name = name;
    return this;
  }

  withMemberCount(count: number): this {
    this.group.memberCount = count;
    return this;
  }

  withBalance(balance: number): this {
    this.group.balance.userBalance.netBalance = balance;
    return this;
  }

  withLastActivity(activity: string): this {
    this.group.lastActivity = activity;
    return this;
  }

  withExpenseCount(count: number): this {
    this.group.expenseCount = count;
    return this;
  }

  withMembers(members: User[]): this {
    this.group.members = [...members];
    this.group.memberCount = members.length;
    return this;
  }

  withLastExpense(description: string, amount: number, date?: string): this {
    this.group.lastExpense = {
      description,
      amount,
      date: date || new Date().toISOString()
    };
    return this;
  }

  owingMoney(amount: number): this {
    this.group.balance.userBalance.netBalance = -Math.abs(amount);
    return this;
  }

  owedMoney(amount: number): this {
    this.group.balance.userBalance.netBalance = Math.abs(amount);
    return this;
  }

  settledUp(): this {
    this.group.balance.userBalance.netBalance = 0;
    return this;
  }

  recentlyActive(): this {
    this.group.lastActivity = '2 hours ago';
    this.group.lastActivityRaw = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    return this;
  }

  build(): Group {
    return { ...this.group };
  }
}