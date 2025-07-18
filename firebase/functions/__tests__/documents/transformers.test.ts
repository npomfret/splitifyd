import * as admin from 'firebase-admin';
import { transformDocumentForApi, addGroupBalanceToDocument } from '../../src/documents/transformers';
import { Document } from '../../src/documents/validation';
import { calculateGroupBalances } from '../../src/services/balanceCalculator';

jest.mock('../../src/services/balanceCalculator');

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(),
  })),
  apps: [],
  initializeApp: jest.fn(),
}));

describe('Document Transformers', () => {
  describe('transformDocumentForApi', () => {
    const mockTimestamp = {
      _seconds: 1701432000,
      _nanoseconds: 0,
      toDate: () => new Date('2023-12-01T12:00:00.000Z'),
    } as unknown as admin.firestore.Timestamp;

    const mockDoc = {
      id: 'doc123',
      data: jest.fn(),
    } as unknown as admin.firestore.DocumentSnapshot;

    const validDocData: Document = {
      userId: 'user123',
      data: {
        name: 'Test Document',
        description: 'Test Description',
      },
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };

    it('should transform document with valid timestamps', () => {
      const result = transformDocumentForApi(mockDoc, validDocData);

      expect(result).toEqual({
        id: 'doc123',
        data: {
          name: 'Test Document',
          description: 'Test Description',
        },
        createdAt: '2023-12-01T12:00:00.000Z',
        updatedAt: '2023-12-01T12:00:00.000Z',
      });
    });

    it('should throw error if createdAt is missing', () => {
      const invalidData = { ...validDocData, createdAt: undefined };

      expect(() => transformDocumentForApi(mockDoc, invalidData as unknown as Document))
        .toThrow('Expected createdAt to be Firestore Timestamp');
    });

    it('should throw error if createdAt is not a Timestamp object', () => {
      const invalidData = { ...validDocData, createdAt: '2023-12-01' };

      expect(() => transformDocumentForApi(mockDoc, invalidData as any))
        .toThrow('Expected createdAt to be Firestore Timestamp, got string');
    });

    it('should throw error if createdAt lacks _seconds property', () => {
      const invalidData = { ...validDocData, createdAt: { toDate: () => new Date() } };

      expect(() => transformDocumentForApi(mockDoc, invalidData as any))
        .toThrow('Expected createdAt to be Firestore Timestamp');
    });

    it('should throw error if updatedAt is missing', () => {
      const invalidData = { ...validDocData, updatedAt: undefined };

      expect(() => transformDocumentForApi(mockDoc, invalidData as unknown as Document))
        .toThrow('Expected updatedAt to be Firestore Timestamp');
    });

    it('should throw error if updatedAt is not a Timestamp object', () => {
      const invalidData = { ...validDocData, updatedAt: new Date() };

      expect(() => transformDocumentForApi(mockDoc, invalidData as any))
        .toThrow('Expected updatedAt to be Firestore Timestamp, got object');
    });

    it('should handle group documents with members', () => {
      const groupDocData: Document = {
        ...validDocData,
        data: {
          name: 'Test Group',
          members: [
            { uid: 'user1', name: 'User 1' },
            { uid: 'user2', name: 'User 2' },
          ],
        },
      };

      const result = transformDocumentForApi(mockDoc, groupDocData);

      expect(result.data.members).toEqual([
        { uid: 'user1', name: 'User 1' },
        { uid: 'user2', name: 'User 2' },
      ]);
    });
  });

  describe('addGroupBalanceToDocument', () => {
    const mockGet = jest.fn();
    const mockSet = jest.fn();
    const mockDoc = jest.fn();
    const mockCollection = jest.fn();
    const mockCalculateGroupBalances = calculateGroupBalances as jest.MockedFunction<typeof calculateGroupBalances>;

    beforeEach(() => {
      jest.clearAllMocks();
      mockDoc.mockReturnValue({
        get: mockGet,
        set: mockSet,
      });
      mockCollection.mockReturnValue({
        doc: mockDoc,
      });
      (admin.firestore as unknown as jest.Mock).mockReturnValue({
        collection: mockCollection,
      });
    });

    const createApiDocument = (overrides = {}): any => ({
      id: 'doc123',
      data: {
        name: 'Test Group',
        members: [
          { uid: 'user1', name: 'User 1' },
          { uid: 'user2', name: 'User 2' },
        ],
        ...overrides,
      },
      createdAt: '2023-12-01T12:00:00.000Z',
      updatedAt: '2023-12-01T12:00:00.000Z',
    });

    const createDocumentData = (overrides = {}): Document => ({
      userId: 'user123',
      data: {
        name: 'Test Group',
        members: [
          { uid: 'user1', name: 'User 1' },
          { uid: 'user2', name: 'User 2' },
        ],
        ...overrides,
      },
      createdAt: {} as admin.firestore.Timestamp,
      updatedAt: {} as admin.firestore.Timestamp,
    });

    it('should return document unchanged for non-group documents', async () => {
      const document = createApiDocument({ name: undefined, members: undefined });
      const docData = createDocumentData({ name: undefined, members: undefined });

      const result = await addGroupBalanceToDocument(document, docData, 'user1');

      expect(result).toBe(document);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should use cached balance when available', async () => {
      const document = createApiDocument();
      const docData = createDocumentData();
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          userBalances: {
            user1: { netBalance: 50.25 },
          },
        }),
      });

      const result = await addGroupBalanceToDocument(document, docData, 'user1');

      expect(result.data.yourBalance).toBe(50.25);
      expect(mockCalculateGroupBalances).not.toHaveBeenCalled();
    });

    it('should calculate and cache balance when not cached', async () => {
      const document = createApiDocument();
      const docData = createDocumentData();
      
      mockGet.mockResolvedValue({ exists: false });
      mockCalculateGroupBalances.mockResolvedValue({
        userBalances: {
          user1: { netBalance: 75.50, owes: {}, owed: {} },
        },
      } as any);

      const result = await addGroupBalanceToDocument(document, docData, 'user1');

      expect(result.data.yourBalance).toBe(75.50);
      expect(mockCalculateGroupBalances).toHaveBeenCalledWith('doc123');
      expect(mockSet).toHaveBeenCalledWith({
        userBalances: {
          user1: { netBalance: 75.50, owes: {}, owed: {} },
        },
      });
    });

    it('should default to 0 balance when user not in cached data', async () => {
      const document = createApiDocument();
      const docData = createDocumentData();
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          userBalances: {
            user2: { netBalance: 50 },
          },
        }),
      });

      const result = await addGroupBalanceToDocument(document, docData, 'user1');

      expect(result.data.yourBalance).toBe(0);
    });

    it('should default to 0 on calculation error', async () => {
      const document = createApiDocument();
      const docData = createDocumentData();
      
      mockGet.mockResolvedValue({ exists: false });
      mockCalculateGroupBalances.mockRejectedValue(new Error('No members'));

      const result = await addGroupBalanceToDocument(document, docData, 'user1');

      expect(result.data.yourBalance).toBe(0);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });
});