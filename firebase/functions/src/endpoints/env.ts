import { onRequest } from 'firebase-functions/v2/https';
import { getClientConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import { buildEnvPayload } from './diagnostics';
import { createDiagnosticsFunctionOptions, ensureGetMethod, type HttpRequest, type HttpResponse } from './http-utils';

export const env = onRequest(createDiagnosticsFunctionOptions(), async (req: HttpRequest, res: HttpResponse) => {
    if (!ensureGetMethod(req, res)) {
        return;
    }

    if (!getClientConfig().isEmulator) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Endpoint not found',
            },
        });
        return;
    }

    res.json(buildEnvPayload());
});
