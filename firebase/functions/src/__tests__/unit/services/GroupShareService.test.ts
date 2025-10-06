import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupShareService } from '../../../services/GroupShareService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import {
    StubFirestoreReader,
    StubFirestoreWriter,
    StubAuthService
} from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { GroupDTOBuilder } from '@splitifyd/test-support';
import { GroupMemberDocumentBuilder } from "../../support/GroupMemberDocumentBuilder";
import { MAX_GROUP_MEMBERS } from '@splitifyd/shared';

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

        // Create ApplicationBuilder and build GroupShareService
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
            const testGroup = new GroupDTOBuilder().withId(groupId).withCreatedBy(userId).build();

            stubReader.setDocument('groups', groupId, testGroup);

            // Set up group membership so user has access (as owner)
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId)
                .asAdmin()
                .build();
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

    describe('group member cap enforcement', () => {
        const groupId = 'test-group';
        const linkId = 'test-link-123';
        const newUserId = 'new-user-id';
        const newUserEmail = 'newuser@test.com';

        beforeEach(() => {
            // Set up test group
            const testGroup = new GroupDTOBuilder()
                .withId(groupId)
                .withCreatedBy('owner-id')
                .build();
            stubReader.setDocument('groups', groupId, testGroup);

            // Set up share link
            const shareLink = {
                id: linkId,
                token: linkId,
                createdBy: 'owner-id',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            stubReader.setShareLink(groupId, linkId, shareLink);
        });

        it(`should succeed when group has ${MAX_GROUP_MEMBERS - 1} members`, async () => {
            // Create MAX_GROUP_MEMBERS - 1 existing members
            const existingMembers = Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, i) =>
                new GroupMemberDocumentBuilder()
                    .withUserId(`user-${i}`)
                    .withGroupId(groupId)
                    .build()
            );

            stubReader.setGroupMembers(groupId, existingMembers);

            // Should succeed - we're at 49 members, adding 1 more = 50 (at cap, but still allowed)
            await expect(
                groupShareService.joinGroupByLink(newUserId, newUserEmail, linkId)
            ).resolves.toBeDefined();
        });

        it(`should fail when group already has ${MAX_GROUP_MEMBERS} members`, async () => {
            // Create exactly MAX_GROUP_MEMBERS existing members
            const existingMembers = Array.from({ length: MAX_GROUP_MEMBERS }, (_, i) =>
                new GroupMemberDocumentBuilder()
                    .withUserId(`user-${i}`)
                    .withGroupId(groupId)
                    .build()
            );

            stubReader.setGroupMembers(groupId, existingMembers);

            // Should fail with GROUP_AT_CAPACITY
            let caughtError: ApiError | undefined;
            try {
                await groupShareService.joinGroupByLink(newUserId, newUserEmail, linkId);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe('GROUP_AT_CAPACITY');
            expect(caughtError?.message).toContain(`${MAX_GROUP_MEMBERS} members`);
        });

        it(`should detect overflow in getAllGroupMembers when group has > ${MAX_GROUP_MEMBERS}`, async () => {
            // Create MAX_GROUP_MEMBERS + 1 members (edge case - should never happen in practice)
            // This tests the overflow detection in FirestoreReader.getAllGroupMembers directly
            const tooManyMembers = Array.from({ length: MAX_GROUP_MEMBERS + 1 }, (_, i) =>
                new GroupMemberDocumentBuilder()
                    .withUserId(`user-${i}`)
                    .withGroupId(groupId)
                    .build()
            );

            stubReader.setGroupMembers(groupId, tooManyMembers);

            // Calling getAllGroupMembers directly should detect overflow
            let caughtError: ApiError | undefined;
            try {
                await stubReader.getAllGroupMembers(groupId);
            } catch (error) {
                caughtError = error as ApiError;
            }

            expect(caughtError).toBeInstanceOf(ApiError);
            expect(caughtError?.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(caughtError?.code).toBe('GROUP_TOO_LARGE');
            expect(caughtError?.message).toContain('exceeds maximum size');
        });
    });
});