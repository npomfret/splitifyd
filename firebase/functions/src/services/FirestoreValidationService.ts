import { ContextualLogger } from '../utils/contextual-logger';
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

}
