import { AppConfiguration, TenantConfig } from '@splitifyd/shared';
import { getTenantAwareAppConfig } from '../client-config';

export const getEnhancedConfigResponse = (tenant?: TenantConfig): AppConfiguration => {
    return getTenantAwareAppConfig(tenant);
};
