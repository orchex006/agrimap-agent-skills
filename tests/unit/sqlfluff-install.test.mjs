import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {installSqlfluff,SQLFLUFF_VERSION} from '../../skills/agrimap-agent-skills/scripts/install-sqlfluff.mjs';
const versionResult = version => ({status:0,stdout:`sqlfluff, version ${version}`});

test('matching locked executable avoids all package mutations',()=>{
 const calls=[];const result=installSqlfluff({run(command,args){calls.push([command,...args]);return versionResult(SQLFLUFF_VERSION);}});
 assert.equal(result.changed,false);assert.equal(result.expectedVersion,SQLFLUFF_VERSION);assert.deepEqual(calls,[['sqlfluff','--version']]);
});
for(const initial of [null,'1.0.0','99.0.0']) test(`aligns missing or mismatched SQLFluff ${initial} to exact pin`,()=>{
 let installed=false;const calls=[];
 const result=installSqlfluff({run(command,args){calls.push([command,...args]);if(command==='sqlfluff')return installed?versionResult(SQLFLUFF_VERSION):initial?versionResult(initial):{status:null,error:new Error('ENOENT')};installed=true;return {status:0};}});
 assert.equal(result.changed,true);assert.equal(result.version,`sqlfluff, version ${SQLFLUFF_VERSION}`);
 assert.deepEqual(calls[1],['python','-m','pip','install','--upgrade',`sqlfluff==${SQLFLUFF_VERSION}`]);
 assert.equal(calls.length,3);
});
test('falls back to another Python entrypoint',()=>{
 let installed=false;const calls=[];
 installSqlfluff({run(command,args){calls.push([command,...args]);if(command==='sqlfluff')return installed?versionResult(SQLFLUFF_VERSION):{status:127};if(command==='python')return {status:1};installed=true;return {status:0};}});
 assert.deepEqual(calls[2],['py','-m','pip','install','--upgrade',`sqlfluff==${SQLFLUFF_VERSION}`]);
});
test('successful pip exit cannot hide a wrong PATH executable',()=>{
 assert.throws(()=>installSqlfluff({run(command){return command==='sqlfluff'?versionResult('1.0.0'):{status:0};}}),error=>error.code==='SQLFLUFF_INSTALL_FAILED' && error.attempts.length===7);
});
test('unavailable installers fail with evidence',()=>{
 assert.throws(()=>installSqlfluff({run(){return {status:null,error:new Error('ENOENT')};}}),error=>error.code==='SQLFLUFF_INSTALL_FAILED' && error.attempts.length===4);
});
test('tool lock is versioned with package and distributed byte-exactly',async()=>{
 const source=new URL('../../skills/agrimap-agent-skills/assets/tool-versions.json',import.meta.url);
 const bytes=await readFile(source);const lock=JSON.parse(bytes);
 const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url)));
 assert.equal(lock.skillVersion,pkg.version);assert.equal(lock.sqlfluff.version,SQLFLUFF_VERSION);
 assert.deepEqual(bytes,await readFile(new URL('../../plugins/agrimap-agent-skills/skills/agrimap-agent-skills/assets/tool-versions.json',import.meta.url)));
});
