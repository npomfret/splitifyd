import type { ClientUser } from '@billsplit-wl/shared';
import { toDisplayName, toUserId, toEmail } from '@billsplit-wl/shared';
import type { User as FirebaseUser } from 'firebase/auth';

export function mapFirebaseUser(firebaseUser: FirebaseUser): ClientUser {
    return {
        uid: toUserId(firebaseUser.uid!),
        email: toEmail(firebaseUser.email!),
        displayName: toDisplayName(firebaseUser.displayName!),
        emailVerified: firebaseUser.emailVerified,
        photoURL: firebaseUser.photoURL,
    };
}
