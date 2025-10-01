import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentStrategyFactory } from '../../../../services/comments/CommentStrategyFactory';
import { GroupCommentStrategy } from '../../../../services/comments/GroupCommentStrategy';
import { ExpenseCommentStrategy } from '../../../../services/comments/ExpenseCommentStrategy';
import { StubFirestoreReader } from '../../mocks/firestore-stubs';
import { CommentTargetTypes } from '@splitifyd/shared';

const createStubGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
});

describe('CommentStrategyFactory', () => {
    let factory: CommentStrategyFactory;
    let stubFirestoreReader: StubFirestoreReader;
    let stubGroupMemberService: ReturnType<typeof createStubGroupMemberService>;

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        stubGroupMemberService = createStubGroupMemberService();
        factory = new CommentStrategyFactory(stubFirestoreReader, stubGroupMemberService as any);
    });

    describe('getStrategy', () => {
        it('should return GroupCommentStrategy for GROUP target type', () => {
            const strategy = factory.getStrategy(CommentTargetTypes.GROUP);

            expect(strategy).toBeInstanceOf(GroupCommentStrategy);
        });

        it('should return ExpenseCommentStrategy for EXPENSE target type', () => {
            const strategy = factory.getStrategy(CommentTargetTypes.EXPENSE);

            expect(strategy).toBeInstanceOf(ExpenseCommentStrategy);
        });

        it('should create new strategy instances for each call (no caching)', () => {
            const strategy1 = factory.getStrategy(CommentTargetTypes.GROUP);
            const strategy2 = factory.getStrategy(CommentTargetTypes.GROUP);

            expect(strategy1).not.toBe(strategy2);
            expect(strategy1).toBeInstanceOf(GroupCommentStrategy);
            expect(strategy2).toBeInstanceOf(GroupCommentStrategy);
        });

        it('should return different strategy instances for different types', () => {
            const groupStrategy = factory.getStrategy(CommentTargetTypes.GROUP);
            const expenseStrategy = factory.getStrategy(CommentTargetTypes.EXPENSE);

            expect(groupStrategy).not.toBe(expenseStrategy);
            expect(groupStrategy).toBeInstanceOf(GroupCommentStrategy);
            expect(expenseStrategy).toBeInstanceOf(ExpenseCommentStrategy);
        });

        it('should throw error for unknown target type', () => {
            // Test with invalid enum value by casting
            const invalidType = 'UNKNOWN_TYPE' as any;

            expect(() => {
                factory.getStrategy(invalidType);
            }).toThrow('Unsupported comment target type: UNKNOWN_TYPE');
        });

        it('should throw error for null target type', () => {
            expect(() => {
                factory.getStrategy(null as any);
            }).toThrow('Unsupported comment target type: null');
        });

        it('should throw error for undefined target type', () => {
            expect(() => {
                factory.getStrategy(undefined as any);
            }).toThrow('Unsupported comment target type: undefined');
        });
    });

    describe('strategy creation', () => {
        it('should create strategies with correct dependencies', () => {
            const groupStrategy = factory.getStrategy(CommentTargetTypes.GROUP) as GroupCommentStrategy;
            const expenseStrategy = factory.getStrategy(CommentTargetTypes.EXPENSE) as ExpenseCommentStrategy;

            // Both strategies should be created with the injected dependencies
            expect(groupStrategy).toBeDefined();
            expect(expenseStrategy).toBeDefined();
        });
    });
});
