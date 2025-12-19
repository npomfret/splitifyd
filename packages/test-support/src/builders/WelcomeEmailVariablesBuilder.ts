import type { WelcomeEmailVariables } from '@billsplit-wl/shared';

/**
 * Builder for creating welcome email variable objects for testing
 */
export class WelcomeEmailVariablesBuilder {
    private variables: WelcomeEmailVariables;

    constructor() {
        this.variables = {
            appName: 'TestApp',
            displayName: 'John Doe',
            dashboardLink: 'https://example.com/dashboard',
        };
    }

    withAppName(appName: string): this {
        this.variables.appName = appName;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.variables.displayName = displayName;
        return this;
    }

    withDashboardLink(dashboardLink: string): this {
        this.variables.dashboardLink = dashboardLink;
        return this;
    }

    build(): WelcomeEmailVariables {
        return { ...this.variables };
    }
}
