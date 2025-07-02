import * as Joi from 'joi';
import { Errors } from '../utils/errors';
import { CONFIG } from '../config';
import { sanitizeString, isDangerousProperty } from '../utils/security';
import { VALIDATION_LIMITS, DOCUMENT_CONFIG } from '../constants';

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
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
};

/**
 * Schema for document data validation - flexible but safe schema
 * Allows arbitrary JSON structure with security limits
 */
const documentDataSchema = Joi.object().pattern(
  // Allow any property name (with reasonable length limit)
  Joi.string().max(VALIDATION_LIMITS.MAX_PROPERTY_NAME_LENGTH),
  // Allow various data types with security limits
  Joi.alternatives().try(
    Joi.string().max(VALIDATION_LIMITS.MAX_STRING_LENGTH),           // Strings up to 50KB
    Joi.number(),                      // Any number
    Joi.boolean(),                     // Booleans
    Joi.date(),                        // Dates
    Joi.array().items(                 // Arrays
      Joi.alternatives().try(
        Joi.string().max(VALIDATION_LIMITS.MAX_ARRAY_STRING_LENGTH),
        Joi.number(),
        Joi.boolean(),
        Joi.date(),
        Joi.object().max(VALIDATION_LIMITS.MAX_NESTED_OBJECT_DEPTH)           // Nested objects (limited depth)
      )
    ).max(VALIDATION_LIMITS.MAX_ARRAY_ITEMS),                       // Max 1000 array items
    Joi.object().pattern(              // Nested objects
      Joi.string().max(VALIDATION_LIMITS.MAX_NESTED_PROPERTY_NAME_LENGTH),
      Joi.alternatives().try(
        Joi.string().max(VALIDATION_LIMITS.MAX_NESTED_STRING_LENGTH),
        Joi.number(),
        Joi.boolean(),
        Joi.date(),
        Joi.array().max(VALIDATION_LIMITS.MAX_NESTED_ARRAY_ITEMS)
      )
    ).max(VALIDATION_LIMITS.MAX_NESTED_OBJECT_PROPERTIES)                         // Max 100 properties in nested objects
  )
).min(1).max(VALIDATION_LIMITS.MAX_ROOT_OBJECT_PROPERTIES).required();         // At least 1 field, max 500 properties

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

const validateDocumentRequest = (body: any, schema: Joi.ObjectSchema): { data: any } => {
  const { error, value } = schema.validate(body);
  
  if (error) {
    throw Errors.INVALID_INPUT(error.details);
  }
  
  if (getJsonSize(value.data) > CONFIG.validation.maxRequestSizeBytes) {
    throw Errors.DOCUMENT_TOO_LARGE();
  }
  
  return value;
};

export const validateCreateDocument = (body: any): CreateDocumentRequest => {
  return validateDocumentRequest(body, createDocumentSchema) as CreateDocumentRequest;
};

export const validateUpdateDocument = (body: any): UpdateDocumentRequest => {
  return validateDocumentRequest(body, updateDocumentSchema) as UpdateDocumentRequest;
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
 * Removes dangerous properties and validates structure depth
 */
export const sanitizeDocumentData = (data: any): any => {
  // Validate maximum depth to prevent stack overflow
  const validateDepth = (obj: any, depth = 0, maxDepth = VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH): void => {
    if (depth > maxDepth) {
      throw Errors.INVALID_INPUT(`Document structure too deep (max ${VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH} levels)`);
    }
    
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          validateDepth(obj[key], depth + 1, maxDepth);
        }
      }
    }
  };
  
  validateDepth(data);
  
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remove dangerous properties and patterns
  const sanitizeObject = (obj: any): void => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const key in obj) {
        if (isDangerousProperty(key)) {
          delete obj[key];
        } else if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          sanitizeObject(item);
        } else if (typeof item === 'string') {
          obj[index] = sanitizeString(item);
        }
      });
    }
  };
  
  sanitizeObject(sanitized);
  
  return sanitized;
};

/**
 * Create a document preview (first 100 characters of JSON)
 */
export const createDocumentPreview = (data: any): string => {
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= DOCUMENT_CONFIG.PREVIEW_LENGTH) {
    return jsonString;
  }
  return jsonString.substring(0, DOCUMENT_CONFIG.PREVIEW_LENGTH - 3) + '...';
};