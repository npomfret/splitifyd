import { CreateGroupRequestBuilder, GroupMemberBuilder } from '@splitifyd/test-support';
import type { MockGroup, MockUser } from './setup';

/**
 * Builder for MockGroup objects used in Playwright UI tests
 * Builds on top of existing test-support builders to reduce boilerplate
 */
export class MockGroupBuilder {
    private group: Partial<MockGroup>;
    private memberBuilders: Map<string, GroupMemberBuilder> = new Map();

    constructor() {
        // Use CreateGroupRequestBuilder for base data
        const baseGroupData = new CreateGroupRequestBuilder().build();
        
        this.group = {
            id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: baseGroupData.name,
            description: baseGroupData.description,
            members: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'default-user-id',
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

    withCreatedBy(userId: string): this {
        this.group.createdBy = userId;
        return this;
    }

    withMember(user: MockUser, memberConfig?: (builder: GroupMemberBuilder) => GroupMemberBuilder): this {
        // Use GroupMemberBuilder for proper member data
        let memberBuilder = new GroupMemberBuilder();
        
        if (memberConfig) {
            memberBuilder = memberConfig(memberBuilder);
        }
        
        this.memberBuilders.set(user.uid, memberBuilder);
        return this;
    }

    withAdminMember(user: MockUser, themeColors?: { light: string, dark: string, name: string }): this {
        return this.withMember(user, (builder) => {
            let memberBuilder = builder.asAdmin();
            if (themeColors) {
                memberBuilder = memberBuilder.withThemeColors(themeColors.light, themeColors.dark, themeColors.name);
            }
            return memberBuilder;
        });
    }

    withRegularMember(user: MockUser, themeColors?: { light: string, dark: string, name: string }): this {
        return this.withMember(user, (builder) => {
            let memberBuilder = builder.asMember();
            if (themeColors) {
                memberBuilder = memberBuilder.withThemeColors(themeColors.light, themeColors.dark, themeColors.name);
            }
            return memberBuilder;
        });
    }

    withBalance(netBalance: number, totalOwed: number = 0, totalOwing: number = 0): this {
        this.group.balance = {
            userBalance: {
                netBalance,
                totalOwed,
                totalOwing,
            }
        };
        return this;
    }

    withPositiveBalance(amount: number): this {
        return this.withBalance(amount, amount, 0);
    }

    withNegativeBalance(amount: number): this {
        return this.withBalance(-Math.abs(amount), 0, Math.abs(amount));
    }

    withDates(createdAt?: string, updatedAt?: string): this {
        if (createdAt) this.group.createdAt = createdAt;
        if (updatedAt) this.group.updatedAt = updatedAt;
        return this;
    }

    build(): MockGroup {
        // Build all members using their builders
        const members: MockGroup['members'] = {};
        for (const [userId, memberBuilder] of this.memberBuilders.entries()) {
            members[userId] = memberBuilder.build();
        }

        return {
            id: this.group.id!,
            name: this.group.name!,
            description: this.group.description,
            members,
            balance: this.group.balance,
            createdAt: this.group.createdAt!,
            updatedAt: this.group.updatedAt!,
            createdBy: this.group.createdBy!,
        };
    }

    // Convenience method for creating groups with default user as admin
    static withDefaultAdmin(user: MockUser): MockGroupBuilder {
        return new MockGroupBuilder()
            .withCreatedBy(user.uid)
            .withAdminMember(user, { light: '#ff0000', dark: '#cc0000', name: 'red' });
    }

    // Convenience method for creating multi-member groups
    static withMembers(admin: MockUser, members: MockUser[]): MockGroupBuilder {
        const builder = new MockGroupBuilder()
            .withCreatedBy(admin.uid)
            .withAdminMember(admin, { light: '#ff0000', dark: '#cc0000', name: 'red' });
            
        members.forEach((member, index) => {
            const colors = [
                { light: '#00ff00', dark: '#00cc00', name: 'green' },
                { light: '#0066cc', dark: '#004499', name: 'blue' },
                { light: '#ff6600', dark: '#cc4400', name: 'orange' },
                { light: '#9900cc', dark: '#6600aa', name: 'purple' },
            ];
            
            builder.withRegularMember(member, colors[index % colors.length]);
        });
        
        return builder;
    }
}