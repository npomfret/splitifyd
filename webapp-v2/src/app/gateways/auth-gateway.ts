import type { ClientUser } from '@billsplit-wl/shared';
import type { FirebaseService } from '../firebase';
import { getFirebaseService } from '../firebase';

export interface AuthGateway {
    connect(): Promise<void>;
    onAuthStateChanged(callback: (user: ClientUser | null, idToken: string | null) => Promise<void>): () => void;
    setPersistence(persistenceType: 'local' | 'session'): Promise<void>;
    signInWithCustomToken(customToken: string): Promise<void>;
    signOut(): Promise<void>;
    performTokenRefresh(): Promise<string>;
    performUserRefresh(): Promise<void>;
}

class FirebaseAuthGateway implements AuthGateway {
    constructor(private readonly firebaseService: FirebaseService) {}

    connect(): Promise<void> {
        return this.firebaseService.connect();
    }

    onAuthStateChanged(callback: (user: ClientUser | null, idToken: string | null) => Promise<void>): () => void {
        return this.firebaseService.onAuthStateChanged(callback);
    }

    setPersistence(persistenceType: 'local' | 'session'): Promise<void> {
        return this.firebaseService.setPersistence(persistenceType);
    }

    signInWithCustomToken(customToken: string): Promise<void> {
        return this.firebaseService.signInWithCustomToken(customToken);
    }

    signOut(): Promise<void> {
        return this.firebaseService.signOut();
    }

    performTokenRefresh(): Promise<string> {
        return this.firebaseService.performTokenRefresh();
    }

    performUserRefresh(): Promise<void> {
        return this.firebaseService.performUserRefresh();
    }
}

const defaultAuthGateway = new FirebaseAuthGateway(getFirebaseService());

export const getDefaultAuthGateway = (): AuthGateway => defaultAuthGateway;
