// Real Hono + D1. Upstream public source fetch is a fixture; no paid model request is made.
import {env,createExecutionContext,waitOnExecutionContext} from 'cloudflare:test';
import {Hono} from 'hono';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import routes from '../src/routes/translate';
import {signJwt} from '../src/lib/jwt';
import type {Env,HonoEnv} from '../src/types';
const source={year:'2026',slug:'한글 글',title:'Source title',description:'Source description',content:'# Source content'};
let published=true;
const bindings=()=>({...env,ENV:'development',JWT_SECRET:'translation-route-test-secret',PUBLIC_SITE_URL:'https://public.test',
  BACKEND_ORIGIN:'https://backend.test',TRANSLATION_EXECUTION_ENABLED:'false'}) as Env;
function app(){const a=new Hono<HonoEnv>();a.route('/api/v1',routes);return a;}
async function request(suffix='',init?:RequestInit){const ctx=createExecutionContext();const response=await app().fetch(
  new Request(`https://api.test/api/v1/public/posts/2026/${encodeURIComponent(source.slug)}/translations/en${suffix}`,init),bindings(),ctx);await waitOnExecutionContext(ctx);return response;}
beforeEach(async()=>{
 published=true;for(const name of ['translation_attempts','translation_jobs','domain_outbox','post_translations_cache'])await env.DB.prepare(`DELETE FROM ${name}`).run();
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
  const url=String(input instanceof Request?input.url:input);
  if(url.endsWith('/posts-manifest.json'))return Response.json({items:published?[{...source,path:`/posts/2026/${encodeURIComponent(source.slug)}.md`,published:true}]:[]});
  if(url.startsWith('https://public.test/posts/'))return new Response(`---\ntitle: "${source.title}"\ndescription: "${source.description}"\ndefaultLanguage: ko\n---\n${source.content}`,{headers:{'Content-Type':'text/markdown'}});
  throw new Error('Unexpected upstream fetch');
 });
});
afterEach(()=>vi.restoreAllMocks());
describe('A02 translation HTTP contracts',()=>{
 it('returns 202, a durable job, safe URLs and Retry-After',async()=>{
  const response=await request();const value=await response.json() as any;
  expect(response.status).toBe(202);expect(value.job.status).toBe('deferred');expect(response.headers.get('X-Translation-Job-Id')).toBe(value.job.id);
  expect(response.headers.get('Location')).toBe(`${value.job.statusUrl}?jobId=${value.job.id}`);expect(response.headers.get('Retry-After')).toBeTruthy();
 });
 it('public GET and cache aliases join one job',async()=>{
  const a=await(await request()).json() as any;const b=await(await request('/cache')).json() as any;expect(a.job.id).toBe(b.job.id);
 });
 it('read-only cache lookup cannot create work',async()=>{
  expect((await request('?observe=true')).status).toBe(404);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_jobs').first<{n:number}>())?.n).toBe(0);
 });
 it('public status is readable without user credentials',async()=>{
  const a=await(await request()).json() as any;const result=await request(`/status?jobId=${a.job.id}`);
  expect(result.status).toBe(200);expect((await result.json() as any).data.job.id).toBe(a.job.id);
 });
 it('public status cannot expose a now-private source',async()=>{
  const a=await(await request()).json() as any;published=false;expect((await request(`/status?jobId=${a.job.id}`)).status).toBe(404);
 });
 it('unknown and malformed job identifiers have distinct 404/400 responses',async()=>{
  expect((await request('/status?jobId=missing')).status).toBe(404);expect((await request('/status?jobId=bad%0Aj')).status).toBe(400);
 });
 it('internal generation remains authenticated',async()=>{
  const result=await app().fetch(new Request(`https://api.test/api/v1/internal/posts/2026/${encodeURIComponent(source.slug)}/translations/en/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),bindings(),createExecutionContext());
  expect(result.status).toBe(401);
 });
 it('a member cannot approve a new paid revision',async()=>{
  const token=await signJwt({sub:'member',role:'user',type:'access',username:'Member'},bindings());
  const result=await app().fetch(new Request(`https://api.test/api/v1/internal/posts/2026/${encodeURIComponent(source.slug)}/translations/en/generate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({forceRefresh:true})}),bindings(),createExecutionContext());
  expect(result.status).toBe(403);
 });
 it('admin cache invalidation preserves the audit job',async()=>{
  const a=await(await request()).json() as any;
  const token=await signJwt({sub:'admin',role:'admin',type:'access',username:'Admin',emailVerified:true},bindings());
  const result=await app().fetch(new Request(`https://api.test/api/v1/internal/posts/2026/${encodeURIComponent(source.slug)}/translations/en/cache`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}),bindings(),createExecutionContext());
  expect(result.status).toBe(200);expect((await env.DB.prepare('SELECT status FROM translation_jobs WHERE id=?').bind(a.job.id).first<{status:string}>())?.status).toBe('failed');
 });
});
