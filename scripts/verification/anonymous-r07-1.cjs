#!/usr/bin/env node
// Dependency-light continuation checks. These are not the full Workers/Vitest suite.
const {spawnSync}=require('node:child_process');const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',
 'scripts/verification/r07-1/server.test.cjs','scripts/verification/r07-1/client.test.mjs','scripts/verification/r07-1/principal.test.cjs'],
 {cwd:root,stdio:'inherit',timeout:90000,env:process.env});
if(result.error)throw result.error;process.exitCode=result.status??1;
