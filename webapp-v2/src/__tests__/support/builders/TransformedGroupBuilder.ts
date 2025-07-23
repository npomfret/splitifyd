import { v4 as uuidv4 } from 'uuid';
import type { TransformedGroup, User } from '@shared/apiTypes';

export class TransformedGroupBuilder {
  private group: TransformedGroup;

  constructor() {
    this.group = {
      id: uuidv4(),
      name: `Test Group ${uuidv4().slice(0, 8)}`,
      memberCount: 1,
      yourBalance: 0,
      lastActivity: 'Just created',
      lastActivityRaw: new Date().toISOString(),
      lastExpense: null,
      members: [],
      expenseCount: 0,
      lastExpenseTime: null
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
    this.group.yourBalance = balance;
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
    this.group.lastExpenseTime = date || new Date().toISOString();
    return this;
  }

  owingMoney(amount: number): this {
    this.group.yourBalance = -Math.abs(amount);
    return this;
  }

  owedMoney(amount: number): this {
    this.group.yourBalance = Math.abs(amount);
    return this;
  }

  settledUp(): this {
    this.group.yourBalance = 0;
    return this;
  }

  recentlyActive(): this {
    this.group.lastActivity = '2 hours ago';
    this.group.lastActivityRaw = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    return this;
  }

  build(): TransformedGroup {
    return { ...this.group };
  }
}