import type { ClientUser } from '@splitifyd/shared';
import type { User as FirebaseUser } from 'firebase/auth';

export function mapFirebaseUser(firebaseUser: FirebaseUser): ClientUser {
    return {
        uid: firebaseUser.uid!,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName!,
        emailVerified: firebaseUser.emailVerified,
        photoURL: firebaseUser.photoURL,
    };
}
