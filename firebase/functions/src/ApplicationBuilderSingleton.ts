// Initialize ApplicationBuilder
import { getAuth, getFirestore } from './firebase';
import { ApplicationBuilder } from './services/ApplicationBuilder';

// Lazy initialization
let appBuilder: ApplicationBuilder | null = null;

// Export function to get the initialized ApplicationBuilder
export function getAppBuilder(): ApplicationBuilder {
    if (!appBuilder) {
        appBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth());
    }
    return appBuilder;
}
