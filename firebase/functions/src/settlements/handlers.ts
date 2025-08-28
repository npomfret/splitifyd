import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { ApiError } from '../utils/errors';
import { logger, LoggerContext } from '../logger';
import { HTTP_STATUS } from '../constants';
import { createSettlementSchema, updateSettlementSchema, settlementIdSchema, listSettlementsQuerySchema } from './validation';
import {
    CreateSettlementRequest,
    UpdateSettlementRequest,
    CreateSettlementResponse,
    UpdateSettlementResponse,
    DeleteSettlementResponse,
    GetSettlementResponse,
    ListSettlementsApiResponse,
} from '@splitifyd/shared';
import { SettlementService } from '../services/SettlementService';


export const createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        const { error, value } = createSettlementSchema.validate(req.body);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
        }

        const settlementData: CreateSettlementRequest = value;

        const settlementService = new SettlementService();
        const responseData = await settlementService.createSettlement(settlementData, userId);

        LoggerContext.setBusinessContext({ settlementId: responseData.id });
        logger.info('settlement-created', { id: responseData.id });

        const response: CreateSettlementResponse = {
            success: true,
            data: responseData,
        };
        res.status(HTTP_STATUS.CREATED).json(response);
    } catch (error) {
        logger.error('Error creating settlement', error, {
            userId: req.user?.uid,
            groupId: req.body?.groupId,
        });
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            res.status(HTTP_STATUS.INTERNAL_ERROR).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to create settlement',
                },
            });
        }
    }
};

export const updateSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        const { error: idError, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
        if (idError) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', idError.details[0].message);
        }

        const { error, value } = updateSettlementSchema.validate(req.body);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
        }

        const updateData: UpdateSettlementRequest = value;

        const settlementService = new SettlementService();
        const responseData = await settlementService.updateSettlement(settlementId, updateData, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-updated', { id: settlementId });

        const response: UpdateSettlementResponse = {
            success: true,
            data: responseData,
        };
        res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
        logger.error('Error updating settlement', error, {
            settlementId: req.params?.settlementId,
            userId: req.user?.uid,
        });
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            res.status(HTTP_STATUS.INTERNAL_ERROR).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update settlement',
                },
            });
        }
    }
};

export const deleteSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
        }

        const settlementService = new SettlementService();
        await settlementService.deleteSettlement(settlementId, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-deleted', { id: settlementId });

        const response: DeleteSettlementResponse = {
            success: true,
            message: 'Settlement deleted successfully',
        };
        res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
        logger.error('Error deleting settlement', error, {
            settlementId: req.params?.settlementId,
            userId: req.user?.uid,
        });
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            res.status(HTTP_STATUS.INTERNAL_ERROR).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to delete settlement',
                },
            });
        }
    }
};

export const getSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
        }

        const settlementService = new SettlementService();
        const responseData = await settlementService.getSettlement(settlementId, userId);

        const response: GetSettlementResponse = {
            success: true,
            data: responseData,
        };
        res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
        logger.error('Error fetching settlement', error, {
            settlementId: req.params?.settlementId,
            userId: req.user?.uid,
        });
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            res.status(HTTP_STATUS.INTERNAL_ERROR).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch settlement',
                },
            });
        }
    }
};


export const listSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = validateUserAuth(req);

        const { error, value } = listSettlementsQuerySchema.validate(req.query);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
        }

        const { groupId, limit, cursor, userId: filterUserId, startDate, endDate } = value;

        const settlementService = new SettlementService();
        const result = await settlementService.listSettlements(groupId, userId, {
            limit,
            cursor,
            userId: filterUserId,
            startDate,
            endDate,
        });

        const response: ListSettlementsApiResponse = {
            success: true,
            data: result,
        };
        res.status(HTTP_STATUS.OK).json(response);
    } catch (error) {
        logger.error('Error listing settlements', error, {
            groupId: req.query?.groupId,
            userId: req.user?.uid,
        });
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                },
            });
        } else {
            res.status(HTTP_STATUS.INTERNAL_ERROR).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to list settlements',
                },
            });
        }
    }
};
