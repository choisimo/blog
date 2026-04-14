/**
 * Setup Admin User Script
 *
 * Creates an admin user in D1 database with hashed password.
 *
 * Usage:
 *   npx tsx scripts/setup-admin.ts
 */

import { randomBytes, scryptSync } from 'node:crypto';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

async function main() {
  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('Error: Password required');
    console.error('Usage: npx tsx scripts/setup-admin.ts [username] <password>');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const userId = `admin-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  console.log('-- Setup Admin User');
  console.log('-- Generated at: ' + now);
  console.log('');
  console.log(
    `INSERT INTO users(id, username, password_hash, created_at, updated_at) VALUES ` +
    `('${userId}', '${username}', '${passwordHash}', '${now}', '${now}');`
  );
  console.log('');
  console.error(`✅ Admin user SQL generated`);
  console.error(`Username: ${username}`);
  console.error(`User ID: ${userId}`);
  console.error('');
  console.error('📝 Apply with: wrangler d1 execute blog-db --file=migrations/0002_seed_admin.sql --local');
}

main();
