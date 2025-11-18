import { toISOString } from '@billsplit-wl/shared';
import type { ISOString, ShareLinkDTO, UserId } from '@billsplit-wl/shared';

export class ShareLinkBuilder {
    private link: Partial<ShareLinkDTO> = {};

    constructor() {
        this.link.createdAt = toISOString(new Date().toISOString());
        this.link.updatedAt = toISOString(new Date().toISOString());
        this.link.createdBy = 'user-123';
        this.link.expiresAt = toISOString(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    }

    withCreatedAt(createdAt: ISOString | Date | string): this {
        this.link.createdAt = toISOString(createdAt.toString());
        return this;
    }

    withCreatedBy(createdBy: UserId): this {
        this.link.createdBy = createdBy;
        return this;
    }

    withExpiresAt(expiresAt: ISOString | Date | string): this {
        this.link.expiresAt = toISOString(expiresAt.toString());
        return this;
    }

    withUpdatedAt(updatedAt: ISOString | Date | string): this {
        this.link.updatedAt = toISOString(updatedAt.toString());
        return this;
    }

    build(): ShareLinkDTO {
        return this.link as ShareLinkDTO;
    }
}
