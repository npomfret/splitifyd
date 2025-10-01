import { randomString, randomChoice, randomCurrency, generateShortId } from '../test-helpers';

interface GroupUpdate {
    name?: string;
    description?: string;
    currency?: string;
}

export class GroupUpdateBuilder {
    private update: GroupUpdate;

    constructor() {
        this.update = {
            name: `${randomChoice(['Updated', 'New', 'Modified', 'Changed'])} ${randomChoice(['Team', 'Group', 'Squad', 'Club'])} ${randomString(4)}`,
            description: `${randomChoice(['Updated', 'Modified', 'New'])} description ${generateShortId()}`,
            currency: randomCurrency(),
        };
    }

    withName(name: string): this {
        this.update.name = name;
        return this;
    }

    withDescription(description: string): this {
        this.update.description = description;
        return this;
    }

    withCurrency(currency: string): this {
        this.update.currency = currency;
        return this;
    }

    build(): GroupUpdate {
        return {
            ...(this.update.name !== undefined && { name: this.update.name }),
            ...(this.update.description !== undefined && { description: this.update.description }),
            ...(this.update.currency !== undefined && { currency: this.update.currency }),
        };
    }
}
