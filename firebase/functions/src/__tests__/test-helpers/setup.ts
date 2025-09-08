import { createMetricsStorage } from '../../utils/metrics-storage-factory';
import { registerAllServices } from '../../services/serviceRegistration';
import {getFirestore} from "../../firebase";

export function setupTestServices(): void {
    const metricsStorage = createMetricsStorage();
    registerAllServices(metricsStorage, getFirestore());
}