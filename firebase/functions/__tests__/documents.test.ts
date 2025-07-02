import { Response } from 'express';
import { AuthenticatedRequest } from '../src/auth/middleware';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments
} from '../src/documents/handlers';

// Mock Firestore
const mockDoc = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: () => ({
      doc: mockDoc,
      where: mockWhere
    })
  })
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
      orderBy: mockOrderBy
    });
    mockOrderBy.mockReturnValue({
      limit: mockLimit
    });
    mockLimit.mockReturnValue({
      get: mockGet
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
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
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

      await createDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should reject invalid document data', async () => {
      mockRequest.body = {}; // Missing data field

      await createDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should reject documents exceeding size limit', async () => {
      // Create a large object that exceeds 1MB
      const largeData = {
        data: 'x'.repeat(1024 * 1024 + 1) // Just over 1MB
      };
      mockRequest.body = { data: largeData };

      await createDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'DOCUMENT_TOO_LARGE'
          })
        })
      );
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('getDocument', () => {
    it('should retrieve a document successfully', async () => {
      mockRequest.query = { id: 'doc123' };
      
      const mockDocument = {
        userId: 'user123',
        data: { test: 'data' },
        createdAt: new Date(),
        updatedAt: new Date()
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
        createdAt: mockDocument.createdAt,
        updatedAt: mockDocument.updatedAt
      });
    });

    it('should return 404 for non-existent documents', async () => {
      mockRequest.query = { id: 'nonexistent' };
      
      mockGet.mockResolvedValue({
        exists: false
      });

      await getDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should prevent access to documents owned by other users', async () => {
      mockRequest.query = { id: 'doc123' };
      
      const mockDocument = {
        userId: 'otheruser',
        data: { test: 'data' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockDocument
      });

      await getDocument(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateDocument', () => {
    it('should update a document successfully', async () => {
      mockRequest.query = { id: 'doc123' };
      mockRequest.body = { data: { updated: 'data' } };
      
      const mockDocument = {
        userId: 'user123',
        data: { old: 'data' },
        createdAt: new Date(),
        updatedAt: new Date()
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
        updatedAt: expect.any(Date)
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
        createdAt: new Date(),
        updatedAt: new Date()
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
            createdAt: new Date(),
            updatedAt: new Date()
          })
        },
        {
          id: 'doc2',
          data: () => ({
            userId: 'user123',
            data: { test: 'data2' },
            createdAt: new Date(),
            updatedAt: new Date()
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

      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user123');
      expect(mockOrderBy).toHaveBeenCalledWith('updatedAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(mockResponse.json).toHaveBeenCalledWith({
        documents: expect.arrayContaining([
          expect.objectContaining({
            id: 'doc1',
            preview: expect.any(String)
          }),
          expect.objectContaining({
            id: 'doc2',
            preview: expect.any(String)
          })
        ]),
        count: 2
      });
    });
  });
});