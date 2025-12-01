import type { BrandingArtifactMetadata } from '@billsplit-wl/shared';

export class BrandingArtifactMetadataBuilder {
    private data: BrandingArtifactMetadata = {
        hash: 'test-hash',
        cssUrl: 'https://storage.googleapis.com/test-bucket/theme.css',
        tokensUrl: 'https://storage.googleapis.com/test-bucket/tokens.json',
        version: 1,
        generatedAtEpochMs: Date.now(),
        generatedBy: 'test-builder',
    };

    withHash(hash: string): this {
        this.data.hash = hash;
        return this;
    }

    withCssUrl(cssUrl: string): this {
        this.data.cssUrl = cssUrl;
        return this;
    }

    withTokensUrl(tokensUrl: string): this {
        this.data.tokensUrl = tokensUrl;
        return this;
    }

    withVersion(version: number): this {
        this.data.version = version;
        return this;
    }

    withGeneratedAtEpochMs(epochMs: number): this {
        this.data.generatedAtEpochMs = epochMs;
        return this;
    }

    withGeneratedBy(generatedBy: string): this {
        this.data.generatedBy = generatedBy;
        return this;
    }

    build(): BrandingArtifactMetadata {
        return { ...this.data };
    }
}
