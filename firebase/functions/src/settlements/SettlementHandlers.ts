import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { SettlementService } from '../services/SettlementService';
import { logger } from '../utils/contextual-logger';
import { LoggerContext } from '../utils/logger-context';
import { validateCreateSettlement, validateSettlementId, validateUpdateSettlement } from './validation';

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

        const settlement = await this.settlementService.updateSettlement(settlementId, updateData, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-updated', { id: settlementId });

        res.status(HTTP_STATUS.OK).json(settlement);
    };

    deleteSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);

        const settlementId = validateSettlementId(req.params.settlementId);
        await this.settlementService.softDeleteSettlement(settlementId, userId);

        LoggerContext.setBusinessContext({ settlementId });
        logger.info('settlement-soft-deleted', { id: settlementId });

        res.status(HTTP_STATUS.OK).json({ message: 'Settlement deleted successfully' });
    };
}
