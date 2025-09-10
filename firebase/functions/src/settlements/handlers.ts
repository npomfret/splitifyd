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
import { getFirestore } from "../firebase";
import { ApplicationBuilder } from "../services/ApplicationBuilder";

const firestore = getFirestore();
const applicationBuilder = new ApplicationBuilder(firestore);
const settlementService = applicationBuilder.buildSettlementService();

export const createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const { error, value } = createSettlementSchema.validate(req.body);
    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
    }

    const settlementData: CreateSettlementRequest = value;

    const responseData = await settlementService.createSettlement(settlementData, userId);

    LoggerContext.setBusinessContext({ settlementId: responseData.id });
    logger.info('settlement-created', { id: responseData.id });

    const response: CreateSettlementResponse = {
        success: true,
        data: responseData,
    };
    res.status(HTTP_STATUS.CREATED).json(response);
};

export const updateSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const responseData = await settlementService.updateSettlement(settlementId, updateData, userId);

    LoggerContext.setBusinessContext({ settlementId });
    logger.info('settlement-updated', { id: settlementId });

    const response: UpdateSettlementResponse = {
        success: true,
        data: responseData,
    };
    res.status(HTTP_STATUS.OK).json(response);
};

export const deleteSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
    }

    await settlementService.deleteSettlement(settlementId, userId);

    LoggerContext.setBusinessContext({ settlementId });
    logger.info('settlement-deleted', { id: settlementId });

    const response: DeleteSettlementResponse = {
        success: true,
        message: 'Settlement deleted successfully',
    };
    res.status(HTTP_STATUS.OK).json(response);
};

export const getSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
    }

    const responseData = await settlementService.getSettlement(settlementId, userId);

    const response: GetSettlementResponse = {
        success: true,
        data: responseData,
    };
    res.status(HTTP_STATUS.OK).json(response);
};


export const listSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);

    const { error, value } = listSettlementsQuerySchema.validate(req.query);
    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
    }

    const { groupId, limit, cursor, userId: filterUserId, startDate, endDate } = value;

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
};
