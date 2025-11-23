// Initialize ApplicationBuilder
import { getIdentityToolkitConfig } from './client-config';
import { getAuth, getFirestore, getStorage } from './firebase';
import { ComponentBuilder } from './services/ComponentBuilder';
import { getServiceConfig } from './merge/ServiceConfig';

// Lazy initialization
let appBuilder: ComponentBuilder | null = null;

// Export function to get the initialized ApplicationBuilder
export function getComponentBuilder(): ComponentBuilder {
    if (!appBuilder) {
        appBuilder = ComponentBuilder.createComponentBuilder(
            getFirestore(),
            getAuth(),
            getStorage(),
            getIdentityToolkitConfig(),
            getServiceConfig(),
        );
    }
    return appBuilder;
}
