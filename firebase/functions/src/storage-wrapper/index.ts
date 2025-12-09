/**
 * Storage Wrapper Module
 *
 * Mirrors the Firestore wrapper pattern by providing abstractions over
 * Firebase Storage so application code can swap between the real service
 * and in-memory stubs without touching firebase-admin types directly.
 */

export type { IStorage } from 'ts-firebase-simulator';
export { createStorage } from 'ts-firebase-simulator';
