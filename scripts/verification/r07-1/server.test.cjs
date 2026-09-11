// Production JWT, proof service, middleware and repository SQL; SQLite replaces D1.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHmac } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../../..');
require('./support.cjs').register();
const load = name => require(path.join(root, 'workers/api-gateway/src', name));
const { issueAnonymousToken, renewAnonymousToken, revokeAnonymousToken } = load('lib/anonymous-auth-service.ts');
const { readBearerToken, revokeAnonymousIdentity, anonymousSubjectHash } = load('lib/anonymous-identity.ts');
const { signJwt, verifyJwt, generateAccessToken, generateRefreshToken } = load('lib/jwt.ts');
const { getUserIdFromToken } = load('lib/auth-helpers.ts');
const { requireAuth, requireAdmin } = load('middleware/auth.ts');
const policy = load('lib/reader-image-policy.ts');
const repo = load('lib/reader-image-repository.ts');

function fixture(t) {
  const raw = new DatabaseSync(':memory:');
  for (const name of ['0008_memo_versions.sql', '0039_reader_image_jobs.sql', '0040_anonymous_identity_revocations.sql']) {
    raw.exec(fs.readFileSync(path.join(root, 'workers/migrations', name), 'utf8'));
  }
  const DB = { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; },
      async first() { return raw.prepare(sql).get(...values) ?? null; },
      async all() { return { results: raw.prepare(sql).all(...values) }; },
      async run() { const result = raw.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
    };
  } };
  t.after(() => raw.close());
  return { raw, env: { DB, JWT_SECRET: 'fixture-only-r07-1-signing-key', ENV: 'development' } };
}
const fresh = env => issueAnonymousToken(env, {});
const bearer = token => `Bearer ${token}`;
function context(env, token) {
  const headers = new Headers(); const values = new Map();
  return { env, req: { header: name => name.toLowerCase() === 'authorization' ? (token ? bearer(token) : undefined) : undefined },
    get: key => values.get(key), set: (key, value) => values.set(key, value),
    header: (key, value) => headers.set(key, value),
    json: (value, status) => new Response(JSON.stringify(value), { status: typeof status === 'number' ? status : status?.status ?? 200, headers }),
  };
}
const rejection = (promise, code, status) => assert.rejects(promise, error => error.code === code && error.status === status);
function customToken(env, claims, header = { alg: 'HS256', typ: 'JWT' }) {
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  const message = `${encode(header)}.${encode(claims)}`;
  return `${message}.${createHmac('sha256', env.JWT_SECRET).update(message).digest('base64url')}`;
}
function canonical(sub = `anon-${crypto.randomUUID()}`) {
  const now = Math.floor(Date.now() / 1000);
  return { sub, role: 'anonymous', username: 'Anonymous', tokenClass: 'anonymous', type: 'access',
    iss: 'blog-api-gateway', aud: 'blog-platform', nbf: now, iat: now, exp: now + 1000 };
}

