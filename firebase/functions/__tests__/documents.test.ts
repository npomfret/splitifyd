import { Response } from 'express';
import { AuthenticatedRequest } from '../src/auth/middleware';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments
} from '../src/documents/handlers';
import { ApiError } from '../src/utils/errors';

// Mock logger
jest.mock('../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    errorWithContext: jest.fn()
  }
}));

// Mock Firebase Admin
const mockDoc = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockWhere = jest.fn();
const mockSelect = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockTimestamp = { 
  _seconds: 1672531200, // 2023-01-01T00:00:00Z
  _nanoseconds: 0,
  toDate: () => new Date('2023-01-01T00:00:00Z') 
};

// Mock for expenses collection
const mockExpensesWhere = jest.fn();
const mockExpensesGet = jest.fn();

jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: (name: string) => {
      if (name === 'expenses') {
        return {
          where: mockExpensesWhere
        };
      }
      return {
        doc: mockDoc,
        where: mockWhere
      };
    }
  })
}));

// Mock validation functions
jest.mock('../src/documents/validation', () => ({
  validateCreateDocument: jest.fn((body) => {
    if (!body.data) {
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid input data');
    }
    return { data: body.data };
  }),
  validateUpdateDocument: jest.fn((body) => {
    if (!body.data) {
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid input data');
    }
    return { data: body.data };
  }),
  validateDocumentId: jest.fn((id) => {
    if (!id) {
      throw new ApiError(400, 'INVALID_INPUT', 'Invalid document ID');
    }
    return id;
  }),
  sanitizeDocumentData: jest.fn((data) => data)
}));

describe('Document Handlers', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      user: {
        uid: 'user123',
        email: 'test@example.com'
      },
      body: {},
      query: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();
    mockDoc.mockReturnValue({
      id: 'doc123',
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete
    });
    mockWhere.mockReturnValue({
      select: mockSelect
    });
    mockSelect.mockReturnValue({
      orderBy: mockOrderBy
    });
    mockOrderBy.mockReturnValue({
      limit: mockLimit
    });
    mockLimit.mockReturnValue({
      get: mockGet
    });
    
    // Setup expenses mock for getGroupExpenseStats
    mockExpensesWhere.mockReturnValue({
      get: mockExpensesGet
    });
    mockExpensesGet.mockResolvedValue({
      empty: true,
      docs: []
    });
  });

  describe('createDocument', () => {
    it('should create a document successfully', async () => {
      mockRequest.body = {
        data: { test: 'data', nested: { value: 123 } }
      };

      await createDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDoc).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'doc123',
          userId: 'user123',
          data: { test: 'data', nested: { value: 123 } },
          createdAt: expect.any(Object),
          updatedAt: expect.any(Object)
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: 'doc123',
        message: 'Document created successfully'
      });
    });

    it('should reject requests without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { data: { test: 'data' } };

      await expect(
        createDocument(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response
        )
      ).rejects.toThrow(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should reject invalid document data', async () => {
      mockRequest.body = {}; // Missing data field

      await expect(
        createDocument(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response
        )
      ).rejects.toThrow(new ApiError(400, 'INVALID_INPUT', 'Invalid input data'));

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('getDocument', () => {
    it('should retrieve a document successfully', async () => {
      mockRequest.query = { id: 'doc123' };
      
      const mockDocument = {
        userId: 'user123',
        data: { test: 'data' },
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp
      };
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockDocument
      });

      await getDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDoc).toHaveBeenCalledWith('doc123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: 'doc123',
        data: mockDocument.data,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      });
    });

    it('should return 404 for non-existent documents', async () => {
      mockRequest.query = { id: 'nonexistent' };
      
      mockGet.mockResolvedValue({
        exists: false
      });

      await expect(
        getDocument(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response
        )
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Document not found'));
    });

    it('should prevent access to documents owned by other users', async () => {
      mockRequest.query = { id: 'doc123' };
      
      const mockDocument = {
        userId: 'otheruser',
        data: { test: 'data' },
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp
      };
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockDocument
      });

      await expect(
        getDocument(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response
        )
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Document not found'));
    });
  });

  describe('updateDocument', () => {
    it('should update a document successfully', async () => {
      mockRequest.query = { id: 'doc123' };
      mockRequest.body = { data: { updated: 'data' } };
      
      const mockDocument = {
        userId: 'user123',
        data: { old: 'data' },
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp
      };
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockDocument
      });

      await updateDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        data: { updated: 'data' },
        updatedAt: expect.any(Object)
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Document updated successfully'
      });
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document successfully', async () => {
      mockRequest.query = { id: 'doc123' };
      
      const mockDocument = {
        userId: 'user123',
        data: { test: 'data' },
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp
      };
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockDocument
      });

      await deleteDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockDelete).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Document deleted successfully'
      });
    });
  });

  describe('listDocuments', () => {
    it('should list user documents successfully', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          data: () => ({
            userId: 'user123',
            data: { test: 'data1' },
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp
          })
        },
        {
          id: 'doc2',
          data: () => ({
            userId: 'user123',
            data: { test: 'data2' },
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp
          })
        }
      ];

      mockGet.mockResolvedValue({
        docs: mockDocuments
      });

      await listDocuments(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockWhere).toHaveBeenCalledWith('data.memberIds', 'array-contains', 'user123');
      expect(mockOrderBy).toHaveBeenCalledWith('updatedAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(101); // 100 + 1 for pagination check
      expect(mockResponse.json).toHaveBeenCalledWith({
        documents: expect.arrayContaining([
          expect.objectContaining({
            id: 'doc1',
            data: { test: 'data1' },
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          }),
          expect.objectContaining({
            id: 'doc2',
            data: { test: 'data2' },
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          })
        ]),
        count: 2,
        hasMore: false,
        nextCursor: undefined,
        pagination: {
          limit: 100,
          order: 'desc',
          totalReturned: 2
        }
      });
    });
  });
});