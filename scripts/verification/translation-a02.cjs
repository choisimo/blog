#!/usr/bin/env node
'use strict';
// Dependency-light regression tests. Production SQL runs on SQLite, upstreams
// are fixtures. Full Hono/D1, Zod, React and staging validation are separate gates.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const suites=['server.test.cjs','observer.test.cjs','dispatch.test.mjs','backend-options.test.cjs'];
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...suites.map(name=>path.join(__dirname,'a02',name))],{
 cwd:root,stdio:'inherit',env:process.env,timeout:90000,
});
if(result.error){console.error(result.error);process.exitCode=1;}else process.exitCode=result.status??1;
