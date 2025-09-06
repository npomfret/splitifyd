import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import {getFirestore} from '../../../firebase';
import { logger } from '../../../logger';
import { FirestoreCollections } from '@splitifyd/shared';
import { getGroupChangedFields, calculatePriority, createMinimalChangeDocument } from '../../../utils/change-detection';
import { GroupChangeDocumentSchema } from '../../../schemas/change-documents';

// Mock Firebase dependencies
vi.mock('../../../firebase', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn(),
    })),
}));

vi.mock('../../../logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock change detection utilities
vi.mock('../../../utils/change-detection', () => ({
    getGroupChangedFields: vi.fn().mockReturnValue(['name']),
    calculatePriority: vi.fn().mockReturnValue(1),
    createMinimalChangeDocument: vi.fn().mockReturnValue({
        id: 'test-change-id',
        entityId: 'test-group-id',
        entityType: 'group',
        changeType: 'updated',
        affectedUsers: [],
        timestamp: '2024-01-01T00:00:00.000Z',
    }),
}));

// Mock change document schemas
vi.mock('../../../schemas/change-documents', () => ({
    GroupChangeDocumentSchema: {
        parse: vi.fn().mockImplementation((data) => data),
    },
}));

// Extract the core trigger logic for unit testing  
async function processGroupChangeEvent(groupId: string, before: any, after: any, changeType: 'created' | 'updated' | 'deleted') {
    try {
        // Get changed fields (groups use flat structure)
        const changedFields = getGroupChangedFields(before, after);

        // Calculate priority (not currently used)
        calculatePriority(changeType, changedFields, 'group');

        // Get affected users from the group subcollection
        const affectedUsers: string[] = [];
        
        // Since members are now stored in subcollections, we need to query for them
        // For performance, we'll get members from the current state only
        try {
            const membersSnapshot = await getFirestore()
                .collection(FirestoreCollections.GROUPS)
                .doc(groupId)
                .collection('members')
                .get();
            
            membersSnapshot.forEach((memberDoc: any) => {
                affectedUsers.push(memberDoc.id);
            });
        } catch (error) {
            logger.warn('Could not fetch group members for change tracking', { groupId, error });
            // If we can't get members, we still create the change document but with empty users array
            // This ensures change detection still works at the group level
        }

        // Create minimal change document for client notifications
        const changeDoc = createMinimalChangeDocument(groupId, 'group', changeType, affectedUsers);

        // Validate before writing to prevent corrupted documents
        const validatedChangeDoc = GroupChangeDocumentSchema.parse(changeDoc);

        // Write to group-changes collection
        await getFirestore().collection(FirestoreCollections.GROUP_CHANGES).add(validatedChangeDoc);

        logger.info('group-changed', { id: groupId });
    } catch (error) {
        logger.error('Failed to track group change', error as Error, { groupId });
    }
}

describe('Change Tracker Trigger Logic', () => {
    const mockCollection = vi.fn();
    const mockDoc = vi.fn();
    const mockGet = vi.fn();
    const mockAdd = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup Firestore mock chain
        mockCollection.mockReturnValue({
            doc: mockDoc,
            add: mockAdd,
        });
        
        mockDoc.mockReturnValue({
            collection: mockCollection,
        });
        
        (getFirestore().collection as Mock).mockImplementation(mockCollection);
    });

    describe('subcollection member fetching', () => {
        test('should successfully fetch members from subcollection and populate affectedUsers', async () => {
            // Mock successful subcollection query
            const mockMembersSnapshot = {
                forEach: vi.fn().mockImplementation((callback) => {
                    callback({ id: 'user1' });
                    callback({ id: 'user2' });
                    callback({ id: 'user3' });
                }),
            };
            
            mockGet.mockResolvedValue(mockMembersSnapshot);
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUPS) {
                    return { doc: mockDoc };
                } else if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'updated');

            // Verify subcollection query was made correctly
            expect(getFirestore().collection).toHaveBeenCalledWith(FirestoreCollections.GROUPS);
            expect(mockDoc).toHaveBeenCalledWith('test-group-id');
            expect(mockCollection).toHaveBeenCalledWith('members');
            expect(mockGet).toHaveBeenCalled();
            
            // Verify change document was created and added
            expect(mockAdd).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('group-changed', { id: 'test-group-id' });
        });

        test('should handle empty member subcollection gracefully', async () => {
            // Mock empty subcollection
            const mockEmptySnapshot = {
                forEach: vi.fn(), // No members to iterate over
            };
            
            mockGet.mockResolvedValue(mockEmptySnapshot);
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUPS) {
                    return { doc: mockDoc };
                } else if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'updated');

            // Should still create change document even with no members
            expect(mockAdd).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('group-changed', { id: 'test-group-id' });
            expect(logger.warn).not.toHaveBeenCalled();
        });

        test('should continue with empty users array when subcollection query fails', async () => {
            // Mock subcollection query failure
            const subcollectionError = new Error('Firestore subcollection query failed');
            mockGet.mockRejectedValue(subcollectionError);
            
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUPS) {
                    return { doc: mockDoc };
                } else if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'updated');

            // Should log warning about failed member fetch
            expect(logger.warn).toHaveBeenCalledWith(
                'Could not fetch group members for change tracking',
                { groupId: 'test-group-id', error: subcollectionError }
            );
            
            // Should still create change document despite error
            expect(mockAdd).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('group-changed', { id: 'test-group-id' });
        });

        test('should log warnings when member fetch fails', async () => {
            const firestoreError = new Error('Permission denied');
            mockGet.mockRejectedValue(firestoreError);
            
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUPS) {
                    return { doc: mockDoc };
                } else if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { get: mockGet };
            });

            const mockBefore = null;
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'created');

            expect(logger.warn).toHaveBeenCalledWith(
                'Could not fetch group members for change tracking',
                { groupId: 'test-group-id', error: firestoreError }
            );
        });
    });

    describe('change document creation', () => {
        test('should create change document for created group', async () => {
            mockGet.mockResolvedValue({ forEach: vi.fn() });
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { doc: mockDoc, get: mockGet };
            });

            const mockBefore = null;
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'created');

            expect(mockAdd).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('group-changed', { id: 'test-group-id' });
        });

        test('should create change document for updated group', async () => {
            mockGet.mockResolvedValue({ forEach: vi.fn() });
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { doc: mockDoc, get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'updated');

            expect(mockAdd).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('group-changed', { id: 'test-group-id' });
        });

        test('should create change document for deleted group', async () => {
            mockGet.mockResolvedValue({ forEach: vi.fn() });
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { doc: mockDoc, get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = null;
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'deleted');

            expect(mockAdd).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('group-changed', { id: 'test-group-id' });
        });
    });

    describe('error handling', () => {
        test('should handle schema validation errors', async () => {
            mockGet.mockResolvedValue({ forEach: vi.fn() });
            
            // Mock schema validation failure
            (GroupChangeDocumentSchema.parse as Mock).mockImplementation(() => {
                throw new Error('Schema validation failed');
            });
            
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { doc: mockDoc, get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'updated');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to track group change',
                expect.any(Error),
                { groupId: 'test-group-id' }
            );
        });

        test('should handle change document write failures', async () => {
            mockGet.mockResolvedValue({ forEach: vi.fn() });
            mockAdd.mockRejectedValue(new Error('Firestore write failed'));
            
            mockCollection.mockImplementation((collectionName) => {
                if (collectionName === FirestoreCollections.GROUP_CHANGES) {
                    return { add: mockAdd };
                }
                return { doc: mockDoc, get: mockGet };
            });

            const mockBefore = { data: () => ({ name: 'Old Name' }) };
            const mockAfter = { data: () => ({ name: 'New Name' }) };
            
            await processGroupChangeEvent('test-group-id', mockBefore, mockAfter, 'updated');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to track group change',
                expect.any(Error),
                { groupId: 'test-group-id' }
            );
        });
    });
});