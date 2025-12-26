/**
 * @deprecated Firebase has been replaced by Cloudflare D1
 * 
 * This file is kept for reference only. All Firebase functionality
 * has been migrated to D1. Use the d1.js client instead:
 * 
 *   import { queryAll, execute } from './d1.js';
 * 
 * Migration completed:
 * - Comments: Now stored in D1 `comments` table
 * - Settings: Now stored in D1 `settings` table
 * - Analytics: Now stored in D1 `post_analytics` table
 * 
 * To fully remove Firebase:
 * 1. Delete this file (firebase.js)
 * 2. Remove firebase-admin from package.json
 * 3. Remove FIREBASE_* environment variables
 * 4. Delete workers/scripts/migrate-firestore-to-d1.ts
 * 
 * @see workers/migrations/ for D1 schema definitions
 */

// Throw error if anyone tries to use this deprecated module
export function getDb() {
  throw new Error(
    'Firebase is deprecated. Use Cloudflare D1 instead.\n' +
    'Import from: import { queryAll, execute } from "./d1.js"'
  );
}

export const FieldValue = null;
export const Timestamp = null;
