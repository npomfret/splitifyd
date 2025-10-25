import { onRequest } from 'firebase-functions/v2/https';
import { buildHealthPayload, resolveHealthStatusCode, runHealthChecks } from './diagnostics';
import { createDiagnosticsFunctionOptions, ensureGetMethod, type HttpRequest, type HttpResponse } from './http-utils';

export const health = onRequest(createDiagnosticsFunctionOptions(), async (req: HttpRequest, res: HttpResponse) => {
    if (!ensureGetMethod(req, res)) {
        return;
    }

    const checks = await runHealthChecks();
    const payload = buildHealthPayload(checks);
    const statusCode = resolveHealthStatusCode(checks);

    res.status(statusCode).json(payload);
});
