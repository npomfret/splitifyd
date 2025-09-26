import { z } from 'zod';
import { validateBeforeWrite } from '../schemas';
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
            uid?: string;
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

        if (context.uid) {
            LoggerContext.update({ uid: context.uid });
        }

        return validateBeforeWrite(schema, data, schemaName, {
            documentId: context.documentId,
            collection: context.collection,
            uid: context.uid,
            logger: this.logger,
        });
    }
}
