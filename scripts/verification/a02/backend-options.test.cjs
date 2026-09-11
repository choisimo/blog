const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {ts,root}=require('../r07-1/support.cjs');
// Execute the unchanged production /generate callback; Express, AI and the D1-backed
// idempotency wrapper are fixture boundaries. This is not the full HTTP router.
const filename=path.join(root,'backend/src/routes/ai.js');
const text=fs.readFileSync(filename,'utf8');
const ast=ts.createSourceFile(filename,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
let callback;
function visit(node){
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='router.post'&&node.arguments[0]?.text==='/generate')callback=node.arguments.at(-1).getText(ast);
 ts.forEachChild(node,visit);
}
visit(ast);assert.ok(callback,'production callback must exist');
function fixture(){
 const calls=[],identities=[];
 const handler=vm.runInNewContext(`(${callback})`,{
  AI_TEMPERATURES:{GENERATE:0.5},
  aiService:{async generate(prompt,options){calls.push({prompt,options});return 'answer'}},
  async runIdempotent(req,res,scope,payload,runner){identities.push(JSON.parse(JSON.stringify(payload)));const result=await runner();return res.status(result.statusCode).json(result.response)},
 });
 async function invoke(body){const result={status:200};const res={status(code){result.status=code;return this},json(value){result.body=value;return result}};await handler({body},res,error=>{throw error});return result;}
 return {calls,identities,invoke};
}
test('backend forwards stage token, model and remaining deadline options',async()=>{
 const f=fixture();assert.equal((await f.invoke({prompt:'title',maxTokens:256,timeout:7000,model:'fixture-model',systemPrompt:'translate'})).status,200);
 assert.equal(f.calls[0].options.maxTokens,256);assert.equal(f.calls[0].options.timeout,7000);assert.equal(f.calls[0].options.model,'fixture-model');assert.equal(f.calls[0].options.systemPrompt,'translate');
});
test('remaining deadline changes do not change the stage idempotency payload',async()=>{
 const f=fixture();await f.invoke({prompt:'same',maxTokens:256,timeout:9000});await f.invoke({prompt:'same',maxTokens:256,timeout:8000});assert.deepEqual(f.identities[0],f.identities[1]);
});
test('legacy plain prompts still use default generation settings',async()=>{
 const f=fixture();assert.equal((await f.invoke({prompt:'plain'})).status,200);assert.equal(f.calls[0].options.temperature,0.5);
});
for(const options of [{maxTokens:16001},{maxTokens:0},{maxTokens:1.5},{timeout:240001},{timeout:0},{model:{}},{systemPrompt:'a'.repeat(8001)}]){
 test('invalid generation options are rejected before invoking AI: '+Object.keys(options)[0]+' '+(typeof Object.values(options)[0]==='string'?'oversize':JSON.stringify(options)),async()=>{
  const f=fixture();assert.equal((await f.invoke({prompt:'sample',...options})).status,400);assert.equal(f.calls.length,0);assert.equal(f.identities.length,0);
 });
}
