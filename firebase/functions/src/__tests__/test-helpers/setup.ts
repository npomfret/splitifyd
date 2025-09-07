import { createMetricsStorage } from '../../utils/metrics-storage-factory';
import { registerAllServices } from '../../services/serviceRegistration';

export function setupTestServices(): void {
    const metricsStorage = createMetricsStorage();
    registerAllServices(metricsStorage);
}