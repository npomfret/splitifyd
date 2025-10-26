// Initialize ApplicationBuilder
import { getIdentityToolkitConfig } from './client-config';
import { getAuth, getFirestore } from './firebase';
import { ComponentBuilder } from './services/ComponentBuilder';

// Lazy initialization
let appBuilder: ComponentBuilder | null = null;

// Export function to get the initialized ApplicationBuilder
export function getAppBuilder(): ComponentBuilder {
    if (!appBuilder) {
        appBuilder = ComponentBuilder.createApplicationBuilder(
            getFirestore(),
            getAuth(),
            getIdentityToolkitConfig(),
        );
    }
    return appBuilder;
}
