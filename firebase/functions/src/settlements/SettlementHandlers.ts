import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { validateGroupIdParam } from '../groups/validation';
import { SettlementService } from '../services/SettlementService';
import { logger } from '../utils/contextual-logger';
import { LoggerContext } from '../utils/logger-context';
import { validateCreateSettlement, validateListSettlementsQuery, validateSettlementId, validateUpdateSettlement } from './validation';

export class SettlementHandlers {
    constructor(private readonly settlementService: SettlementService) {
    }

    createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);

        const settlementData = validateCreateSettlement(req.body);

        const settlement = await this.settlementService.createSettlement(settlementData, userId);

        LoggerContext.setBusinessContext({ settlementId: settlement.id });
        logger.info('settlement-created', { id: settlement.id });

        res.status(HTTP_STATUS.CREATED).json(settlement);
    };

    updateSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);

        const settlementId = validateSettlementId(req.params.settlementId);

        const updateData = validateUpdateSettlement(req.body);

        const result = await this.settlementService.updateSettlement(settlementId, updateData, userId);

        LoggerContext.setBusinessContext({ settlementId: result.id });
        logger.info('settlement-updated', { oldId: settlementId, newId: result.id });

        res.status(HTTP_STATUS.OK).json(result);
    };

    deleteSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);

        const settlementId = validateSettlementId(req.params.settlementId);
        await this.settlementService.softDeleteSettlement(settlementId, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-soft-deleted', { id: settlementId });

        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * List settlements for a group with pagination
     */
    listGroupSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const groupId = validateGroupIdParam(req.params);
        const { limit, cursor, includeDeleted } = validateListSettlementsQuery(req.query);

        try {
            const result = await this.settlementService.listSettlements(groupId, userId, {
                limit,
                cursor,
                includeDeleted,
            });

            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Failed to list group settlements', error as Error, {
                groupId,
                userId,
            });
            throw error;
        }
    };
}
