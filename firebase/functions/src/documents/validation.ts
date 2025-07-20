import * as Joi from 'joi';
import * as admin from 'firebase-admin';
import { Errors } from '../utils/errors';
import { getConfig } from '../config';
import { sanitizeString, isDangerousProperty } from '../utils/security';
import { VALIDATION_LIMITS } from '../constants';
import { Member } from '../types/webapp-shared-types';

/**
 * Document structure
 */
export interface Document {
  id?: string;
  userId: string;
  data: any; // Intentional: Flexible storage for various document types (groups, expenses, etc.)
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Group member structure - use shared types
 */
export type GroupMember = Member;

/**
 * Group data structure (stored in document.data)
 */
export interface GroupData {
  name: string;
  description?: string;
  memberEmails: string[];
  members: GroupMember[];
  yourBalance: number;
  expenseCount: number;
  lastExpenseTime: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create document request body
 */
export interface CreateDocumentRequest {
  data: any; // Intentional: Accepts any valid JSON data structure for flexible document creation
}

/**
 * Update document request body
 */
export interface UpdateDocumentRequest {
  data: any; // Intentional: Accepts any valid JSON data structure for flexible document updates
}


/**
 * Calculate size of JSON object in bytes
 */
const getJsonSize = (obj: unknown): number => {
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
    Joi.string().max(VALIDATION_LIMITS.MAX_STRING_LENGTH).allow(''),           // Strings up to 50KB, empty allowed
    Joi.number(),                      // Any number
    Joi.boolean(),                     // Booleans
    Joi.date(),                        // Dates
    Joi.array().items(                 // Arrays
      Joi.alternatives().try(
        Joi.string().max(VALIDATION_LIMITS.MAX_ARRAY_STRING_LENGTH).allow(''),
        Joi.number(),
        Joi.boolean(),
        Joi.date(),
        Joi.object().max(VALIDATION_LIMITS.MAX_NESTED_OBJECT_DEPTH)           // Nested objects (limited depth)
      )
    ).max(VALIDATION_LIMITS.MAX_ARRAY_ITEMS),                       // Max 1000 array items
    Joi.object().pattern(              // Nested objects
      Joi.string().max(VALIDATION_LIMITS.MAX_NESTED_PROPERTY_NAME_LENGTH),
      Joi.alternatives().try(
        Joi.string().max(VALIDATION_LIMITS.MAX_NESTED_STRING_LENGTH).allow(''),
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

const validateDocumentRequest = (body: unknown, schema: Joi.ObjectSchema): { data: any } => { // Intentional: Returns validated data of any shape
  const { error, value } = schema.validate(body);
  
  if (error) {
    throw Errors.INVALID_INPUT(error.details);
  }
  
  if (getJsonSize(value.data) > getConfig().validation.maxRequestSizeBytes) {
    throw Errors.DOCUMENT_TOO_LARGE();
  }
  
  return value;
};

export const validateCreateDocument = (body: unknown): CreateDocumentRequest => {
  return validateDocumentRequest(body, createDocumentSchema) as CreateDocumentRequest;
};

export const validateUpdateDocument = (body: unknown): UpdateDocumentRequest => {
  return validateDocumentRequest(body, updateDocumentSchema) as UpdateDocumentRequest;
};

/**
 * Validate document ID
 */
export const validateDocumentId = (id: unknown): string => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw Errors.MISSING_FIELD('document ID');
  }
  
  return id.trim();
};

/**
 * Sanitize document data for safe storage
 * Removes dangerous properties and validates structure depth
 * @param data - Input data to sanitize
 * @returns Sanitized data with dangerous properties removed (any type for flexible storage)
 */
export const sanitizeDocumentData = (data: unknown): any => { // Intentional: Returns sanitized data of any shape for flexible document storage
  // Validate maximum depth to prevent stack overflow
  const validateDepth = (obj: unknown, depth = 0, maxDepth = VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH): void => {
    if (depth > maxDepth) {
      throw Errors.INVALID_INPUT(`Document structure too deep (max ${VALIDATION_LIMITS.MAX_DOCUMENT_DEPTH} levels)`);
    }
    
    if (obj && typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      for (const key in record) {
        if (typeof record[key] === 'object' && record[key] !== null) {
          validateDepth(record[key], depth + 1, maxDepth);
        }
      }
    }
  };
  
  validateDepth(data);
  
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  // Remove dangerous properties and patterns
  const sanitizeObject = (obj: unknown): void => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const record = obj as Record<string, unknown>;
      for (const key in record) {
        if (isDangerousProperty(key)) {
          delete record[key];
        } else if (typeof record[key] === 'string') {
          record[key] = sanitizeString(record[key] as string);
        } else if (typeof record[key] === 'object' && record[key] !== null) {
          sanitizeObject(record[key]);
        }
      }
    } else if (Array.isArray(obj)) {
      const array = obj as unknown[];
      array.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          sanitizeObject(item);
        } else if (typeof item === 'string') {
          array[index] = sanitizeString(item);
        }
      });
    }
  };
  
  sanitizeObject(sanitized);
  
  return sanitized;
};