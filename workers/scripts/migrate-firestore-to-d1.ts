/**
 * Firestore to D1 Migration Script
 * 
 * This script exports data from Firestore and generates SQL INSERT statements
 * for importing into D1.
 * 
 * Usage:
 *   1. Set FIREBASE_SERVICE_ACCOUNT_JSON env var to path of service account JSON
 *   2. Run: npx tsx scripts/migrate-firestore-to-d1.ts > migrations/0003_seed_data.sql
 *   3. Apply: wrangler d1 execute blog-db --file=migrations/0003_seed_data.sql --local
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountPath) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set');
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Error: Service account file not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function sqlEscape(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  // Escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function exportComments() {
  console.error('Exporting comments...');
  const snapshot = await db.collection('comments').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || createdAt;
    
    console.log(
      `INSERT INTO comments(id, post_id, author, email, content, status, created_at, updated_at) VALUES (` +
      `${sqlEscape(doc.id)}, ` +
      `${sqlEscape(data.postId)}, ` +
      `${sqlEscape(data.author)}, ` +
      `${sqlEscape(data.email || null)}, ` +
      `${sqlEscape(data.content)}, ` +
      `${sqlEscape(data.archived ? 'hidden' : 'visible')}, ` +
      `${sqlEscape(createdAt)}, ` +
      `${sqlEscape(updatedAt)}` +
      `);`
    );
  }
  
  console.error(`Exported ${snapshot.size} comments`);
}

async function exportSettings() {
  console.error('Exporting settings...');
  const snapshot = await db.collection('settings').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString();
    
    console.log(
      `INSERT INTO settings(key, value, updated_at) VALUES (` +
      `${sqlEscape(doc.id)}, ` +
      `${sqlEscape(JSON.stringify(data.value || data))}, ` +
      `${sqlEscape(updatedAt)}` +
      `);`
    );
  }
  
  console.error(`Exported ${snapshot.size} settings`);
}

async function main() {
  console.log('-- Firestore to D1 Migration');
  console.log('-- Generated at: ' + new Date().toISOString());
  console.log('');
  console.log('BEGIN TRANSACTION;');
  console.log('');
  
  try {
    await exportComments();
    console.log('');
    await exportSettings();
    console.log('');
    console.log('COMMIT;');
    console.error('\n✅ Migration SQL generated successfully');
    console.error('📝 Review the output and apply with: wrangler d1 execute blog-db --file=migrations/0003_seed_data.sql');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('ROLLBACK;');
    process.exit(1);
  }
}

main();
