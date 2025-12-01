// Initialize ApplicationBuilder
import { getIdentityToolkitConfig } from './app-config';
import { getAuth, getFirestore, getStorage } from './firebase';
import { getServiceConfig } from './merge/ServiceConfig';
import { ComponentBuilder } from './services/ComponentBuilder';

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
