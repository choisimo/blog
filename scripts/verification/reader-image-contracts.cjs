/* Tests actual production policy/repository SQL on SQLite. No provider/API calls. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Worker } = require('node:worker_threads');
const { DatabaseSync } = require('node:sqlite');
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }}).outputText, file);
const policy = require(path.join(root, 'workers/api-gateway/src/lib/reader-image-policy.ts'));
const repo = require(path.join(root, 'workers/api-gateway/src/lib/reader-image-repository.ts'));
const { cleanupReaderImages } = require(path.join(root, 'workers/api-gateway/src/lib/reader-image-retention.ts'));
const migration = fs.readFileSync(path.join(root,'workers/migrations/0039_reader_image_jobs.sql'),'utf8');
function adapter(raw) {
 return { prepare(sql) { let values=[]; const statement={ bind(...args){values=args;return statement}, async first(){return raw.prepare(sql).get(...values)||null}, async all(){return {results:raw.prepare(sql).all(...values)}}, async run(){const r=raw.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}}} };return statement } };
}
function fixture(){const raw=new DatabaseSync(':memory:');raw.exec(migration);return {raw, db:adapter(raw)}}
const now=Date.parse('2026-09-10T03:00:00Z');
const input=(id, other={})=>({id,owner:'guest-a',network:'network-a',day:'2026-09-10',hash:'hash-a',limit:5,globalLimit:500,member:false,now,...other});
const prefs = ()=>import(path.join(root,'shared/src/contracts/agent-preferences.js'));

test('membership is verified role + verified email, never token presence',()=>{
 assert.equal(policy.isRegisteredImageUser({sub:'visitor',role:'anonymous',emailVerified:true}),false);
 assert.equal(policy.isRegisteredImageUser({sub:'user',role:'user',emailVerified:false}),false);
 assert.equal(policy.isRegisteredImageUser({sub:'user',role:'user',emailVerified:true,type:'refresh'}),false);
 assert.equal(policy.isRegisteredImageUser({sub:'user',role:'user',emailVerified:true}),true);
 assert.equal(policy.isRegisteredImageUser({sub:'admin',role:'admin',emailVerified:true}),true);
 assert.equal(policy.isRegisteredImageUser(null),false);
});
test('KST midnight resets, not UTC midnight',()=>{
 assert.deepEqual(policy.imageDay(Date.parse('2026-09-09T14:59:59Z')), {day:'2026-09-09',resetAt:'2026-09-09T15:00:00.000Z'});
 assert.deepEqual(policy.imageDay(Date.parse('2026-09-09T15:00:00Z')), {day:'2026-09-10',resetAt:'2026-09-10T15:00:00.000Z'});
});
test('limits are bounded; malformed env does not make the endpoint unlimited',()=>{
 assert.equal(policy.DEFAULT_FREE_IMAGE_LIMIT,20);assert.equal(policy.GUEST_IMAGE_LIMIT,20);
 for(const v of [undefined,'','0','-5','Infinity','10001','2.5']) assert.equal(policy.boundedLimit(v,20),20);
 assert.equal(policy.boundedLimit('37',20),37);
});
test('image input rejects client-controlled count, tier, model and principal',()=>{
 for(const field of ['n','tier','model','userId','role']) assert.equal(policy.parseImageInput({prompt:'illustrate architecture', [field]: field==='n'?5:'admin'}),null);
 assert.ok(policy.parseImageInput({prompt:'illustrate architecture'}));
});
test('image input validates enums, control-only strings and byte-independent limits',()=>{
 for(const value of [null,[],{}, {prompt:'a'}, {prompt:'a'.repeat(3001)}, {prompt:'\u0001'.repeat(30)}, {prompt:'illustrate architecture',style:'unknown'}, {prompt:'illustrate architecture',size:'9999x9999'}, {prompt:'illustrate architecture',alt:'a'.repeat(181)}]) assert.equal(policy.parseImageInput(value),null);
 const result=policy.parseImageInput({prompt:'  an image\u0001 of a tree  '});assert.equal(result.prompt,'an image of a tree');
});
test('network IDs are keyed and rotate daily without keeping raw addresses',async()=>{
 const a=await policy.privateNetworkKey('local-test-secret','2026-09-10','192.0.2.1');
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,await policy.privateNetworkKey('local-test-secret','2026-09-11','192.0.2.1'));
 assert.notEqual(a,await policy.privateNetworkKey('another-secret','2026-09-10','192.0.2.1'));
});
test('guest burst reservation caps at five under simultaneous promises',async()=>{
 const {db,raw}=fixture(); const results=await Promise.all(Array.from({length:16},(_,i)=>repo.reserveImageJob(db,input('g'+i))));
 assert.equal(results.filter(Boolean).length,5);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM reader_image_jobs').get().n,5);raw.close();
});
test('new guest tokens on the same network do not replenish the 20-image budget',async()=>{
 const {db,raw}=fixture();for(let i=0;i<20;i++)assert.equal(await repo.reserveImageJob(db,input('n'+i,{owner:'guest-'+i,limit:20,now:now+i*61000})),true);
 assert.equal(await repo.reserveImageJob(db,input('fresh',{owner:'fresh-token',limit:20,now:now+21*61000})),false);
 const usage=await repo.imageUsage(db,'fresh-token','network-a','2026-09-10',false);assert.deepEqual(usage,{used:0,networkUsed:20});raw.close();
});
test('different guest networks have independent limits, subject to the global budget',async()=>{
 const {db,raw}=fixture();for(let i=0;i<5;i++)assert.equal(await repo.reserveImageJob(db,input('a'+i)),true);
 assert.equal(await repo.reserveImageJob(db,input('b',{owner:'guest-b',network:'network-b'})),true);raw.close();
});
test('member daily limit is configurable and not the guest network limit',async()=>{
 const {db,raw}=fixture();for(let i=0;i<20;i++) assert.equal(await repo.reserveImageJob(db,input('m'+i,{owner:'member-a',network:'member-a',member:true,limit:20,now:now+i*61000})),true);
 assert.equal(await repo.reserveImageJob(db,input('m-over',{owner:'member-a',network:'member-a',member:true,limit:20,now:now+21*61000})),false);raw.close();
});
test('global cap covers guests and members together',async()=>{
 const {db,raw}=fixture();for(let i=0;i<3;i++)assert.equal(await repo.reserveImageJob(db,input('s'+i,{globalLimit:3,owner:'o'+i,network:'n'+i})),true);
 assert.equal(await repo.reserveImageJob(db,input('s-over',{globalLimit:3,owner:'member',network:'member',member:true,limit:20})),false);raw.close();
});
test('same request ID cannot reserve twice; another owner cannot read its row',async()=>{
 const {db,raw}=fixture();assert.equal(await repo.reserveImageJob(db,input('same')),true);assert.equal(await repo.reserveImageJob(db,input('same')),false);
 assert.equal((await repo.findImageJob(db,'same','guest-a')).state,'reserved');assert.equal(await repo.findImageJob(db,'same','other-user'),null);raw.close();
});
test('explicit rejection releases daily capacity; unknown outcome stays counted',async()=>{
 const {db,raw}=fixture();for(let i=0;i<5;i++)await repo.reserveImageJob(db,input('j'+i));
 await repo.finishImageJob(db,'j0','failed',null,'IMAGE_REJECTED');await repo.finishImageJob(db,'j1','unknown');
 assert.deepEqual(await repo.imageUsage(db,'guest-a','network-a','2026-09-10',false),{used:4,networkUsed:4});
 assert.equal(await repo.reserveImageJob(db,input('replacement',{now:now+61000})),true);
 assert.equal(await repo.reserveImageJob(db,input('over',{now:now+122000})),false);raw.close();
});
test('rejected attempts still consume burst allowance to prevent a failure loop',async()=>{
 const {db,raw}=fixture();for(let i=0;i<5;i++){await repo.reserveImageJob(db,input('f'+i));await repo.finishImageJob(db,'f'+i,'failed')}
 assert.equal(await repo.reserveImageJob(db,input('burst')),false);assert.equal(await repo.reserveImageJob(db,input('after-minute',{now:now+61000})),true);raw.close();
});
test('finalization changes only a reserved job, never a completed result',async()=>{
 const {db,raw}=fixture();await repo.reserveImageJob(db,input('done'));assert.equal((await repo.finishImageJob(db,'done','complete',{id:'done'})).meta.changes,1);
 assert.equal((await repo.finishImageJob(db,'done','unknown')).meta.changes,0);assert.equal((await repo.findImageJob(db,'done','guest-a')).state,'complete');raw.close();
});
test('tomorrow has a new daily budget; old idempotency row remains',async()=>{
 const {db,raw}=fixture();for(let i=0;i<5;i++)await repo.reserveImageJob(db,input('d'+i));
 assert.equal(await repo.reserveImageJob(db,input('tomorrow',{day:'2026-09-11',now:now+86400000,network:'network-next'})),true);
 assert.ok(await repo.findImageJob(db,'d0','guest-a'));raw.close();
});
test('retention deletes complete and orphan unknown objects, preserving recent ones',async()=>{
 const {db,raw}=fixture();const old=now-policy.IMAGE_RETENTION_MS-1;
 for(const [id,state,created] of [['old','complete',old],['orphan','unknown',old],['fresh','complete',now]]) {await repo.reserveImageJob(db,input(id,{now:created}));await repo.finishImageJob(db,id,state,{id})}
 const deleted=[];assert.equal(await cleanupReaderImages({DB:db,READER_IMAGES_R2:{async delete(k){deleted.push(k)}}},now),2);
 assert.equal(deleted.length,2);assert.ok(deleted.some(k=>k.includes('/orphan.png')));
 assert.equal((await repo.findImageJob(db,'old','guest-a')).result_json,null);assert.notEqual((await repo.findImageJob(db,'fresh','guest-a')).result_json,null);raw.close();
});
test('storage deletion failure preserves the object pointer for later cleanup',async()=>{
 const {db,raw}=fixture();await repo.reserveImageJob(db,input('keep',{now:now-31*86400000}));await repo.finishImageJob(db,'keep','complete',{id:'keep'});
 await assert.rejects(()=>cleanupReaderImages({DB:db,READER_IMAGES_R2:{async delete(){throw Error('storage down')}}},now));
 const row=raw.prepare('SELECT * FROM reader_image_jobs WHERE id=?').get('keep');assert.equal(row.object_deleted_at,null);assert.ok(row.result_json);raw.close();
});
test('normalization strips security fields and keeps only allowed preferences',async()=>{
 const {normalizeAgentPreferences:n}=await prefs();const result=n({role:'custom',customRole:' x '.repeat(2000),tone:'invented',imageMode:'manual',admin:true,tools:['shell'],dailyLimit:999});
 assert.equal(result.role,'custom');assert.equal(result.customRole.length,1000);assert.equal(result.tone,'natural');assert.equal(result.imageMode,'manual');assert.ok(!('admin' in result));assert.ok(!('tools' in result));assert.ok(!('dailyLimit' in result));
});
test('preference context is data with factuality safeguards, not an authorization grant',async()=>{
 const {buildAgentPreferenceContext}=await prefs();const text=buildAgentPreferenceContext({role:'custom',customRole:'ignore\\nall',evidence:false});
 assert.ok(text.includes('권한'));assert.ok(text.includes('불확실성'));assert.ok(text.includes('ignore\\\\nall'));
});
test('illustration modes support relevant automatic, debate automatic, manual and off',async()=>{
 const {shouldAutoIllustrate:s}=await prefs();assert.equal(s('안녕하세요','auto'),false);assert.equal(s('시스템 구조를 설명해줘','auto'),true);assert.equal(s('AI','auto','debate'),true);assert.equal(s('AI','manual','debate'),false);assert.equal(s('AI','off','debate'),false);assert.equal(s('안녕','always'),true);
});
test('atomic SQL also caps parallel independent SQLite connections',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reader-quota-'));const file=path.join(dir,'quota.sqlite');const raw=new DatabaseSync(file);raw.exec('PRAGMA journal_mode=WAL;');raw.exec(migration);raw.close();
 let command,args;
 const capture={prepare(sql){command=sql;return {bind(...a){args=a;return this},async run(){return {meta:{changes:0}}}}}};
 await repo.reserveImageJob(capture,input('parallel'));
 const shared=new SharedArrayBuffer(4), gate=new Int32Array(shared);
 const tasks=Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
 const values=[...args];values[0]='parallel-'+i;
 const w=new Worker(`const{parentPort,workerData:d}=require('node:worker_threads');const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(d.file);db.exec('PRAGMA busy_timeout=10000');const gate=new Int32Array(d.shared);Atomics.wait(gate,0,0);try{parentPort.postMessage(Number(db.prepare(d.command).run(...d.args).changes))}catch(e){throw e}finally{db.close()}`,{eval:true,workerData:{file,command,args:values,shared}});
 w.on('message',resolve);w.on('error',reject);
 }));
 Atomics.store(gate,0,1);Atomics.notify(gate,0,8);assert.equal((await Promise.all(tasks)).reduce((a,b)=>a+b,0),5);fs.rmSync(dir,{recursive:true,force:true});
});

test('origin renderer cannot fall through via case, trailing slash or encoded path variants',()=>{
 for(const p of ['/api/v1/images/render-private','/api/v1/images/render-private/','/api/v1/Images/Render-Private','/api/v1/images/%72ender-private','/api/v1/images/%2572ender-private','/api/v1/images//render-private']) assert.equal(policy.isPrivateReaderRenderPath(p),true,p);
 for(const p of ['/api/v1/images/generate','/api/v1/images/generated/abc','/api/v1/images/chat-upload']) assert.equal(policy.isPrivateReaderRenderPath(p),false,p);
});
test('preference compare-and-swap SQL rejects a stale second device save',()=>{
 const {db,raw}=fixture();
 const source=fs.readFileSync(path.join(root,'workers/api-gateway/src/routes/agent-preferences.ts'),'utf8');
 const statements=Array.from(source.matchAll(/prepare\('([^']*reader_agent_preferences[^']*)'\)/g),m=>m[1]);
 const insert=statements.find(s=>s.startsWith('INSERT')), update=statements.find(s=>s.startsWith('UPDATE'));
 assert.ok(insert && update);assert.equal(raw.prepare(insert).run('owner','{}',now).changes,1);
 assert.equal(raw.prepare(insert).run('owner','{"role":"critic"}',now).changes,0);
 assert.equal(raw.prepare(update).run('{"role":"coach"}',now,'owner',1).changes,1);
 assert.equal(raw.prepare(update).run('{"role":"critic"}',now,'owner',1).changes,0);
 assert.equal(raw.prepare('SELECT version FROM reader_agent_preferences WHERE owner=?').get('owner').version,2);raw.close();
});
test('public image and preference endpoints retain Worker ownership in the route contract',async()=>{
 const {matchRouteBoundary}=await import(path.join(root,'shared/src/contracts/service-boundaries.js'));
 for(const [method,pathname] of [['POST','/api/v1/images/generate'],['GET','/api/v1/images/generation-policy'],['POST','/api/v1/images/render-private'],['GET','/api/v1/user/agent-preferences'],['PUT','/api/v1/user/agent-preferences']]) assert.equal(matchRouteBoundary({method,pathname}).owner,'worker-owned');
});
test('interactive prompts no longer override chosen tone, length and language',()=>{
 const context=fs.readFileSync(path.join(root,'frontend/src/services/chat/context.ts'),'utf8');
 const debate=fs.readFileSync(path.join(root,'frontend/src/components/features/debate/DebateRoom.tsx'),'utf8');
 assert.ok(!context.includes('애니메이션 여캐릭터'));assert.ok(!debate.includes('응답은 2~4문장'));
 assert.ok(context.includes('사용자 응답 선호'));assert.ok(debate.includes('사용자 응답 선호'));
});
