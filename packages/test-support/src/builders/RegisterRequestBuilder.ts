import { randomString, randomChoice, randomEmail, randomBoolean } from '../test-helpers';

export interface RegisterRequest {
    email: string;
    password: string;
    displayName: string;
    termsAccepted: boolean;
    cookiePolicyAccepted: boolean;
}

export class RegisterRequestBuilder {
    private request: RegisterRequest = {
        email: randomEmail(),
        password: `Pass123!ABC`,
        displayName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(6)}`,
        termsAccepted: randomBoolean(),
        cookiePolicyAccepted: randomBoolean(),
    };

    withEmail(email: string): RegisterRequestBuilder {
        this.request.email = email;
        return this;
    }

    withPassword(password: string): RegisterRequestBuilder {
        this.request.password = password;
        return this;
    }

    withDisplayName(displayName: string): RegisterRequestBuilder {
        this.request.displayName = displayName;
        return this;
    }

    withoutDisplayName(): RegisterRequestBuilder {
        delete (this.request as any).displayName;
        return this;
    }

    withTermsAccepted(accepted: boolean): RegisterRequestBuilder {
        this.request.termsAccepted = accepted;
        return this;
    }

    withoutTermsAccepted(): RegisterRequestBuilder {
        delete (this.request as any).termsAccepted;
        return this;
    }

    withCookiePolicyAccepted(accepted: boolean): RegisterRequestBuilder {
        this.request.cookiePolicyAccepted = accepted;
        return this;
    }

    withoutCookiePolicyAccepted(): RegisterRequestBuilder {
        delete (this.request as any).cookiePolicyAccepted;
        return this;
    }

    build(): RegisterRequest {
        return { ...this.request };
    }
}
