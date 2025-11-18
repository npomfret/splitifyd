import type { ClientUser } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import type { User as FirebaseUser } from 'firebase/auth';

export function mapFirebaseUser(firebaseUser: FirebaseUser): ClientUser {
    return {
        uid: firebaseUser.uid!,
        email: firebaseUser.email!,
        displayName: toDisplayName(firebaseUser.displayName!),
        emailVerified: firebaseUser.emailVerified,
        photoURL: firebaseUser.photoURL,
    };
}
