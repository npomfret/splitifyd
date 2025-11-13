import type { AdminUpsertTenantRequest } from '../../schemas/tenant';
import type { IFirestoreWriter } from '../firestore';

export class TenantAdminService {
    constructor(private readonly firestoreWriter: IFirestoreWriter) {}

    async upsertTenant(request: AdminUpsertTenantRequest) {
        const { tenantId, ...rest } = request;
        return this.firestoreWriter.upsertTenant(tenantId, rest);
    }
}
