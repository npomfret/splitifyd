// Initialize ApplicationBuilder
import { getIdentityToolkitConfig } from './client-config';
import { getAuth, getFirestore, getStorage } from './firebase';
import { ComponentBuilder, type MergeServiceConfig } from './services/ComponentBuilder';

// Lazy initialization
let appBuilder: ComponentBuilder | null = null;

// Export function to get the initialized ApplicationBuilder
export function getComponentBuilder(): ComponentBuilder {
    if (!appBuilder) {
        const mergeServiceConfig: MergeServiceConfig = {
            projectId: process.env.GCLOUD_PROJECT || 'test-project',
            cloudTasksLocation: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
            functionsUrl: process.env.FUNCTIONS_URL || 'http://localhost:5001',
        };

        appBuilder = ComponentBuilder.createComponentBuilder(
            getFirestore(),
            getAuth(),
            getStorage(),
            getIdentityToolkitConfig(),
            mergeServiceConfig,
        );
    }
    return appBuilder;
}
