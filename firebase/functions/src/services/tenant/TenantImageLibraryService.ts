import type { TenantId, TenantImageDTO, TenantImageId, UserId } from '@billsplit-wl/shared';
import { isoStringNow, toTenantImageId } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../../errors';
import type { IFirestoreReader } from '../firestore/IFirestoreReader';
import type { IFirestoreWriter } from '../firestore/IFirestoreWriter';
import type { TenantAssetStorage } from '../storage/TenantAssetStorage';

export interface ITenantImageLibraryService {
    listImages(tenantId: TenantId): Promise<TenantImageDTO[]>;
    uploadImage(tenantId: TenantId, name: string, buffer: Buffer, contentType: string, uploadedBy: UserId): Promise<TenantImageDTO>;
    renameImage(tenantId: TenantId, imageId: TenantImageId, name: string): Promise<void>;
    deleteImage(tenantId: TenantId, imageId: TenantImageId): Promise<void>;
    getImage(tenantId: TenantId, imageId: TenantImageId): Promise<TenantImageDTO | null>;
}

const MAX_IMAGES_PER_TENANT = 50;

export class TenantImageLibraryService implements ITenantImageLibraryService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly tenantAssetStorage: TenantAssetStorage,
    ) {}

    async listImages(tenantId: TenantId): Promise<TenantImageDTO[]> {
        return this.firestoreReader.getTenantImages(tenantId);
    }

    async uploadImage(tenantId: TenantId, name: string, buffer: Buffer, contentType: string, uploadedBy: UserId): Promise<TenantImageDTO> {
        // Check image limit
        const existingImages = await this.listImages(tenantId);
        if (existingImages.length >= MAX_IMAGES_PER_TENANT) {
            throw Errors.invalidRequest(ErrorDetail.IMAGE_LIBRARY_FULL);
        }

        // Generate document ID for the image
        const imageId = toTenantImageId(this.firestoreWriter.generateDocumentId('tenant-images'));

        // Upload to storage using library path
        const url = await this.tenantAssetStorage.uploadLibraryImage(tenantId, imageId, buffer, contentType);

        // Create image document
        const imageData: TenantImageDTO = {
            id: imageId,
            name: name.trim(),
            url,
            contentType,
            sizeBytes: buffer.length,
            uploadedAt: isoStringNow(),
            uploadedBy,
        };

        await this.firestoreWriter.createTenantImage(tenantId, imageData);

        return imageData;
    }

    async renameImage(tenantId: TenantId, imageId: TenantImageId, name: string): Promise<void> {
        const image = await this.getImage(tenantId, imageId);
        if (!image) {
            throw Errors.notFound('Image', ErrorDetail.IMAGE_NOT_FOUND);
        }

        await this.firestoreWriter.updateTenantImage(tenantId, imageId, { name: name.trim() });
    }

    async deleteImage(tenantId: TenantId, imageId: TenantImageId): Promise<void> {
        const image = await this.getImage(tenantId, imageId);
        if (!image) {
            throw Errors.notFound('Image', ErrorDetail.IMAGE_NOT_FOUND);
        }

        // Delete from storage
        await this.tenantAssetStorage.deleteAsset(image.url);

        // Delete from Firestore
        await this.firestoreWriter.deleteTenantImage(tenantId, imageId);
    }

    async getImage(tenantId: TenantId, imageId: TenantImageId): Promise<TenantImageDTO | null> {
        return this.firestoreReader.getTenantImage(tenantId, imageId);
    }
}
