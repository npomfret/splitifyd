import { onRequest } from 'firebase-functions/v2/https';
import { buildStatusPayload } from './diagnostics';
import { createDiagnosticsFunctionOptions, ensureGetMethod, type HttpRequest, type HttpResponse } from './http-utils';

export const status = onRequest(createDiagnosticsFunctionOptions(), async (req: HttpRequest, res: HttpResponse) => {
    if (!ensureGetMethod(req, res)) {
        return;
    }

    res.json(buildStatusPayload());
});
