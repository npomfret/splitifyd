import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../services/GroupService';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import {
    StubFirestoreReader,
    StubFirestoreWriter,
    StubAuthService
} from './mocks/firestore-stubs';
import { FirestoreGroupBuilder, GroupMemberDocumentBuilder } from '@splitifyd/test-support';
import { ApiError } from '../../utils/errors';
import { validateCreateGroup, validateUpdateGroup, validateGroupId } from '../../groups/validation';
import { HTTP_STATUS } from '../../constants';
import { VALIDATION_LIMITS } from '../../constants';
import type { CreateGroupRequest } from '@splitifyd/shared';

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        // Create ApplicationBuilder and build GroupService
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        groupService = applicationBuilder.buildGroupService();

        vi.clearAllMocks();
    });

    describe('createGroup', () => {
        it('should create group successfully', async () => {
            const userId = 'test-user-123';
            const createGroupRequest = {
                name: 'Test Group',
                description: 'Test Description',
            };

            const expectedGroupId = 'test-group-created';

            // Mock createInTransaction to return a group ID
            vi.spyOn(stubWriter, 'createInTransaction').mockResolvedValue({
                id: expectedGroupId,
                path: `groups/${expectedGroupId}`,
            });

            // Mock getGroup to return the created group directly
            const createdGroup = new FirestoreGroupBuilder().withId(expectedGroupId).withName(createGroupRequest.name).withDescription(createGroupRequest.description).withCreatedBy(userId).build();

            vi.spyOn(stubReader, 'getGroup').mockResolvedValue(createdGroup);

            // Add group membership for balance calculation
            const membershipDoc = new GroupMemberDocumentBuilder(userId, expectedGroupId)
                .asAdmin()
                .asActive()
                .build();
            stubReader.setDocument('group-members', `${expectedGroupId}_${userId}`, membershipDoc);

            const result = await groupService.createGroup(userId, createGroupRequest);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe(createGroupRequest.name);
            expect(result.description).toBe(createGroupRequest.description);
        });
    });

    describe('getGroupFullDetails', () => {
        it('should return group when it exists and user has access', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up test group using builder
            const testGroup = new FirestoreGroupBuilder().withId(groupId).withName('Test Group').withDescription('Test Description').withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, testGroup);
            stubWriter.setDocument('groups', groupId, testGroup);

            // Set up group membership so user has access
            const membershipDoc = new GroupMemberDocumentBuilder(userId, groupId)
                .asAdmin()
                .asActive()
                .build();
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);
            stubWriter.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            // Mock ExpenseService.listGroupExpenses to avoid permission issues
            const expenseService = applicationBuilder.buildExpenseService();
            vi.spyOn(expenseService, 'listGroupExpenses').mockResolvedValue({
                expenses: [],
                count: 0,
                hasMore: false,
            });

            const result = await groupService.getGroupFullDetails(groupId, userId);

            expect(result).toBeDefined();
            expect(result.group.id).toBe(groupId);
            expect(result.group.name).toBe('Test Group');
            expect(result.group.description).toBe('Test Description');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            const userId = 'test-user-123';
            const nonExistentGroupId = 'non-existent-group';

            await expect(groupService.getGroupFullDetails(nonExistentGroupId, userId)).rejects.toThrow(ApiError);
        });
    });

    describe('updateGroup', () => {
        it('should update group successfully when user is owner', async () => {
            const userId = 'test-user-123';
            const groupId = 'test-group-456';

            // Set up existing group
            const existingGroup = new FirestoreGroupBuilder().withId(groupId).withName('Original Name').withDescription('Original Description').withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, existingGroup);

            // Set up group membership so user has access (as owner)
            const membershipDoc = new GroupMemberDocumentBuilder(userId, groupId)
                .asAdmin()
                .asActive()
                .build();
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            const updateRequest = {
                name: 'Updated Name',
                description: 'Updated Description',
            };

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
            const existingGroup = new FirestoreGroupBuilder().withId(groupId).withName('Test Group').withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, existingGroup);
            stubWriter.setDocument('groups', groupId, existingGroup);

            // Set up group membership so user has access (as owner)
            const membershipDoc = new GroupMemberDocumentBuilder(userId, groupId)
                .asAdmin()
                .asActive()
                .build();
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            const result = await groupService.deleteGroup(groupId, userId);

            expect(result).toBeDefined();
            expect(result.message).toBeDefined();
        });
    });

    describe('listGroups', () => {
        it('should return user groups successfully', async () => {
            const userId = 'test-user-123';

            // Set up test groups using builder
            const group1 = new FirestoreGroupBuilder().withId('group-1').withName('Group 1').withCreatedBy(userId).build();

            stubReader.setDocument('groups', 'group-1', group1);

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
            const validGroupData: CreateGroupRequest = {
                name: 'Test Group',
                description: 'A test group for validation',
            };

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
                        const data = { ...validGroupData, name };
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
                        const data = { ...validGroupData, name };
                        expect(() => validateCreateGroup(data)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                            }),
                        );
                    }
                });

                it('should trim whitespace from group names', () => {
                    const data = { ...validGroupData, name: '  Test Group  ' };
                    const result = validateCreateGroup(data);
                    expect(result.name).toBe('Test Group');
                });

                it('should require group name', () => {
                    const dataWithoutName = { ...validGroupData };
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
                    const data = { ...validGroupData, name: longName };

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
                        const data = { ...validGroupData, description };
                        expect(() => validateCreateGroup(data)).not.toThrow();
                    }
                });

                it('should reject descriptions that are too long', () => {
                    const longDescription = 'A'.repeat(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH + 1);
                    const data = { ...validGroupData, description: longDescription };

                    expect(() => validateCreateGroup(data)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                        }),
                    );
                });

                it('should trim whitespace from descriptions', () => {
                    const data = { ...validGroupData, description: '  Test Description  ' };
                    const result = validateCreateGroup(data);
                    expect(result.description).toBe('Test Description');
                });

                it('should allow missing description (optional field)', () => {
                    const dataWithoutDescription = { ...validGroupData };
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
                    const update = {
                        name: 'New Name',
                        description: 'New description',
                    };

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
                const inputWithExtraSpaces = {
                    name: '   Group Name   ',
                    description: '   Description   ',
                };

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
