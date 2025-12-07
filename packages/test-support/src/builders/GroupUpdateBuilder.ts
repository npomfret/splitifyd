import { CurrencyISOCode, GroupCurrencySettings, GroupName, toCurrencyISOCode, toGroupName, UpdateGroupRequest } from '@billsplit-wl/shared';
import { generateShortId, randomChoice, randomString } from '../test-helpers';

export class GroupUpdateBuilder {
    private update: Partial<UpdateGroupRequest>;

    constructor(useDefaults: boolean = true) {
        if (useDefaults) {
            this.update = {
                name: toGroupName(`${randomChoice(['Updated', 'New', 'Modified', 'Changed'])} ${randomChoice(['Team', 'Group', 'Squad', 'Club'])} ${randomString(4)}`),
                description: `${randomChoice(['Updated', 'Modified', 'New'])} description ${generateShortId()}`,
            };
        } else {
            this.update = {};
        }
    }

    static empty(): GroupUpdateBuilder {
        return new GroupUpdateBuilder(false);
    }

    withName(name: string | GroupName): this {
        this.update.name = typeof name === 'string' ? toGroupName(name) : name;
        return this;
    }

    withDescription(description: string): this {
        this.update.description = description;
        return this;
    }

    withCurrencySettings(permitted: string[], defaultCurrency: string): this {
        this.update.currencySettings = {
            permitted: permitted.map(c => toCurrencyISOCode(c)) as CurrencyISOCode[],
            default: toCurrencyISOCode(defaultCurrency),
        };
        return this;
    }

    withCurrencySettingsObject(settings: GroupCurrencySettings | null): this {
        this.update.currencySettings = settings;
        return this;
    }

    clearCurrencySettings(): this {
        this.update.currencySettings = null;
        return this;
    }

    withInvalidName(value: string): this {
        (this.update as any).name = value;
        return this;
    }

    withInvalidDescription(value: string): this {
        (this.update as any).description = value;
        return this;
    }

    build(): Partial<UpdateGroupRequest> {
        return {
            ...(this.update.name !== undefined && { name: this.update.name }),
            ...(this.update.description !== undefined && { description: this.update.description }),
            ...(this.update.currencySettings !== undefined && { currencySettings: this.update.currencySettings }),
        };
    }
}