test('server mints an unpredictable subject; body cannot select roles, sub or tier', async t => {
  const { env } = fixture(t); const result = await issueAnonymousToken(env, { sub: 'admin', role: 'admin', tier: 'member' });
  const payload = await verifyJwt(result.token, env);
  assert.match(payload.sub, /^anon-[0-9a-f-]{36}$/); assert.equal(payload.role, 'anonymous');
  assert.equal(payload.tokenClass, 'anonymous'); assert.equal(payload.type, 'access');
  assert.ok(payload.jti); assert.equal(result.userId, payload.sub); assert.equal(result.expiresIn, 2592000);
});
test('100 fresh visits get 100 distinct server subjects', async t => {
  const { env } = fixture(t); const results = await Promise.all(Array.from({ length: 100 }, () => fresh(env)));
  assert.equal(new Set(results.map(result => result.userId)).size, 100);
});
for (const hint of [`anon-11111111-1111-4111-8111-111111111111`, 'admin', null, 1, '']) {
  test(`an ID hint without proof cannot claim an owner (${String(hint)})`, async t => {
    const { env } = fixture(t);
    await rejection(issueAnonymousToken(env, { existingId: hint }), 'ANONYMOUS_PROOF_REQUIRED', 401);
  });
}
test('fingerprint and IP hints never recover the supplied ID', async t => {
  const { env } = fixture(t); const victim = await fresh(env);
  await rejection(issueAnonymousToken(env, { existingId: victim.userId, fingerprint: 'known', ip: '192.0.2.1' }), 'ANONYMOUS_PROOF_REQUIRED', 401);
});
test('valid proof and matching ID preserve exact subject and all prior tokens', async t => {
  const { env } = fixture(t); const old = await fresh(env);
  const next = await issueAnonymousToken(env, { existingId: old.userId }, bearer(old.token));
  assert.equal(next.userId, old.userId); assert.notEqual(next.token, old.token);
  assert.equal((await verifyJwt(old.token, env)).sub, old.userId);
  assert.equal((await verifyJwt(next.token, env)).sub, old.userId);
});
test('another valid owner cannot recover a known ID', async t => {
  const { env } = fixture(t); const [a, b] = await Promise.all([fresh(env), fresh(env)]);
  await rejection(issueAnonymousToken(env, { existingId: a.userId }, bearer(b.token)), 'ANONYMOUS_SUBJECT_MISMATCH', 403);
});
test('canonical legacy anonymous access proof without jti remains valid', async t => {
  const { env } = fixture(t); const payload = canonical(); const old = customToken(env, payload);
  assert.equal((await verifyJwt(old, env)).sub, payload.sub);
  assert.equal((await renewAnonymousToken(env, bearer(old))).userId, payload.sub);
});
test('100 concurrent renewals stay on one owner, with distinct token IDs', async t => {
  const { env } = fixture(t); const old = await fresh(env);
  const results = await Promise.all(Array.from({ length: 100 }, () => renewAnonymousToken(env, bearer(old.token))));
  assert.deepEqual([...new Set(results.map(result => result.userId))], [old.userId]);
  assert.equal(new Set(results.map(result => result.token)).size, 100);
});
for (const header of [undefined, '', 'Basic xyz', 'token', 'Bearer x.y.z', 'Bearer x.y.z\r\nHeader: bad']) {
  test(`invalid renewal cannot issue a new owner (${String(header).split('\r')[0]})`, async t => {
    const { env } = fixture(t); await assert.rejects(renewAnonymousToken(env, header), error => error.status === 401);
  });
}
for (const change of [{ exp: undefined }, { exp: null }, { exp: Math.floor(Date.now() / 1000) }, { exp: 0 },
  { nbf: Math.floor(Date.now() / 1000) + 10000 }, { iss: 'different' }, { aud: 'different' },
  { role: 'admin' }, { tokenClass: undefined }, { type: 'refresh' }, { sub: 'anon-invalid' }]) {
  test(`reject malformed, expired or wrong-purpose claims: ${JSON.stringify(change)}`, async t => {
    const { env } = fixture(t); const token = customToken(env, { ...canonical(), ...change });
    await assert.rejects(verifyJwt(token, env));
    await rejection(renewAnonymousToken(env, bearer(token)), 'ANONYMOUS_PROOF_INVALID', 401);
  });
}
for (const header of [{ alg: 'none', typ: 'JWT' }, { alg: 'HS512', typ: 'JWT' }, { alg: 'HS256', typ: 'access' },
  { alg: 'HS256', typ: 'JWT', crit: ['unknown'] }]) {
  test(`the allowlisted JWT header is mandatory: ${JSON.stringify(header)}`, async t => {
    const { env } = fixture(t); await assert.rejects(verifyJwt(customToken(env, canonical(), header), env));
  });
}
test('tampered signature and attacker-signed proof fail', async t => {
  const { env } = fixture(t); const old = await fresh(env);
  await assert.rejects(verifyJwt(old.token.slice(0, -5) + 'xxxxx', env));
  await assert.rejects(verifyJwt(customToken({ ...env, JWT_SECRET: 'wrong' }, canonical(old.userId)), env));
});
test('member/admin tokens cannot be exchanged into anonymous ownership', async t => {
  const { env } = fixture(t); const token = await generateAccessToken({ sub: 'admin', role: 'admin', username: 'Admin', emailVerified: true }, env);
  await rejection(renewAnonymousToken(env, bearer(token)), 'ANONYMOUS_PROOF_INVALID', 401);
  await rejection(issueAnonymousToken(env, {}, bearer(token)), 'ANONYMOUS_PROOF_INVALID', 401);
});
test('revocation invalidates old and renewed proof but does not delete personal content', async t => {
  const { env, raw } = fixture(t); const old = await fresh(env); const next = await renewAnonymousToken(env, bearer(old.token));
  raw.prepare("INSERT INTO memo_content (id, user_id, content) VALUES ('memo-a', ?, 'private draft')").run(old.userId);
  const result = await revokeAnonymousToken(env, bearer(old.token));
  assert.equal(result.dataDeleted, false);
  for (const token of [old.token, next.token]) {
    await rejection(verifyJwt(token, env), 'ANONYMOUS_PROOF_REVOKED', 401);
    await rejection(renewAnonymousToken(env, bearer(token)), 'ANONYMOUS_PROOF_REVOKED', 401);
    assert.equal(await getUserIdFromToken(context(env, token)), null);
  }
  assert.equal(raw.prepare('SELECT content FROM memo_content').get().content, 'private draft');
  const row = raw.prepare('SELECT * FROM anonymous_identity_revocations').get();
  assert.deepEqual(Object.keys(row).sort(), ['revoked_at', 'subject_hash']);
  assert.equal(row.subject_hash, await anonymousSubjectHash(old.userId));
  assert.ok(!JSON.stringify(row).includes(old.userId));
});
test('revocation is idempotent and does not affect another anonymous owner', async t => {
  const { env, raw } = fixture(t); const [a,b] = await Promise.all([fresh(env),fresh(env)]);
  await Promise.all([revokeAnonymousIdentity(env,a.userId), revokeAnonymousIdentity(env,a.userId)]);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM anonymous_identity_revocations').get().n, 1);
  assert.equal((await renewAnonymousToken(env,bearer(b.token))).userId,b.userId);
});
test('revocation/renewal race cannot produce an authorized post-revocation token', async t => {
  const { env } = fixture(t); const old = await fresh(env);
  const results = await Promise.allSettled([renewAnonymousToken(env,bearer(old.token)), revokeAnonymousIdentity(env,old.userId)]);
  assert.equal(results[1].status,'fulfilled');
  if(results[0].status==='fulfilled') await rejection(verifyJwt(results[0].value.token,env),'ANONYMOUS_PROOF_REVOKED',401);
});
test('missing revocation migration fails closed with 503 rather than resetting an identity', async t => {
  const { env, raw } = fixture(t); const old = await fresh(env); raw.exec('DROP TABLE anonymous_identity_revocations');
  await rejection(fresh(env),'ANONYMOUS_AUTH_UNAVAILABLE',503);
  await rejection(renewAnonymousToken(env,bearer(old.token)),'ANONYMOUS_AUTH_UNAVAILABLE',503);
  await rejection(getUserIdFromToken(context(env,old.token)),'ANONYMOUS_AUTH_UNAVAILABLE',503);
  const response=await requireAuth(context(env,old.token),async()=>assert.fail('must not authorize'));
  assert.equal(response.status,503); assert.equal(response.headers.get('Retry-After'),'30');
});
test('admin access/refresh authentication remains independent of anonymous revocation storage', async t => {
  const { env, raw }=fixture(t);raw.exec('DROP TABLE anonymous_identity_revocations');
  const payload={sub:'admin',role:'admin',username:'Admin',emailVerified:true};
  const access=await generateAccessToken(payload,env);const refresh=await generateRefreshToken(payload,env,'family-jti');
  assert.equal((await verifyJwt(refresh,env)).jti,'family-jti');let called=false;
  await requireAdmin(context(env,access),async()=>{called=true});assert.equal(called,true);
  const response=await requireAuth(context(env,refresh),async()=>assert.fail('must reject refresh'));
  assert.equal(response.status,401);
});
test('authorized downstream errors are not mislabeled as expired tokens', async t => {
  const { env }=fixture(t);const old=await fresh(env);const failure=new Error('downstream unavailable');
  await assert.rejects(requireAuth(context(env,old.token),async()=>{throw failure}),e=>e===failure);
});
test('canonical anonymous proof resolves same memo user before and after renewal',async t=>{
  const {env}=fixture(t);const old=await fresh(env);const next=await renewAnonymousToken(env,bearer(old.token));
  assert.equal(await getUserIdFromToken(context(env,old.token)),old.userId);
  assert.equal(await getUserIdFromToken(context(env,next.token)),old.userId);
});
test('image ownership hash, guest five-image count and account role separation survive renewal',async t=>{
  const {env}=fixture(t);const old=await fresh(env);const next=await renewAnonymousToken(env,bearer(old.token));
  const oldClaims=await verifyJwt(old.token,env),newClaims=await verifyJwt(next.token,env);
  const owner=await policy.digest(`guest:${oldClaims.sub}`);
  assert.equal(owner,await policy.digest(`guest:${newClaims.sub}`));assert.equal(policy.isRegisteredImageUser(newClaims),false);
  const now=Date.now(), day=policy.imageDay(now).day;
  for(let i=0;i<5;i++) assert.equal(await repo.reserveImageJob(env.DB,{id:'image-'+i,owner,network:'one-network',day,hash:'same',limit:5,globalLimit:500,member:false,now}),true);
  assert.equal(await repo.reserveImageJob(env.DB,{id:'sixth',owner,network:'one-network',day,hash:'same',limit:5,globalLimit:500,member:false,now:now+61000}),false);
  assert.ok(await repo.findImageJob(env.DB,'image-0',owner));assert.equal(await repo.findImageJob(env.DB,'image-0','another-owner'),null);
});
test('Bearer extraction rejects absent schemes and whitespace/control smuggling',()=>{
  assert.equal(readBearerToken('Bearer a.b.c'),'a.b.c');assert.equal(readBearerToken('bearer a.b.c'),'a.b.c');
  for(const input of ['a.b.c','Basic a.b.c','Bearer  a.b.c','Bearer a.b.c\n','Bearer\ta.b.c'])assert.equal(readBearerToken(input),null);
});

