import { describe, expect, it, beforeEach } from 'vitest';
import { ChangeDocumentBuilderFactory } from '../../../utils/change-builders';
import { GroupChangeDocumentBuilder } from '../../../utils/change-builders';
import { ExpenseChangeDocumentBuilder } from '../../../utils/change-builders';
import { SettlementChangeDocumentBuilder } from '../../../utils/change-builders';

describe('ChangeDocumentBuilderFactory', () => {
    let factory: ChangeDocumentBuilderFactory;

    beforeEach(() => {
        factory = new ChangeDocumentBuilderFactory();
    });

    describe('getBuilder', () => {
        it('should return GroupChangeDocumentBuilder for "group" entity type', () => {
            const builder = factory.getBuilder('group');

            expect(builder).toBeInstanceOf(GroupChangeDocumentBuilder);
            expect(builder.getEntityType()).toBe('group');
        });

        it('should return ExpenseChangeDocumentBuilder for "expense" entity type', () => {
            const builder = factory.getBuilder('expense');

            expect(builder).toBeInstanceOf(ExpenseChangeDocumentBuilder);
            expect(builder.getEntityType()).toBe('expense');
        });

        it('should return SettlementChangeDocumentBuilder for "settlement" entity type', () => {
            const builder = factory.getBuilder('settlement');

            expect(builder).toBeInstanceOf(SettlementChangeDocumentBuilder);
            expect(builder.getEntityType()).toBe('settlement');
        });

        it('should throw error for unsupported entity type', () => {
            expect(() => {
                // @ts-expect-error - Testing invalid entity type
                factory.getBuilder('invalidType');
            }).toThrow('Unsupported entity type for change document builder: invalidType');
        });

        it('should return new instances each time (not singletons)', () => {
            const builder1 = factory.getBuilder('group');
            const builder2 = factory.getBuilder('group');

            expect(builder1).not.toBe(builder2);
            expect(builder1).toBeInstanceOf(GroupChangeDocumentBuilder);
            expect(builder2).toBeInstanceOf(GroupChangeDocumentBuilder);
        });
    });

    describe('error handling', () => {
        it('should provide descriptive error message for invalid types', () => {
            expect(() => {
                // @ts-expect-error - Testing invalid entity type
                factory.getBuilder('payment');
            }).toThrow('Unsupported entity type for change document builder: payment');

            expect(() => {
                // @ts-expect-error - Testing invalid entity type
                factory.getBuilder('user');
            }).toThrow('Unsupported entity type for change document builder: user');
        });

        it('should handle null and undefined inputs', () => {
            expect(() => {
                // @ts-expect-error - Testing null input
                factory.getBuilder(null);
            }).toThrow('Unsupported entity type for change document builder: null');

            expect(() => {
                // @ts-expect-error - Testing undefined input
                factory.getBuilder(undefined);
            }).toThrow('Unsupported entity type for change document builder: undefined');
        });

        it('should handle empty string input', () => {
            expect(() => {
                // @ts-expect-error - Testing empty string input
                factory.getBuilder('');
            }).toThrow('Unsupported entity type for change document builder: ');
        });
    });

    describe('builder instances', () => {
        it('should create functional builder instances', () => {
            const groupBuilder = factory.getBuilder('group');
            const expenseBuilder = factory.getBuilder('expense');
            const settlementBuilder = factory.getBuilder('settlement');

            // Test that each builder can create documents
            expect(() => {
                groupBuilder.createMinimalChangeDocument('test123', 'created', ['user1']);
            }).not.toThrow();

            expect(() => {
                expenseBuilder.createMinimalChangeDocument('test456', 'created', ['user1'], { groupId: 'group123' });
            }).not.toThrow();

            expect(() => {
                settlementBuilder.createMinimalChangeDocument('test789', 'created', ['user1'], { groupId: 'group123' });
            }).not.toThrow();
        });
    });
});
