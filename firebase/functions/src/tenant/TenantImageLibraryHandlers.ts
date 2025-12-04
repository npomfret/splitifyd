import type { ListTenantImagesResponse, UploadTenantLibraryImageResponse } from '@billsplit-wl/shared';
import { toTenantId, toUserId } from '@billsplit-wl/shared';
import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import { RenameTenantImageRequestSchema, TenantImageParamsSchema, UploadTenantLibraryImageRequestSchema } from '../schemas/tenant';
import type { ITenantImageLibraryService } from '../services/tenant/TenantImageLibraryService';
import { validateImage } from '../utils/validation/imageValidation';

export class TenantImageLibraryHandlers {
    constructor(private readonly tenantImageLibraryService: ITenantImageLibraryService) {}

    listImages: RequestHandler = async (req, res) => {
        const tenantId = toTenantId(req.params.tenantId);

        const images = await this.tenantImageLibraryService.listImages(tenantId);

        const response: ListTenantImagesResponse = { images };
        res.status(HTTP_STATUS.OK).json(response);
    };

    uploadImage: RequestHandler = async (req, res) => {
        const tenantId = toTenantId(req.params.tenantId);
        const userId = toUserId((req as AuthenticatedRequest).user!.uid);

        // Get name from query param (since body is binary)
        const nameParam = req.query.name;
        if (!nameParam || typeof nameParam !== 'string') {
            throw Errors.validationError('name', ErrorDetail.MISSING_FIELD);
        }

        const parseResult = UploadTenantLibraryImageRequestSchema.safeParse({ name: nameParam });
        if (!parseResult.success) {
            throw Errors.validationError('name', ErrorDetail.MISSING_FIELD);
        }
        const { name } = parseResult.data;

        // Validate request has file data
        if (!req.body || req.body.length === 0) {
            throw Errors.invalidRequest(ErrorDetail.MISSING_FILE);
        }

        const contentType = req.headers['content-type'];
        const buffer = req.body as Buffer;

        // Validate image (general image validation - accepts any supported format)
        validateImage(buffer, contentType);

        const image = await this.tenantImageLibraryService.uploadImage(tenantId, name, buffer, contentType!, userId);

        const response: UploadTenantLibraryImageResponse = { image };
        res.status(HTTP_STATUS.CREATED).json(response);
    };

    renameImage: RequestHandler = async (req, res) => {
        const paramsResult = TenantImageParamsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            throw Errors.validationError('params', ErrorDetail.MISSING_FIELD);
        }
        const { tenantId, imageId } = paramsResult.data;

        const parseResult = RenameTenantImageRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            throw Errors.validationError('name', ErrorDetail.MISSING_FIELD);
        }
        const { name } = parseResult.data;

        await this.tenantImageLibraryService.renameImage(tenantId, imageId, name);

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    deleteImage: RequestHandler = async (req, res) => {
        const paramsResult = TenantImageParamsSchema.safeParse(req.params);
        if (!paramsResult.success) {
            throw Errors.validationError('params', ErrorDetail.MISSING_FIELD);
        }
        const { tenantId, imageId } = paramsResult.data;

        await this.tenantImageLibraryService.deleteImage(tenantId, imageId);

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };
}
