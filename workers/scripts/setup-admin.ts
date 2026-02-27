/**
 * Setup Admin User Script
 * 
 * Creates an admin user in D1 database with hashed password.
 * 
 * Usage:
 *   npx tsx scripts/setup-admin.ts
 * 
 * Note: This script uses a simple hash. For production, use bcrypt or argon2.
 */

async function hashPassword(password: string): Promise<string> {
  // Simple SHA-256 hash (not secure for production)
  // TODO: Replace with bcrypt or argon2 when available in Workers
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
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
