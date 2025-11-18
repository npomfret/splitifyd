import { CreateGroupRequestBuilder } from '@billsplit-wl/test-support';
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
            new CreateGroupRequestBuilder()
                .withName('Shareable Group')
                .withDescription('Sharing end-to-end')
                .build(),
            owner,
        );

        // Owner can generate a share link
        const ownerShare = await appDriver.generateShareableLink(group.id, undefined, owner);
        expect(ownerShare.shareablePath).toBe(`/join?shareToken=${ownerShare.shareToken}`);
        expect(ownerShare.shareToken).toHaveLength(16);
        expect(new Date(ownerShare.expiresAt).getTime()).toBeGreaterThan(Date.now());

        // Members can also generate a link once they join
        const joinResult = await appDriver.joinGroupByLink(ownerShare.shareToken, undefined, member);
        expect(joinResult.groupId).toBe(group.id);
        expect(joinResult.success).toBe(true);

        const memberShare = await appDriver.generateShareableLink(group.id, undefined, member);
        expect(memberShare.shareToken).toHaveLength(16);
        expect(new Date(memberShare.expiresAt).getTime()).toBeGreaterThan(Date.now());

        // Non-members cannot generate links
        await expect(appDriver.generateShareableLink(group.id, undefined, outsider)).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
        });

        // Additional users can join via the same link
        const joinerResult = await appDriver.joinGroupByLink(ownerShare.shareToken, undefined, joiner);
        expect(joinerResult.groupId).toBe(group.id);
        expect(joinerResult.success).toBe(true);

        const detailsForJoiner = await appDriver.getGroupFullDetails(group.id, {}, joiner);
        expect(detailsForJoiner.members.members.map((m) => m.uid)).toEqual(expect.arrayContaining([owner, member, joiner]));

        // Duplicate joins are rejected with a clear error
        await expect(appDriver.joinGroupByLink(ownerShare.shareToken, undefined, joiner)).rejects.toMatchObject({
            code: 'ALREADY_MEMBER',
        });

        // Invalid tokens surface INVALID_LINK errors
        await expect(appDriver.joinGroupByLink('INVALID_TOKEN_12345', undefined, member)).rejects.toMatchObject({
            code: 'INVALID_LINK',
        });
    });

    it('allows multiple unique users to reuse the same share link', async () => {
        const owner = 'share-owner';
        const joiners = ['joiner-1', 'joiner-2', 'joiner-3'];
        seedUsers(owner, ...joiners);

        const group = await appDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Multi Join Group')
                .build(),
            owner,
        );

        const shareLink = await appDriver.generateShareableLink(group.id, undefined, owner);
        expect(new Date(shareLink.expiresAt).getTime()).toBeGreaterThan(Date.now());

        for (const userId of joiners) {
            const response = await appDriver.joinGroupByLink(shareLink.shareToken, undefined, userId);
            expect(response.groupId).toBe(group.id);
            expect(response.success).toBe(true);
        }

        const ownerView = await appDriver.getGroupFullDetails(group.id, {}, owner);
        const memberIds = ownerView.members.members.map((member) => member.uid);

        expect(memberIds).toEqual(expect.arrayContaining([owner, ...joiners]));
        expect(memberIds).toHaveLength(1 + joiners.length);
    });
});
