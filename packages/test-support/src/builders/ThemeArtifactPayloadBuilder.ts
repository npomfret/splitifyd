import { generateShortId } from '../test-helpers';

/**
 * Payload structure for saving theme artifacts.
 */
export interface ThemeArtifactPayload {
    tenantId: string;
    hash: string;
    cssContent: string;
    tokensJson: string;
}

/**
 * Builder for ThemeArtifactPayload objects used in theme artifact storage tests.
 */
export class ThemeArtifactPayloadBuilder {
    private payload: ThemeArtifactPayload;

    constructor() {
        this.payload = {
            tenantId: `tenant-${generateShortId()}`,
            hash: generateShortId(),
            cssContent: 'body { color: black; }',
            tokensJson: '{"primary":"#000000"}',
        };
    }

    withTenantId(tenantId: string): this {
        this.payload.tenantId = tenantId;
        return this;
    }

    withHash(hash: string): this {
        this.payload.hash = hash;
        return this;
    }

    withCssContent(cssContent: string): this {
        this.payload.cssContent = cssContent;
        return this;
    }

    withTokensJson(tokensJson: string): this {
        this.payload.tokensJson = tokensJson;
        return this;
    }

    build(): ThemeArtifactPayload {
        return { ...this.payload };
    }
}
