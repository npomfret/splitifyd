import { computed, type ReadonlySignal, signal } from '@preact/signals';
import { ApiError } from '../../apiClient';

const VALIDATION_STATUS_CODE = 400;
const VALIDATION_CODE_PREFIX = 'VALIDATION_';

export class GroupsErrorManager {
    readonly #validationErrorSignal = signal<string | null>(null);
    readonly #networkErrorSignal = signal<string | null>(null);
    readonly errorSignal: ReadonlySignal<string | null> = computed(() => this.#validationErrorSignal.value || this.#networkErrorSignal.value);

    get validationError(): string | null {
        return this.#validationErrorSignal.value;
    }

    get networkError(): string | null {
        return this.#networkErrorSignal.value;
    }

    get combinedError(): string | null {
        return this.errorSignal.value;
    }

    setValidationError(message: string | null): void {
        this.#validationErrorSignal.value = message;
    }

    setNetworkError(message: string | null): void {
        this.#networkErrorSignal.value = message;
    }

    clearValidationError(): void {
        this.#validationErrorSignal.value = null;
    }

    clearNetworkError(): void {
        this.#networkErrorSignal.value = null;
    }

    clearAll(): void {
        this.clearValidationError();
        this.clearNetworkError();
    }

    handleApiError(error: unknown): string {
        const message = this.getErrorMessage(error);

        if (error instanceof ApiError && this.#isValidationError(error)) {
            this.#validationErrorSignal.value = message;
        } else {
            this.#networkErrorSignal.value = message;
        }

        return message;
    }

    getErrorMessage(error: unknown): string {
        if (error instanceof ApiError) {
            return error.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return 'An unexpected error occurred';
    }

    #isValidationError(error: ApiError): boolean {
        if (error.code && error.code.startsWith(VALIDATION_CODE_PREFIX)) {
            return true;
        }
        return error.requestContext?.status === VALIDATION_STATUS_CODE;
    }
}
