import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Group sharing workflow (stub firestore)', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    afterEach(() => {
        appDriver.dispose();
    });

    const seedUsers = (...ids: string[]) => {
        ids.forEach((id) => {
            appDriver.seedUser(id, { displayName: `User ${id}`, email: `${id}@test.local` });
        });
    };

    it('supports generating share links and joining flow for multiple members', async () => {
        const owner = 'owner-user';
        const member = 'member-user';
        const joiner = 'joiner-user';
        const outsider = 'outsider-user';
        seedUsers(owner, member, joiner, outsider);

        const group = await appDriver.createGroup(
            owner,
            new CreateGroupRequestBuilder()
                .withName('Shareable Group')
                .withDescription('Sharing end-to-end')
                .build(),
        );

        // Owner can generate a share link
        const ownerShare = await appDriver.generateShareableLink(owner, group.id);
        expect(ownerShare.shareablePath).toBe(`/join?linkId=${ownerShare.linkId}`);
        expect(ownerShare.linkId).toHaveLength(16);

        // Members can also generate a link once they join
        const joinResult = await appDriver.joinGroupByLink(member, ownerShare.linkId);
        expect(joinResult.groupId).toBe(group.id);
        expect(joinResult.success).toBe(true);

        const memberShare = await appDriver.generateShareableLink(member, group.id);
        expect(memberShare.linkId).toHaveLength(16);

        // Non-members cannot generate links
        await expect(appDriver.generateShareableLink(outsider, group.id)).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
        });

        // Additional users can join via the same link
        const joinerResult = await appDriver.joinGroupByLink(joiner, ownerShare.linkId);
        expect(joinerResult.groupId).toBe(group.id);
        expect(joinerResult.success).toBe(true);

        const detailsForJoiner = await appDriver.getGroupFullDetails(joiner, group.id);
        expect(detailsForJoiner.members.members.map((m) => m.uid)).toEqual(expect.arrayContaining([owner, member, joiner]));

        // Duplicate joins are rejected with a clear error
        await expect(appDriver.joinGroupByLink(joiner, ownerShare.linkId)).rejects.toMatchObject({
            code: 'ALREADY_MEMBER',
        });

        // Invalid tokens surface INVALID_LINK errors
        await expect(appDriver.joinGroupByLink(member, 'INVALID_TOKEN_12345')).rejects.toMatchObject({
            code: 'INVALID_LINK',
        });
    });

    it('allows multiple unique users to reuse the same share link', async () => {
        const owner = 'share-owner';
        const joiners = ['joiner-1', 'joiner-2', 'joiner-3'];
        seedUsers(owner, ...joiners);

        const group = await appDriver.createGroup(
            owner,
            new CreateGroupRequestBuilder()
                .withName('Multi Join Group')
                .build(),
        );

        const shareLink = await appDriver.generateShareableLink(owner, group.id);

        for (const userId of joiners) {
            const response = await appDriver.joinGroupByLink(userId, shareLink.linkId);
            expect(response.groupId).toBe(group.id);
            expect(response.success).toBe(true);
        }

        const ownerView = await appDriver.getGroupFullDetails(owner, group.id);
        const memberIds = ownerView.members.members.map((member) => member.uid);

        expect(memberIds).toEqual(expect.arrayContaining([owner, ...joiners]));
        expect(memberIds).toHaveLength(1 + joiners.length);
    });
});
