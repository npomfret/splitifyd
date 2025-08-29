
import { DocumentSnapshot, FieldValue } from 'firebase-admin/firestore';
import { firestoreDb } from '../firebase';
import { Errors } from '../utils/errors';
import { userService } from './UserService2';
import { logger, LoggerContext } from '../logger';
import { FirestoreCollections, Group, GroupMembersResponse, User } from '@splitifyd/shared';
import { calculateGroupBalances } from './balanceCalculator';

export class GroupMemberService {
    private transformGroupDocument(doc: DocumentSnapshot): Group {
        const data = doc.data();
        if (!data) {
            throw new Error('Invalid group document');
        }

        if (!data.data) {
            throw new Error('Invalid group document structure: missing data field');
        }
        const groupData = data.data;

        return {
            id: doc.id,
            name: groupData.name!,
            description: groupData.description ?? '',
            createdBy: groupData.createdBy!,
            members: groupData.members,
            createdAt: data.createdAt!.toDate().toISOString(),
            updatedAt: data.updatedAt!.toDate().toISOString(),
        } as Group;
    }

    private getInitials(nameOrEmail: string): string {
        const name = nameOrEmail || '';
        const parts = name.split(/[\s@]+/).filter(Boolean);

        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    async getGroupMembersData(groupId: string, membersMap: Record<string, any>): Promise<GroupMembersResponse> {
        const memberIds = Object.keys(membersMap);

        const memberProfiles = await userService.getUsers(memberIds);

        const members: User[] = memberIds.map((memberId: string) => {
            const profile = memberProfiles.get(memberId);
            const memberInfo = membersMap[memberId];

            if (!profile) {
                return {
                    uid: memberId,
                    name: 'Unknown User',
                    initials: '?',
                    email: '',
                    displayName: 'Unknown User',
                    themeColor: memberInfo.theme,
                };
            }

            return {
                uid: memberId,
                name: profile.displayName,
                initials: this.getInitials(profile.displayName),
                email: profile.email,
                displayName: profile.displayName,
                themeColor: memberInfo.theme,
            };
        });

        members.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return {
            members,
            hasMore: false,
        };
    }

    async getGroupMembers(userId: string, groupId: string): Promise<GroupMembersResponse> {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = this.transformGroupDocument(doc);

        if (!(userId in group.members)) {
            throw Errors.FORBIDDEN();
        }

        return await this.getGroupMembersData(groupId, group.members);
    }

    async leaveGroup(userId: string, groupId: string): Promise<{ success: true; message: string }> {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = this.transformGroupDocument(doc);

        if (!(userId in group.members)) {
            throw Errors.INVALID_INPUT({ message: 'You are not a member of this group' });
        }

        if (group.createdBy === userId) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot leave the group' });
        }

        const memberIds = Object.keys(group.members);
        if (memberIds.length === 1) {
            throw Errors.INVALID_INPUT({ message: 'Cannot leave group - you are the only member' });
        }

        try {
            const groupBalance = await calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const userBalance = currencyBalances[userId];

                if (userBalance && Math.abs(userBalance.netBalance) > 0.01) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot leave group with outstanding balance' });
                }
            }
        } catch (balanceError: unknown) {
            const errorMessage = balanceError instanceof Error ? balanceError.message : String(balanceError);
            const apiErrorDetails = (balanceError as any)?.details?.message || '';

            if (errorMessage.includes('Cannot leave group with outstanding balance') || apiErrorDetails.includes('Cannot leave group with outstanding balance')) {
                throw balanceError;
            }
        }

        const updatedMembers = { ...group.members };
        delete updatedMembers[userId];

        await docRef.update({
            'data.members': updatedMembers,
            updatedAt: FieldValue.serverTimestamp(),
        });

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-left', { id: userId, groupId });

        return {
            success: true,
            message: 'Successfully left the group',
        };
    }

    async removeGroupMember(userId: string, groupId: string, memberId: string): Promise<{ success: true; message: string }> {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        if (!memberId) {
            throw Errors.MISSING_FIELD('memberId');
        }

        const docRef = firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = this.transformGroupDocument(doc);

        if (group.createdBy !== userId) {
            throw Errors.FORBIDDEN();
        }

        if (!(memberId in group.members)) {
            throw Errors.INVALID_INPUT({ message: 'User is not a member of this group' });
        }

        if (memberId === group.createdBy) {
            throw Errors.INVALID_INPUT({ message: 'Group creator cannot be removed' });
        }

        try {
            const groupBalance = await calculateGroupBalances(groupId);
            const balancesByCurrency = groupBalance.balancesByCurrency;

            for (const currency in balancesByCurrency) {
                const currencyBalances = balancesByCurrency[currency];
                const memberBalance = currencyBalances[memberId];

                if (memberBalance && Math.abs(memberBalance.netBalance) > 0.01) {
                    throw Errors.INVALID_INPUT({ message: 'Cannot remove member with outstanding balance' });
                }
            }
        } catch (balanceError: unknown) {
            const errorMessage = balanceError instanceof Error ? balanceError.message : String(balanceError);
            const apiErrorDetails = (balanceError as any)?.details?.message || '';

            if (errorMessage.includes('Cannot remove member with outstanding balance') || apiErrorDetails.includes('Cannot remove member with outstanding balance')) {
                throw balanceError;
            }
        }

        const updatedMembers = { ...group.members };
        delete updatedMembers[memberId];

        await docRef.update({
            'data.members': updatedMembers,
            updatedAt: FieldValue.serverTimestamp(),
        });

        LoggerContext.setBusinessContext({ groupId });
        logger.info('member-removed', { id: memberId, groupId });

        return {
            success: true,
            message: 'Member removed successfully',
        };
    }
}