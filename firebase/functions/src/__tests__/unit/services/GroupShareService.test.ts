import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupShareService } from '../../../services/GroupShareService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';

// Mock logger
vi.mock('../../../logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
    LoggerContext: {
        setBusinessContext: vi.fn(),
        clearBusinessContext: vi.fn(),
    },
}));

describe('GroupShareService', () => {
    let groupShareService: GroupShareService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        // Pass stubs directly to ApplicationBuilder constructor
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        groupShareService = applicationBuilder.buildGroupShareService();

        vi.clearAllMocks();
    });

    describe('previewGroupByLink', () => {
        it('should throw BAD_REQUEST when linkId is missing', async () => {
            await expect(groupShareService.previewGroupByLink('user-id', '')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.previewGroupByLink('user-id', '');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.message).toContain('Link ID is required');
        });
    });

    describe('generateShareableLink', () => {
        it('should throw NOT_FOUND when group does not exist', async () => {
            await expect(groupShareService.generateShareableLink('user-id', 'nonexistent-group')).rejects.toThrow(ApiError);

            let caughtError: ApiError | undefined;
            try {
                await groupShareService.generateShareableLink('user-id', 'nonexistent-group');
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(caughtError?.message).toContain('Group not found');
        });

        it('should generate shareable link for group owner', async () => {
            const groupId = 'test-group';
            const userId = 'owner-id';

            // Set up test group using builder
            const testGroup = new FirestoreGroupBuilder().withId(groupId).withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, testGroup);

            // Set up group membership so user has access (as owner)
            const membershipDoc = {
                userId: userId,
                groupId: groupId,
                memberRole: 'admin',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

            const result = await groupShareService.generateShareableLink(userId, groupId);

            expect(result.shareablePath).toMatch(/^\/join\?linkId=.+$/);
            expect(result.linkId).toBeDefined();
            expect(result.linkId.length).toBeGreaterThan(0);
        });
    });

    describe('service initialization', () => {
        it('should initialize service successfully', () => {
            expect(groupShareService).toBeDefined();
            expect(typeof groupShareService.generateShareableLink).toBe('function');
            expect(typeof groupShareService.previewGroupByLink).toBe('function');
        });
    });
});
