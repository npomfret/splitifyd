import { generateShortId } from '@splitifyd/test-support';
import { CURRENCY_REPLACEMENTS, type TestCurrency } from '../test-currencies';

/**
 * Builder for creating consistent group test data for Playwright tests
 * Provides a fluent API for constructing group objects with various scenarios
 */
export class GroupTestDataBuilder {
    private group: any;

    constructor() {
        const groupId = `test-group-${generateShortId()}`;
        const defaultUserId = `user-${generateShortId()}`;

        this.group = {
            id: groupId,
            name: `Test Group ${generateShortId()}`,
            description: 'A test group for Playwright testing',
            currency: CURRENCY_REPLACEMENTS.USD.acronym,
            createdBy: defaultUserId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            memberCount: 1,
            ownerUid: defaultUserId,
            balance: 0,
            members: [
                {
                    id: defaultUserId,
                    email: `user-${generateShortId()}@test.com`,
                    displayName: `Test User ${generateShortId()}`,
                    joinedAt: new Date().toISOString(),
                    role: 'admin',
                    status: 'active',
                },
            ],
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

    withDescription(description: string): this {
        this.group.description = description;
        return this;
    }

    withCurrency(currency: TestCurrency | string): this {
        if (typeof currency === 'string') {
            this.group.currency = currency;
        } else {
            this.group.currency = currency.acronym;
        }
        return this;
    }

    withBalance(amount: number): this {
        this.group.balance = amount;
        return this;
    }

    withMemberCount(count: number): this {
        this.group.memberCount = count;

        // Generate members array to match count
        const members = [];
        for (let i = 0; i < count; i++) {
            const userId = `user-${i + 1}-${generateShortId()}`;
            members.push({
                id: userId,
                email: `user${i + 1}-${generateShortId()}@test.com`,
                displayName: `Test User ${i + 1}`,
                joinedAt: new Date().toISOString(),
                role: i === 0 ? 'admin' : 'member',
                status: 'active',
            });
        }

        this.group.members = members;
        if (count > 0) {
            this.group.ownerUid = members[0].id;
            this.group.createdBy = members[0].id;
        }

        return this;
    }

    withMembers(members: any[]): this {
        this.group.members = members;
        this.group.memberCount = members.length;
        if (members.length > 0) {
            this.group.ownerUid = members[0].id;
            this.group.createdBy = members[0].id;
        }
        return this;
    }

    withSpecificMembers(members: Array<{ email: string; displayName: string; role?: string; status?: string }>): this {
        this.group.members = members.map((member, index) => ({
            id: `user-${index + 1}-${generateShortId()}`,
            email: member.email,
            displayName: member.displayName,
            joinedAt: new Date().toISOString(),
            role: member.role || (index === 0 ? 'admin' : 'member'),
            status: member.status || 'active',
        }));

        this.group.memberCount = members.length;
        if (members.length > 0) {
            this.group.ownerUid = this.group.members[0].id;
            this.group.createdBy = this.group.members[0].id;
        }

        return this;
    }

    withOwner(userId: string): this {
        this.group.ownerUid = userId;
        this.group.createdBy = userId;
        return this;
    }

    asPendingGroup(): this {
        this.group.status = 'pending';
        return this;
    }

    asDeletedGroup(): this {
        this.group.status = 'deleted';
        this.group.deletedAt = new Date().toISOString();
        return this;
    }

    withDebtScenario(): this {
        return this.withBalance(-25.5).withMemberCount(3);
    }

    withCreditScenario(): this {
        return this.withBalance(45.75).withMemberCount(4);
    }

    asEmptyGroup(): this {
        return this.withMemberCount(1).withBalance(0);
    }

    asLargeGroup(): this {
        return this.withMemberCount(10).withBalance(150.25);
    }

    build(): any {
        return { ...this.group };
    }

    buildArray(count: number): any[] {
        const groups = [];
        for (let i = 0; i < count; i++) {
            const group = new GroupTestDataBuilder()
                .withName(`Test Group ${i + 1}`)
                .withMemberCount(this.group.memberCount)
                .withBalance(this.group.balance + i * 10)
                .withCurrency(this.group.currency)
                .build();
            groups.push(group);
        }
        return groups;
    }

    static quickGroup(overrides: Partial<any> = {}): any {
        const builder = new GroupTestDataBuilder();

        Object.keys(overrides).forEach((key) => {
            if (builder.group.hasOwnProperty(key)) {
                builder.group[key] = overrides[key];
            }
        });

        return builder.build();
    }

    static emptyGroupsArray(): any[] {
        return [];
    }

    static sampleGroupsArray(): any[] {
        return [
            new GroupTestDataBuilder().withName('Weekend Trip').withDescription('Vacation expenses for the beach house').withMemberCount(4).withBalance(45.5).build(),
            new GroupTestDataBuilder().withName('Apartment Expenses').withDescription('Monthly shared costs for rent and utilities').withMemberCount(3).withBalance(-12.25).build(),
            new GroupTestDataBuilder().withName('Dinner Club').withDescription('Weekly restaurant outings with friends').withMemberCount(6).withBalance(0).build(),
        ];
    }
}
