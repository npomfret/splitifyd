import { z } from 'zod';
import * as admin from 'firebase-admin';
import { validateFirestoreDocument, validateBeforeWrite } from '../schemas';
import { getValidationMetrics } from '../schemas';
import { ContextualLogger } from '../utils/contextual-logger';
import { LoggerContext } from '../utils/logger-context';
import { logger } from '../logger';

/**
 * Centralized Firestore validation service for consistent schema enforcement across all services
 *
 * This service provides a unified interface for all Firestore document validation:
 * - Consistent validation patterns across all services
 * - Performance monitoring for validation operations
 * - Enhanced error reporting with business context
 * - Fail-fast validation to catch data integrity issues early
 *
 * Following the established incremental pattern, this service centralizes existing
 * validation infrastructure without disrupting current functionality.
 */
export class FirestoreValidationService {
    private static instance: FirestoreValidationService;
    private logger: ContextualLogger;

    private constructor() {
        this.logger = logger;
    }

    /**
     * Get singleton instance of the validation service
     */
    static getInstance(): FirestoreValidationService {
        if (!FirestoreValidationService.instance) {
            FirestoreValidationService.instance = new FirestoreValidationService();
        }
        return FirestoreValidationService.instance;
    }

    /**
     * Validate a single Firestore document after reading with performance monitoring
     *
     * @param schema - Zod schema to validate against
     * @param doc - Firestore document snapshot
     * @param schemaName - Name of schema for monitoring
     * @param context - Additional context for logging and monitoring
     */
    validateDocument<T extends z.ZodSchema>(
        schema: T,
        doc: admin.firestore.DocumentSnapshot,
        schemaName: string,
        context: {
            userId?: string;
            operation?: string;
            additionalContext?: Record<string, any>;
        } = {},
    ): z.infer<T> {
        // Set business context for logging
        LoggerContext.update({
            documentId: doc.id,
            collection: doc.ref.parent.id,
            operation: context.operation || 'read',
        });

        if (context.userId) {
            LoggerContext.update({ userId: context.userId });
        }

        return validateFirestoreDocument(schema, doc, schemaName, this.logger);
    }

    /**
     * Validate data before writing to Firestore with performance monitoring
     *
     * @param schema - Zod schema to validate against
     * @param data - Data to validate
     * @param schemaName - Name of schema for monitoring
     * @param context - Validation and business context
     */
    validateBeforeWrite<T extends z.ZodSchema>(
        schema: T,
        data: unknown,
        schemaName: string,
        context: {
            documentId?: string;
            collection?: string;
            userId?: string;
            operation?: string;
            additionalContext?: Record<string, any>;
        } = {},
    ): z.infer<T> {
        // Set business context for logging
        LoggerContext.update({
            operation: context.operation || 'write',
            documentId: context.documentId,
            collection: context.collection,
        });

        if (context.userId) {
            LoggerContext.update({ userId: context.userId });
        }

        return validateBeforeWrite(schema, data, schemaName, {
            documentId: context.documentId,
            collection: context.collection,
            userId: context.userId,
            logger: this.logger,
        });
    }

    /**
     * Get current validation metrics for monitoring and debugging
     */
    getValidationMetrics() {
        return getValidationMetrics();
    }
}

/**
 * Get singleton instance of FirestoreValidationService
 *
 * Usage:
 * ```typescript
 * const validationService = getFirestoreValidationService();
 * const userData = validationService.validateDocument(UserDocumentSchema, userDoc, 'UserDocument', { userId });
 * ```
 */
export function getFirestoreValidationService(): FirestoreValidationService {
    return FirestoreValidationService.getInstance();
}
