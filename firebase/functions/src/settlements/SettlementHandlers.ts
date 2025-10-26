import { CreateSettlementRequest, UpdateSettlementRequest } from '@splitifyd/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { getIdentityToolkitConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { ComponentBuilder } from '../services/ComponentBuilder';
import { SettlementService } from '../services/SettlementService';
import { validateAmountPrecision } from '../utils/amount-validation';
import { logger } from '../utils/contextual-logger';
import { ApiError } from '../utils/errors';
import { LoggerContext } from '../utils/logger-context';
import { createSettlementSchema, settlementIdSchema, updateSettlementSchema } from './validation';

export class SettlementHandlers {
    constructor(private readonly settlementService: SettlementService) {
    }

    static createSettlementHandlers(applicationBuilder = ComponentBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const settlementService = applicationBuilder.buildSettlementService();
        return new SettlementHandlers(settlementService);
    }

    createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);

        const { error, value } = createSettlementSchema.validate(req.body);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
        }

        const settlementData: CreateSettlementRequest = value;

        // Validate settlement amount precision for currency
        // Note: Joi validation also validates precision, but we add explicit validation
        // for consistency with expense validation and to handle edge cases
        try {
            validateAmountPrecision(settlementData.amount, settlementData.currency);
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
        }

        const settlement = await this.settlementService.createSettlement(settlementData, userId);

        LoggerContext.setBusinessContext({ settlementId: settlement.id });
        logger.info('settlement-created', { id: settlement.id });

        res.status(HTTP_STATUS.CREATED).json(settlement);
    };

    updateSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

        // Validate amount precision if both amount and currency are provided
        // Note: If only amount is provided without currency, we cannot validate precision
        // without fetching the existing settlement. This matches the expense update pattern.
        if (updateData.amount !== undefined && updateData.currency !== undefined) {
            try {
                validateAmountPrecision(updateData.amount, updateData.currency);
            } catch (error) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
            }
        }

        const settlement = await this.settlementService.updateSettlement(settlementId, updateData, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-updated', { id: settlementId });

        res.status(HTTP_STATUS.OK).json(settlement);
    };

    deleteSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);

        const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
        if (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
        }

        // Use soft delete instead of hard delete
        await this.settlementService.softDeleteSettlement(settlementId, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-soft-deleted', { id: settlementId });

        res.status(HTTP_STATUS.OK).json({ message: 'Settlement deleted successfully' });
    };
}
