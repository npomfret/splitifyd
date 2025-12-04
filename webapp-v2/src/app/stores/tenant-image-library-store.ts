import { ApiError } from '@/app/apiClient';
import { logError } from '@/utils/browser-logger.ts';
import type { TenantImageDTO, TenantImageId } from '@billsplit-wl/shared';
import { ReadonlySignal, signal } from '@preact/signals';
import { apiClient } from '../apiClient';

function getErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
        return err.code || err.message || 'An error occurred';
    }
    if (err instanceof Error) {
        return err.message || 'An error occurred';
    }
    return 'An error occurred';
}

interface TenantImageLibraryStore {
    readonly images: TenantImageDTO[];
    readonly loading: boolean;
    readonly error: string | null;

    readonly imagesSignal: ReadonlySignal<TenantImageDTO[]>;
    readonly loadingSignal: ReadonlySignal<boolean>;
    readonly errorSignal: ReadonlySignal<string | null>;

    loadImages(tenantId: string): Promise<void>;
    uploadImage(tenantId: string, name: string, file: File): Promise<TenantImageDTO>;
    renameImage(tenantId: string, imageId: TenantImageId, name: string): Promise<void>;
    deleteImage(tenantId: string, imageId: TenantImageId): Promise<void>;
    reset(): void;
}

export class TenantImageLibraryStoreImpl implements TenantImageLibraryStore {
    readonly #imagesSignal = signal<TenantImageDTO[]>([]);
    readonly #loadingSignal = signal<boolean>(false);
    readonly #errorSignal = signal<string | null>(null);

    private currentTenantId: string | null = null;

    get images() {
        return this.#imagesSignal.value;
    }

    get loading() {
        return this.#loadingSignal.value;
    }

    get error() {
        return this.#errorSignal.value;
    }

    get imagesSignal(): ReadonlySignal<TenantImageDTO[]> {
        return this.#imagesSignal;
    }

    get loadingSignal(): ReadonlySignal<boolean> {
        return this.#loadingSignal;
    }

    get errorSignal(): ReadonlySignal<string | null> {
        return this.#errorSignal;
    }

    async loadImages(tenantId: string): Promise<void> {
        if (this.#loadingSignal.value) return;

        this.#loadingSignal.value = true;
        this.#errorSignal.value = null;

        try {
            const response = await apiClient.listTenantImages(tenantId);
            this.#imagesSignal.value = response.images;
            this.currentTenantId = tenantId;
        } catch (err: unknown) {
            logError('Failed to load tenant images', { tenantId, error: err });
            this.#errorSignal.value = getErrorMessage(err);
        } finally {
            this.#loadingSignal.value = false;
        }
    }

    async uploadImage(tenantId: string, name: string, file: File): Promise<TenantImageDTO> {
        this.#errorSignal.value = null;

        try {
            const response = await apiClient.uploadTenantLibraryImage(
                tenantId,
                name,
                file,
                file.type,
            );

            // Add to the beginning of the list (most recent first)
            this.#imagesSignal.value = [response.image, ...this.#imagesSignal.value];

            return response.image;
        } catch (err: unknown) {
            logError('Failed to upload tenant image', { tenantId, name, error: err });
            this.#errorSignal.value = getErrorMessage(err);
            throw err;
        }
    }

    async renameImage(tenantId: string, imageId: TenantImageId, name: string): Promise<void> {
        this.#errorSignal.value = null;

        try {
            await apiClient.renameTenantImage(tenantId, imageId, { name });

            // Update the image in the local list
            this.#imagesSignal.value = this.#imagesSignal.value.map((img) =>
                img.id === imageId ? { ...img, name } : img,
            );
        } catch (err: unknown) {
            logError('Failed to rename tenant image', { tenantId, imageId, name, error: err });
            this.#errorSignal.value = getErrorMessage(err);
            throw err;
        }
    }

    async deleteImage(tenantId: string, imageId: TenantImageId): Promise<void> {
        this.#errorSignal.value = null;

        try {
            await apiClient.deleteTenantImage(tenantId, imageId);

            // Remove from the local list
            this.#imagesSignal.value = this.#imagesSignal.value.filter((img) => img.id !== imageId);
        } catch (err: unknown) {
            logError('Failed to delete tenant image', { tenantId, imageId, error: err });
            this.#errorSignal.value = getErrorMessage(err);
            throw err;
        }
    }

    reset(): void {
        this.#imagesSignal.value = [];
        this.#loadingSignal.value = false;
        this.#errorSignal.value = null;
        this.currentTenantId = null;
    }
}

export const tenantImageLibraryStore = new TenantImageLibraryStoreImpl();
