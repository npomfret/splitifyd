// Initialize ApplicationBuilder
import { getIdentityToolkitConfig } from './client-config';
import { getAuth, getFirestore, getStorage } from './firebase';
import { ComponentBuilder, type ServiceConfig } from './services/ComponentBuilder';

// Lazy initialization
let appBuilder: ComponentBuilder | null = null;

// Export function to get the initialized ApplicationBuilder
export function getComponentBuilder(): ComponentBuilder {
    if (!appBuilder) {
        const serviceConfig: ServiceConfig = {//todo - blow up if the env file is malformed
            projectId: process.env.GCLOUD_PROJECT || 'test-project',
            cloudTasksLocation: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
            functionsUrl: process.env.FUNCTIONS_URL!,
        };

        appBuilder = ComponentBuilder.createComponentBuilder(
            getFirestore(),
            getAuth(),
            getStorage(),
            getIdentityToolkitConfig(),
            serviceConfig,
        );
    }
    return appBuilder;
}