test('all forwarding paths can reject revoked user proof before origin calls',async t=>{
 const {env}=fixture(t);const {rejectInvalidForwardedAccess}=load('lib/forwarded-access.ts');const old=await fresh(env);
 const request=new Request('https://fixture.invalid/api/v1/chat',{headers:{Authorization:bearer(old.token)}});
 assert.equal(await rejectInvalidForwardedAccess(request,env),null);
 await revokeAnonymousIdentity(env,old.userId);
 const response=await rejectInvalidForwardedAccess(request,env);assert.equal(response.status,401);
 assert.ok(!(await response.text()).includes(old.token));
});
test('forwarding guard preserves 503 for an unavailable anonymous revocation store',async t=>{
 const {env,raw}=fixture(t);const {rejectInvalidForwardedAccess}=load('lib/forwarded-access.ts');const old=await fresh(env);
 raw.exec('DROP TABLE anonymous_identity_revocations');
 const response=await rejectInvalidForwardedAccess(new Request('https://fixture.invalid',{headers:{Authorization:bearer(old.token)}}),env);
 assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('forwarding without user credentials remains subject to existing route policy',async t=>{
 const {env}=fixture(t);const {rejectInvalidForwardedAccess}=load('lib/forwarded-access.ts');
 assert.equal(await rejectInvalidForwardedAccess(new Request('https://fixture.invalid'),env),null);
});
