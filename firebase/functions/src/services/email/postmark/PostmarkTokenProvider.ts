import { ErrorDetail, Errors } from '../../../errors';
import { logger } from '../../../logger';
import { POSTMARK_API_KEYS_JSON } from '../../../params';

export class PostmarkTokenProvider {
    private cachedToken: string | null = null;
    private inFlight: Promise<string> | null = null;

    async getServerToken(): Promise<string> {
        if (this.cachedToken) {
            return this.cachedToken;
        }
        if (this.inFlight) {
            return this.inFlight;
        }

        this.inFlight = this.loadToken().finally(() => {
            this.inFlight = null;
        });
        return this.inFlight;
    }

    private async loadToken(): Promise<string> {
        const serverName = process.env['__POSTMARK_SERVERNAME']?.trim();
        if (!serverName) {
            throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
        }

        const raw = POSTMARK_API_KEYS_JSON.value();
        const map = this.parseSecretJson(raw);
        const token = map[serverName];

        if (!token) {
            logger.error('Postmark token missing for server name', { serverName, knownServers: Object.keys(map) });
            throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
        }

        this.cachedToken = token;
        return token;
    }

    private parseSecretJson(raw: unknown): Record<string, string> {
        if (typeof raw !== 'string' || raw.trim().length === 0) {
            throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
        }

        const entries = Object.entries(parsed as Record<string, unknown>);
        const result: Record<string, string> = {};
        for (const [key, value] of entries) {
            if (typeof value !== 'string') {
                throw Errors.serviceError(ErrorDetail.EMAIL_SERVICE_ERROR);
            }
            result[key] = value;
        }
        return result;
    }
}
