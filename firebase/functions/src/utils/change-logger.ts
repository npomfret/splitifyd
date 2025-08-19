import { logger } from '../logger';
import { diff } from 'deep-object-diff';

const changeLogger = {
    logCreate: (documentPath: string, data: any) => {
        logger.info(`[CREATE] ${documentPath}`, { data });
    },

    logUpdate: (documentPath: string, before: any, after: any) => {
        const changes = diff(before, after);
        logger.info(`[UPDATE] ${documentPath}`, { changes });
    },

    logDelete: (documentPath: string, data: any) => {
        logger.info(`[DELETE] ${documentPath}`, { data });
    },
};

export default changeLogger;
