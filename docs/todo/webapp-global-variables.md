# Webapp Issue: Global Variables (`window.firebaseAuth`, `window.ModalComponent`)

## Issue Description

The codebase relies on global variables (`window.firebaseAuth`, `window.ModalComponent`) for accessing Firebase authentication and modal components. While declared in `global.d.ts`, this practice deviates from modern TypeScript modularity principles and the "NO HACKS" rule in `GEMINI.md`.

## Recommendation

Refactor code to import `firebaseAuth` and `ModalComponent` as modules where they are needed, rather than relying on global `window` properties. This improves type safety, code readability, and maintainability.

## Implementation Suggestions

1.  **Remove Global Declarations:**
    *   Remove `firebaseAuth` and `ModalComponent` from `window` in `webapp/src/js/types/global.d.ts`.

2.  **Refactor `firebase-config.ts`:**
    *   Instead of assigning `firebaseAuth` to `window.firebaseAuth`, export the necessary Firebase Auth functions directly from `firebase-config.ts`.

    ```typescript
    // webapp/src/js/firebase-config.ts
    // ... (imports)

    export let firebaseAuthInstance: FirebaseAuthService | null = null; // New export

    class FirebaseConfigManager {
        // ... (existing code)

        async initialize(): Promise<FirebaseConfigManagerConfig | null> {
            // ... (existing initialization logic)

            firebaseAuthInstance = {
                signInWithEmailAndPassword: (email: string, password: string) => 
                    signInWithEmailAndPassword(this.auth!, email, password),
                createUserWithEmailAndPassword: (email: string, password: string) => 
                    createUserWithEmailAndPassword(this.auth!, email, password),
                updateProfile: (user: any, profile: { displayName: string }) => updateProfile(user, profile),
                signOut: () => signOut(this.auth!),
                onAuthStateChanged: (callback: (user: any) => void) => onAuthStateChanged(this.auth!, callback),
                getCurrentUser: () => this.auth!.currentUser,
                sendPasswordResetEmail: (email: string) => sendPasswordResetEmail(this.auth!, email)
            };

            // ... (rest of the method)
        }
        // ... (rest of the class)
    }

    export const firebaseConfigManager = new FirebaseConfigManager();

    // Define FirebaseAuthService interface if not already in global.d.ts
    interface FirebaseAuthService {
        signInWithEmailAndPassword(email: string, password: string): Promise<any>;
        createUserWithEmailAndPassword(email: string, password: string): Promise<any>;
        updateProfile(user: any, profile: { displayName: string }): Promise<void>;
        sendPasswordResetEmail(email: string): Promise<void>;
        onAuthStateChanged(callback: (user: any) => void): () => void;
        getCurrentUser(): any;
        signOut(): Promise<void>;
    }
    ```

3.  **Refactor `modal.ts` and `groups.ts`:**
    *   In `webapp/src/js/components/modal.ts`, ensure `ModalComponent` is exported as a class or object.
    *   In `webapp/src/js/groups.ts`, remove the `window.ModalComponent` assignment and use direct imports.

    ```typescript
    // webapp/src/js/groups.ts
    import { ModalComponent } from './components/modal.js'; // Direct import

    // ... (existing code)

    async function ensureModalComponent(): Promise<typeof ModalComponent> {
      // No need for window.ModalComponent check or assignment
      return ModalComponent;
    }

    export class GroupsList {
      // ... (existing code)

      private async openCreateGroupModal(): Promise<void> {
        // Use ModalComponent directly
        const modalHtml = ModalComponent.render({
          id: 'createGroupModal',
          title: 'Create New Group',
          // ... (rest of modal config)
        });

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        ModalComponent.show('createGroupModal');

        // ... (rest of the method)

        // Use ModalComponent directly
        const cancelCreateGroupButton = document.getElementById('cancelCreateGroupButton');
        if (cancelCreateGroupButton) {
          cancelCreateGroupButton.addEventListener('click', () => {
            ModalComponent.hide('createGroupModal');
          });
        }

        // ... (rest of the method)
      }
    }
    ```

4.  **Update All Consumers:**
    *   Go through all files that currently use `window.firebaseAuth` or `window.ModalComponent` and update them to import the newly exported modules/functions.

5.  **Verify with Build and Tests:**
    Run `npm run build` and `npm test` in the `webapp` directory to ensure no new type errors are introduced and existing tests pass.
