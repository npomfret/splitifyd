import * as Joi from 'joi';
import { Errors } from '../utils/errors';
import { CONFIG } from '../config/constants';

/**
 * Document structure
 */
export interface Document {
  id?: string;
  userId: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create document request body
 */
export interface CreateDocumentRequest {
  data: any;
}

/**
 * Update document request body
 */
export interface UpdateDocumentRequest {
  data: any;
}


/**
 * Calculate size of JSON object in bytes
 */
const getJsonSize = (obj: any): number => {
  return new Blob([JSON.stringify(obj)]).size;
};

/**
 * Schema for document data validation
 */
const documentDataSchema = Joi.any().required();

/**
 * Schema for create document request
 */
const createDocumentSchema = Joi.object({
  data: documentDataSchema,
}).required();

/**
 * Schema for update document request
 */
const updateDocumentSchema = Joi.object({
  data: documentDataSchema,
}).required();

/**
 * Validate create document request
 */
export const validateCreateDocument = (body: any): CreateDocumentRequest => {
  const { error, value } = createDocumentSchema.validate(body);
  
  if (error) {
    throw Errors.INVALID_INPUT(error.details);
  }
  
  // Check document size
  if (getJsonSize(value.data) > CONFIG.DOCUMENT.MAX_SIZE_BYTES) {
    throw Errors.DOCUMENT_TOO_LARGE();
  }
  
  return value as CreateDocumentRequest;
};

/**
 * Validate update document request
 */
export const validateUpdateDocument = (body: any): UpdateDocumentRequest => {
  const { error, value } = updateDocumentSchema.validate(body);
  
  if (error) {
    throw Errors.INVALID_INPUT(error.details);
  }
  
  // Check document size
  if (getJsonSize(value.data) > CONFIG.DOCUMENT.MAX_SIZE_BYTES) {
    throw Errors.DOCUMENT_TOO_LARGE();
  }
  
  return value as UpdateDocumentRequest;
};

/**
 * Validate document ID
 */
export const validateDocumentId = (id: any): string => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw Errors.MISSING_FIELD('document ID');
  }
  
  return id.trim();
};

/**
 * Sanitize document data for safe storage
 * Removes any potentially dangerous properties
 */
export const sanitizeDocumentData = (data: any): any => {
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remove any properties that start with underscore (internal use)
  const removeInternalProps = (obj: any): void => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key.startsWith('_')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removeInternalProps(obj[key]);
        }
      }
    }
  };
  
  removeInternalProps(sanitized);
  
  return sanitized;
};

/**
 * Create a document preview (first 100 characters of JSON)
 */
export const createDocumentPreview = (data: any): string => {
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= CONFIG.DOCUMENT.PREVIEW_LENGTH) {
    return jsonString;
  }
  return jsonString.substring(0, CONFIG.DOCUMENT.PREVIEW_LENGTH - 3) + '...';
};