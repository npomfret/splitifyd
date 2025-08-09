export interface TestSettlement {
  groupId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  date?: string;
  note?: string;
}

export class SettlementBuilder {
  private settlement: TestSettlement;

  constructor() {
    this.settlement = {
      groupId: 'default-group-id',
      payerId: 'default-payer-id',
      payeeId: 'default-payee-id',
      amount: 50.00
    };
  }

  withGroupId(groupId: string): this {
    this.settlement.groupId = groupId;
    return this;
  }

  withPayer(payerId: string): this {
    this.settlement.payerId = payerId;
    return this;
  }

  withPayee(payeeId: string): this {
    this.settlement.payeeId = payeeId;
    return this;
  }

  withAmount(amount: number): this {
    this.settlement.amount = amount;
    return this;
  }

  withDate(date: string): this {
    this.settlement.date = date;
    return this;
  }

  withNote(note: string): this {
    this.settlement.note = note;
    return this;
  }

  build(): TestSettlement {
    return {
      groupId: this.settlement.groupId,
      payerId: this.settlement.payerId,
      payeeId: this.settlement.payeeId,
      amount: this.settlement.amount,
      ...(this.settlement.date && { date: this.settlement.date }),
      ...(this.settlement.note && { note: this.settlement.note })
    };
  }
}