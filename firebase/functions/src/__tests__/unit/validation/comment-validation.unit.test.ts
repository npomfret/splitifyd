import { describe, it, expect } from 'vitest';
import { validateCreateComment, validateListCommentsQuery, validateTargetId, validateCommentId } from '../../../comments/validation';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { CommentTargetTypes } from '@splitifyd/shared';
import type { CreateCommentRequest, CommentTargetType } from '@splitifyd/shared';

/**
 * Comment Validation Unit Tests
 *
 * This file provides comprehensive unit test coverage for comment validation logic
 * that replaces parts of the integration tests. These tests focus on the validation
 * schemas and logic using direct function calls rather than HTTP API endpoints.
 */
describe('Comment Validation - Unit Tests', () => {
    describe('validateCreateComment', () => {
        const validCommentData: CreateCommentRequest = {
            text: 'This is a valid comment',
            targetType: CommentTargetTypes.GROUP,
            targetId: 'group-123',
            groupId: 'group-123',
        };

        describe('Comment Text Validation', () => {
            it('should accept valid comment text', () => {
                const validTexts = [
                    'Simple comment',
                    'Comment with numbers 123',
                    'Comment with special chars!@#$%',
                    'A', // minimum length
                    'A'.repeat(500), // maximum length
                    'Multi\nline\ncomment',
                    'Comment with emojis 😀🎉',
                ];

                for (const text of validTexts) {
                    const data = { ...validCommentData, text };
                    expect(() => validateCreateComment(data)).not.toThrow();
                }
            });

            it('should reject invalid comment text', () => {
                const invalidTexts = [
                    '', // empty
                    '   ', // whitespace only
                    'A'.repeat(501), // too long
                ];

                for (const text of invalidTexts) {
                    const data = { ...validCommentData, text };
                    expect(() => validateCreateComment(data)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                        }),
                    );
                }
            });

            it('should trim whitespace from comment text', () => {
                const data = { ...validCommentData, text: '  Valid comment  ' };
                const result = validateCreateComment(data);
                expect(result.text).toBe('Valid comment');
            });

            it('should require comment text', () => {
                const dataWithoutText = { ...validCommentData };
                delete (dataWithoutText as any).text;

                expect(() => validateCreateComment(dataWithoutText)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_TEXT',
                        message: expect.stringMatching(/required/i),
                    }),
                );
            });

            it('should enforce maximum length constraint', () => {
                const longText = 'A'.repeat(501);
                const data = { ...validCommentData, text: longText };

                expect(() => validateCreateComment(data)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_TEXT',
                        message: 'Comment cannot exceed 500 characters',
                    }),
                );
            });
        });

        describe('Target Type Validation', () => {
            it('should accept valid target types', () => {
                const validTargetTypes = [CommentTargetTypes.GROUP, CommentTargetTypes.EXPENSE];

                for (const targetType of validTargetTypes) {
                    const data = { ...validCommentData, targetType };
                    expect(() => validateCreateComment(data)).not.toThrow();
                }
            });

            it('should reject invalid target types', () => {
                const invalidTargetTypes = ['invalid', 'user', 'settlement', '', null, undefined, 123];

                for (const targetType of invalidTargetTypes) {
                    const data = { ...validCommentData, targetType };
                    expect(() => validateCreateComment(data as any)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_TARGET_TYPE',
                        }),
                    );
                }
            });

            it('should require target type', () => {
                const dataWithoutTargetType = { ...validCommentData };
                delete (dataWithoutTargetType as any).targetType;

                expect(() => validateCreateComment(dataWithoutTargetType)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_TARGET_TYPE',
                        message: 'Target type is required',
                    }),
                );
            });

            it('should provide specific error message for invalid target types', () => {
                const data = { ...validCommentData, targetType: 'invalid' };

                expect(() => validateCreateComment(data as any)).toThrow(
                    expect.objectContaining({
                        code: 'INVALID_TARGET_TYPE',
                        message: 'Target type must be either "group" or "expense"',
                    }),
                );
            });
        });

        describe('Target ID Validation', () => {
            it('should accept valid target IDs', () => {
                const validTargetIds = ['group-123', 'expense-456', 'simple-id', 'id_with_underscores', 'ID-WITH-CAPS'];

                for (const targetId of validTargetIds) {
                    const data = { ...validCommentData, targetId };
                    expect(() => validateCreateComment(data)).not.toThrow();
                }
            });

            it('should reject invalid target IDs', () => {
                const invalidTargetIds = [
                    '',
                    '   ', // whitespace only
                    null,
                    undefined,
                ];

                for (const targetId of invalidTargetIds) {
                    const data = { ...validCommentData, targetId };
                    expect(() => validateCreateComment(data as any)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_TARGET_ID',
                        }),
                    );
                }
            });

            it('should trim whitespace from target IDs', () => {
                const data = { ...validCommentData, targetId: '  group-123  ' };
                const result = validateCreateComment(data);
                expect(result.targetId).toBe('group-123');
            });

            it('should require target ID', () => {
                const dataWithoutTargetId = { ...validCommentData };
                delete (dataWithoutTargetId as any).targetId;

                expect(() => validateCreateComment(dataWithoutTargetId)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_TARGET_ID',
                        message: 'Target ID is required',
                    }),
                );
            });
        });

        describe('Group ID Validation', () => {
            it('should accept valid group IDs', () => {
                const validGroupIds = [
                    'group-123',
                    'simple-id',
                    undefined, // optional field
                ];

                for (const groupId of validGroupIds) {
                    const data = { ...validCommentData, groupId };
                    expect(() => validateCreateComment(data)).not.toThrow();
                }
            });

            it('should trim whitespace from group IDs', () => {
                const data = { ...validCommentData, groupId: '  group-123  ' };
                const result = validateCreateComment(data);
                expect(result.groupId).toBe('group-123');
            });

            it('should allow missing group ID (optional field)', () => {
                const dataWithoutGroupId = { ...validCommentData };
                delete (dataWithoutGroupId as any).groupId;

                expect(() => validateCreateComment(dataWithoutGroupId)).not.toThrow();
            });
        });

        describe('Complete Validation Scenarios', () => {
            it('should accept valid complete comment data', () => {
                const result = validateCreateComment(validCommentData);

                expect(result).toEqual({
                    text: 'This is a valid comment',
                    targetType: CommentTargetTypes.GROUP,
                    targetId: 'group-123',
                    groupId: 'group-123',
                });
            });

            it('should sanitize input data', () => {
                // Note: The actual sanitization depends on the sanitizeString implementation
                const dataWithSpaces = {
                    text: '  Comment with spaces  ',
                    targetType: CommentTargetTypes.GROUP,
                    targetId: '  group-123  ',
                    groupId: '  group-123  ',
                };

                const result = validateCreateComment(dataWithSpaces);
                expect(result.text).toBe('Comment with spaces');
                expect(result.targetId).toBe('group-123');
                expect(result.groupId).toBe('group-123');
            });

            it('should handle data without optional fields', () => {
                const minimalData = {
                    text: 'Minimal comment',
                    targetType: CommentTargetTypes.EXPENSE,
                    targetId: 'expense-456',
                };

                const result = validateCreateComment(minimalData);
                expect(result).toEqual({
                    text: 'Minimal comment',
                    targetType: CommentTargetTypes.EXPENSE,
                    targetId: 'expense-456',
                    groupId: undefined,
                });
            });
        });
    });

    describe('validateListCommentsQuery', () => {
        describe('Cursor Parameter Validation', () => {
            it('should accept valid cursor values', () => {
                const validQueries = [
                    { cursor: 'cursor-123' },
                    { cursor: 'simple-cursor' },
                    {}, // no cursor (optional)
                    { cursor: undefined }, // undefined cursor
                ];

                for (const query of validQueries) {
                    expect(() => validateListCommentsQuery(query)).not.toThrow();
                }
            });

            it('should allow missing cursor parameter', () => {
                const result = validateListCommentsQuery({});
                expect(result).toEqual({ limit: 20 }); // default limit
            });
        });

        describe('Limit Parameter Validation', () => {
            it('should accept valid limit values', () => {
                const validLimits = [1, 10, 50, 100];

                for (const limit of validLimits) {
                    const query = { limit };
                    expect(() => validateListCommentsQuery(query)).not.toThrow();
                }
            });

            it('should reject invalid limit values', () => {
                const invalidLimits = [
                    0, // too small
                    -1, // negative
                    101, // too large
                    1.5, // not integer
                    'not-a-number',
                    null,
                ];

                for (const limit of invalidLimits) {
                    const query = { limit };
                    expect(() => validateListCommentsQuery(query)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_QUERY_PARAMS',
                        }),
                    );
                }
            });

            it('should use default limit when not provided', () => {
                const result = validateListCommentsQuery({});
                expect(result.limit).toBe(20);
            });

            it('should preserve provided valid limit', () => {
                const result = validateListCommentsQuery({ limit: 50 });
                expect(result.limit).toBe(50);
            });
        });

        describe('Complete Query Validation', () => {
            it('should validate complete query with both parameters', () => {
                const query = { cursor: 'cursor-123', limit: 25 };
                const result = validateListCommentsQuery(query);

                expect(result).toEqual({
                    cursor: 'cursor-123',
                    limit: 25,
                });
            });

            it('should ignore unknown query parameters', () => {
                const query = {
                    cursor: 'cursor-123',
                    limit: 25,
                    unknownParam: 'should be ignored',
                };

                const result = validateListCommentsQuery(query);
                expect(result).not.toHaveProperty('unknownParam');
                expect(result).toEqual({
                    cursor: 'cursor-123',
                    limit: 25,
                });
            });
        });
    });

    describe('validateTargetId', () => {
        it('should accept valid target IDs for different target types', () => {
            const validIds = ['group-123', 'expense-456', 'simple-id'];
            const targetTypes: CommentTargetType[] = [CommentTargetTypes.GROUP, CommentTargetTypes.EXPENSE];

            for (const id of validIds) {
                for (const targetType of targetTypes) {
                    expect(() => validateTargetId(id, targetType)).not.toThrow();
                    expect(validateTargetId(id, targetType)).toBe(id);
                }
            }
        });

        it('should reject invalid target IDs', () => {
            const invalidIds = [null, undefined, '', '   ', 123, {}, []];
            const targetType = CommentTargetTypes.GROUP;

            for (const id of invalidIds) {
                expect(() => validateTargetId(id, targetType)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_TARGET_ID',
                        message: 'Invalid group ID',
                    }),
                );
            }
        });

        it('should trim whitespace from target IDs', () => {
            const id = '  group-123  ';
            const result = validateTargetId(id, CommentTargetTypes.GROUP);
            expect(result).toBe('group-123');
        });

        it('should include target type in error message', () => {
            expect(() => validateTargetId('', CommentTargetTypes.GROUP)).toThrow(
                expect.objectContaining({
                    message: 'Invalid group ID',
                }),
            );

            expect(() => validateTargetId('', CommentTargetTypes.EXPENSE)).toThrow(
                expect.objectContaining({
                    message: 'Invalid expense ID',
                }),
            );
        });
    });

    describe('validateCommentId', () => {
        it('should accept valid comment IDs', () => {
            const validIds = ['comment-123', 'simple-id', 'id_with_underscores', 'ID-WITH-CAPS'];

            for (const id of validIds) {
                expect(() => validateCommentId(id)).not.toThrow();
                expect(validateCommentId(id)).toBe(id);
            }
        });

        it('should reject invalid comment IDs', () => {
            const invalidIds = [
                null,
                undefined,
                '',
                '   ', // whitespace only
                123, // not a string
                {}, // object
                [], // array
            ];

            for (const id of invalidIds) {
                expect(() => validateCommentId(id)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_ID',
                        message: 'Invalid comment ID',
                    }),
                );
            }
        });

        it('should trim whitespace from comment IDs', () => {
            const id = '  comment-123  ';
            const result = validateCommentId(id);
            expect(result).toBe('comment-123');
        });
    });

    describe('Error Handling and Security', () => {
        it('should throw ApiError with proper structure', () => {
            try {
                validateCreateComment({ text: '' });
                throw new Error('Expected validation to throw an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error).toHaveProperty('statusCode', HTTP_STATUS.BAD_REQUEST);
                expect(error).toHaveProperty('code');
                expect(error).toHaveProperty('message');
            }
        });

        it('should handle malformed input gracefully', () => {
            const malformedInputs = ['not an object', 123, [], true, null, undefined];

            for (const input of malformedInputs) {
                expect(() => validateCreateComment(input)).toThrow();
            }
        });

        it('should provide specific error codes for different validation failures', () => {
            // Text validation error
            expect(() => validateCreateComment({ text: '', targetType: CommentTargetTypes.GROUP, targetId: 'group-1' })).toThrow(expect.objectContaining({ code: 'INVALID_COMMENT_TEXT' }));

            // Target type validation error
            expect(() => validateCreateComment({ text: 'Valid', targetType: 'invalid', targetId: 'group-1' })).toThrow(expect.objectContaining({ code: 'INVALID_TARGET_TYPE' }));

            // Target ID validation error
            expect(() => validateCreateComment({ text: 'Valid', targetType: CommentTargetTypes.GROUP, targetId: '' })).toThrow(expect.objectContaining({ code: 'INVALID_TARGET_ID' }));
        });
    });
});
