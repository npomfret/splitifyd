import { registerAllServices } from '../../services/serviceRegistration';
import { getFirestore } from "../../firebase";

export function setupTestServices(): void {
    // Pass Firestore instance to service registration (metrics storage removed)
    registerAllServices(getFirestore());
}