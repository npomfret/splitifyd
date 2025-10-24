import { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { CreateGroupRequest } from '@splitifyd/shared';
import { CreateGroupRequestBuilder, ExpenseDTOBuilder, GroupMemberDocumentBuilder, GroupUpdateBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS, VALIDATION_LIMITS } from '../../constants';
import { validateCreateGroup, validateGroupId, validateUpdateGroup } from '../../groups/validation';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { GroupService } from '../../services/GroupService';
import { ApiError } from '../../utils/errors';
import { StubAuthService } from './mocks/StubAuthService';

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let db: StubFirestoreDatabase;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    beforeEach(() => {
        // Create stub database
        db = new StubFirestoreDatabase();
        stubAuth = new StubAuthService();

        applicationBuilder = new ApplicationBuilder(stubAuth, db);
        groupService = applicationBuilder.buildGroupService();
    });

    describe('getGroupFullDetails', () => {
        it('should throw NOT_FOUND when group does not exist', async () => {
            const userId = 'test-user-123';
            const nonExistentGroupId = 'non-existent-group';

            await expect(groupService.getGroupFullDetails(nonExistentGroupId, userId)).rejects.toThrow(ApiError);
        });

        it('should respect the includeDeletedExpenses flag when retrieving expenses', async () => {
            const userId = 'include-deleted-owner';
            const groupId = 'include-deleted-group';

            db.seedGroup(groupId, {
                name: 'Include Deleted Test Group',
                createdBy: userId,
            });
            db.initializeGroupBalance(groupId);

            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, userId, membershipDoc);

            const activeExpense = new ExpenseDTOBuilder()
                .withId('expense-active')
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withCreatedBy(userId)
                .withParticipants([userId])
                .withSplitType('equal')
                .withAmount(25, 'USD')
                .withDescription('Active expense')
                .build();
            db.seedExpense(activeExpense.id, activeExpense);

            const deletedExpense = new ExpenseDTOBuilder()
                .withId('expense-deleted')
                .withGroupId(groupId)
                .withPaidBy(userId)
                .withCreatedBy(userId)
                .withParticipants([userId])
                .withSplitType('equal')
                .withAmount(40, 'USD')
                .withDescription('Deleted expense')
                .withDeletedAt(new Date())
                .withDeletedBy(userId)
                .build();
            db.seedExpense(deletedExpense.id, deletedExpense);

            const defaultDetails = await groupService.getGroupFullDetails(groupId, userId);
            const defaultDescriptions = defaultDetails.expenses.expenses.map((expense) => expense.description);
            expect(defaultDescriptions).toContain('Active expense');
            expect(defaultDescriptions).not.toContain('Deleted expense');
            expect(defaultDetails.expenses.expenses.every((expense) => expense.deletedAt === null)).toBe(true);

            const detailsWithDeleted = await groupService.getGroupFullDetails(groupId, userId, {
                includeDeletedExpenses: true,
            });
            const withDeletedDescriptions = detailsWithDeleted.expenses.expenses.map((expense) => expense.description);
            expect(withDeletedDescriptions).toContain('Active expense');
            expect(withDeletedDescriptions).toContain('Deleted expense');

            const resurrectedExpense = detailsWithDeleted.expenses.expenses.find((expense) => expense.description === 'Deleted expense');
            expect(resurrectedExpense?.deletedAt).not.toBeNull();
            expect(resurrectedExpense?.deletedBy).toBe(userId);
        });
    });

    describe('updateGroup', () => {
        it('should update group successfully when user is owner', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up existing group
            db.seedGroup(groupId, {
                name: 'Original Name',
                description: 'Original Description',
                createdBy: userId,
            });
            db.initializeGroupBalance(groupId);

            // Set up group membership so user has access (as owner)
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, userId, membershipDoc);

            const updateRequest = new GroupUpdateBuilder()
                .withName('Updated Name')
                .withDescription('Updated Description')
                .build();

            const result = await groupService.updateGroup(groupId, userId, updateRequest);

            expect(result).toBeDefined();
            expect(result.message).toBeDefined();
        });
    });

    describe('deleteGroup', () => {
        it('should delete group successfully when user is owner', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up existing group (not marked for deletion yet)
            db.seedGroup(groupId, {
                name: 'Test Group',
                createdBy: userId,
            });
            db.initializeGroupBalance(groupId);

            // Set up group membership so user has access (as owner)
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId(userId)
                .withGroupId(groupId)
                .asAdmin()
                .asActive()
                .buildDocument();
            db.seedGroupMember(groupId, userId, membershipDoc);

            const result = await groupService.deleteGroup(groupId, userId);

            expect(result).toBeDefined();
            expect(result.message).toBeDefined();
        });
    });

    describe('listGroups', () => {
        it('should return user groups successfully', async () => {
            const userId = 'test-user-123';

            // Set up test group
            db.seedGroup('group-1', {
                name: 'Group 1',
                createdBy: userId,
            });

            const result = await groupService.listGroups(userId);

            expect(result).toBeDefined();
            expect(result.groups).toBeDefined();
            expect(Array.isArray(result.groups)).toBe(true);
        });

        it('should return empty array when user has no groups', async () => {
            const userId = 'new-user-with-no-groups';

            const result = await groupService.listGroups(userId);

            expect(result).toBeDefined();
            expect(result.groups).toHaveLength(0);
        });
    });

    /**
     * Group Validation Unit Tests
     *
     * This section provides comprehensive unit test coverage for group validation logic
     * that replaces parts of the integration tests. These tests focus on the validation
     * schemas and logic using direct function calls rather than HTTP API endpoints.
     */
    describe('Group Validation - Unit Tests', () => {
        describe('validateCreateGroup', () => {
            const validGroupData: CreateGroupRequest = new CreateGroupRequestBuilder()
                .withName('Test Group')
                .withDescription('A test group for validation')
                .build();

            describe('Group Name Validation', () => {
                it('should accept valid group names', () => {
                    const validNames = [
                        'Test Group',
                        'A', // minimum length
                        'Group 123',
                        'My-Group_Name',
                        'Group with spaces',
                        'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH), // maximum length
                    ];

                    for (const name of validNames) {
                        const data = new CreateGroupRequestBuilder()
                            .withName(name)
                            .withDescription(validGroupData.description || 'Test description')
                            .build();
                        expect(() => validateCreateGroup(data)).not.toThrow();
                    }
                });

                it('should reject invalid group names', () => {
                    const invalidNames = [
                        '', // empty
                        '   ', // whitespace only
                        'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1), // too long
                    ];

                    for (const name of invalidNames) {
                        const data = new CreateGroupRequestBuilder()
                            .withName(name)
                            .withDescription(validGroupData.description || 'Test description')
                            .build();
                        expect(() => validateCreateGroup(data)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                            }),
                        );
                    }
                });

                it('should trim whitespace from group names', () => {
                    const data = new CreateGroupRequestBuilder()
                        .withName('  Test Group  ')
                        .withDescription(validGroupData.description || 'Test description')
                        .build();
                    const result = validateCreateGroup(data);
                    expect(result.name).toBe('Test Group');
                });

                it('should require group name', () => {
                    const dataWithoutName = new CreateGroupRequestBuilder()
                        .withDescription(validGroupData.description || 'Test description')
                        .build();
                    delete (dataWithoutName as any).name;

                    expect(() => validateCreateGroup(dataWithoutName)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_INPUT',
                            details: expect.stringMatching(/required/i),
                        }),
                    );
                });

                it('should enforce maximum length constraint', () => {
                    const longName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1);
                    const data = new CreateGroupRequestBuilder()
                        .withName(longName)
                        .withDescription(validGroupData.description || 'Test description')
                        .build();

                    expect(() => validateCreateGroup(data)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_INPUT',
                            details: expect.stringMatching(/less than.*characters/i),
                        }),
                    );
                });
            });

            describe('Group Description Validation', () => {
                it('should accept valid descriptions', () => {
                    const validDescriptions = [
                        'A simple description',
                        '', // empty allowed
                        'Description with numbers 123',
                        'Special chars: !@#$%^&*()',
                        'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH), // maximum length
                    ];

                    for (const description of validDescriptions) {
                        const data = new CreateGroupRequestBuilder()
                            .withName(validGroupData.name)
                            .withDescription(description)
                            .build();
                        expect(() => validateCreateGroup(data)).not.toThrow();
                    }
                });

                it('should reject descriptions that are too long', () => {
                    const longDescription = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH + 1);
                    const data = new CreateGroupRequestBuilder()
                        .withName(validGroupData.name)
                        .withDescription(longDescription)
                        .build();

                    expect(() => validateCreateGroup(data)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                        }),
                    );
                });

                it('should trim whitespace from descriptions', () => {
                    const data = new CreateGroupRequestBuilder()
                        .withName(validGroupData.name)
                        .withDescription('  Test Description  ')
                        .build();
                    const result = validateCreateGroup(data);
                    expect(result.description).toBe('Test Description');
                });

                it('should allow missing description (optional field)', () => {
                    const dataWithoutDescription = new CreateGroupRequestBuilder()
                        .withName(validGroupData.name)
                        .build();
                    delete (dataWithoutDescription as any).description;

                    expect(() => validateCreateGroup(dataWithoutDescription)).not.toThrow();
                });
            });

            describe('Complete Validation Scenarios', () => {
                it('should accept valid complete group data', () => {
                    const result = validateCreateGroup(validGroupData);

                    expect(result).toEqual({
                        name: 'Test Group',
                        description: 'A test group for validation',
                    });
                });

                it('should reject completely invalid data', () => {
                    const invalidData = {
                        notAName: 'value',
                        wrongField: 123,
                    };

                    expect(() => validateCreateGroup(invalidData)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                        }),
                    );
                });

                it('should handle null/undefined input', () => {
                    expect(() => validateCreateGroup(null)).toThrow();
                    expect(() => validateCreateGroup(undefined)).toThrow();
                });
            });
        });

        describe('validateUpdateGroup', () => {
            describe('Update Name Validation', () => {
                it('should accept valid name updates', () => {
                    const validUpdates = [{ name: 'Updated Group Name' }, { name: 'A' }, { name: 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH) }];

                    for (const update of validUpdates) {
                        expect(() => validateUpdateGroup(update)).not.toThrow();
                    }
                });

                it('should reject invalid name updates', () => {
                    const invalidUpdates = [{ name: '' }, { name: '   ' }, { name: 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1) }];

                    for (const update of invalidUpdates) {
                        expect(() => validateUpdateGroup(update)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                            }),
                        );
                    }
                });

                it('should trim whitespace from names in updates', () => {
                    const update = { name: '  Updated Name  ' };
                    const result = validateUpdateGroup(update);
                    expect(result.name).toBe('Updated Name');
                });
            });

            describe('Update Description Validation', () => {
                it('should accept valid description updates', () => {
                    const validUpdates = [{ description: 'Updated description' }, { description: '' }, { description: 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH) }];

                    for (const update of validUpdates) {
                        expect(() => validateUpdateGroup(update)).not.toThrow();
                    }
                });

                it('should reject description updates that are too long', () => {
                    const update = { description: 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH + 1) };

                    expect(() => validateUpdateGroup(update)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                        }),
                    );
                });

                it('should trim whitespace from descriptions in updates', () => {
                    const update = { description: '  Updated description  ' };
                    const result = validateUpdateGroup(update);
                    expect(result.description).toBe('Updated description');
                });
            });

            describe('Update Validation Requirements', () => {
                it('should require at least one field to update', () => {
                    expect(() => validateUpdateGroup({})).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                        }),
                    );
                });

                it('should accept updates with both name and description', () => {
                    const update = new GroupUpdateBuilder()
                        .withName('New Name')
                        .withDescription('New description')
                        .build();

                    const result = validateUpdateGroup(update);
                    expect(result).toEqual({
                        name: 'New Name',
                        description: 'New description',
                    });
                });

                it('should reject unknown fields in updates', () => {
                    const update = {
                        name: 'Valid Name',
                        unknownField: 'should be rejected',
                    };

                    // Joi should strip unknown fields, but let's verify the result
                    const result = validateUpdateGroup(update);
                    expect(result).not.toHaveProperty('unknownField');
                    expect(result.name).toBe('Valid Name');
                });
            });
        });

        describe('validateGroupId', () => {
            it('should accept valid group IDs', () => {
                const validIds = ['group-123', 'abc123', 'simple-id', 'id_with_underscores', 'ID-WITH-CAPS', '12345'];

                for (const id of validIds) {
                    expect(() => validateGroupId(id)).not.toThrow();
                    expect(validateGroupId(id)).toBe(id);
                }
            });

            it('should reject invalid group IDs', () => {
                const invalidIds = [
                    null,
                    undefined,
                    '',
                    '   ', // whitespace only
                    123, // not a string
                    {}, // object
                    [], // array
                    false, // boolean
                ];

                for (const id of invalidIds) {
                    expect(() => validateGroupId(id)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            message: expect.stringMatching(/group ID/i),
                        }),
                    );
                }
            });

            it('should trim whitespace from group IDs', () => {
                const id = '  group-123  ';
                const result = validateGroupId(id);
                expect(result).toBe('group-123');
            });
        });

        describe('Error Handling and Security', () => {
            it('should throw ApiError with proper structure', () => {
                try {
                    validateCreateGroup({ name: '' });
                    throw new Error('Expected validation to throw an error');
                } catch (error) {
                    expect(error).toBeInstanceOf(ApiError);
                    expect(error).toHaveProperty('statusCode', HTTP_STATUS.BAD_REQUEST);
                    expect(error).toHaveProperty('message');
                }
            });

            it('should handle malformed input gracefully', () => {
                const malformedInputs = ['not an object', 123, [], true, Symbol('test')];

                for (const input of malformedInputs) {
                    expect(() => validateCreateGroup(input)).toThrow();
                }
            });

            it('should sanitize input through validation process', () => {
                // The validation should handle potentially unsafe input
                const inputWithExtraSpaces = new CreateGroupRequestBuilder()
                    .withName('   Group Name   ')
                    .withDescription('   Description   ')
                    .build();

                const result = validateCreateGroup(inputWithExtraSpaces);
                expect(result.name).toBe('Group Name');
                expect(result.description).toBe('Description');
            });
        });

        describe('Validation Limits Integration', () => {
            it('should use correct validation limits from constants', () => {
                // Test that validation uses the actual constants
                const maxLengthName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH);
                const tooLongName = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH + 1);

                expect(() => validateCreateGroup({ name: maxLengthName })).not.toThrow();
                expect(() => validateCreateGroup({ name: tooLongName })).toThrow();

                const maxLengthDescription = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH);
                const tooLongDescription = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH + 1);

                expect(() => validateCreateGroup({ name: 'Test', description: maxLengthDescription })).not.toThrow();
                expect(() => validateCreateGroup({ name: 'Test', description: tooLongDescription })).toThrow();
            });
        });
    });
});
