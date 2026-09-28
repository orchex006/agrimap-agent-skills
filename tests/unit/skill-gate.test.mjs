// Claude PreToolUse skill gate (4.9.5): lane skill before editing AgriMap code/SQL.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {initRepo} from '../helpers/git-fixture.mjs';
import {acceptedSkills,evaluateWrite,skillLoaded} from '../../skills/agrimap-agent-skills/scripts/skill-gate.mjs';
import {loadRouting} from '../../skills/agrimap-agent-skills/scripts/skill-routing.mjs';

const gate=path.join(projectRoot,'skills/agrimap-agent-skills/scripts/skill-gate.mjs');
const routing=loadRouting();
async function fixture(t){const h=await createHarness('agrimap-gate-');t.after(()=>h.cleanup());return h;}
const line=value=>JSON.stringify(value)+'\n';
const skillCall=skill=>line({type:'assistant',message:{content:[{type:'tool_use',id:'t1',name:'Skill',input:{skill}}]}});
const hookText=line({type:'attachment',content:'Skill for this turn: agrimap-agent-skills:agm-sql (lane sql). Load it before the first answer.'});

test('evidence of a loaded skill: Skill call, slash command or entrypoint read; hook text never counts',()=>{
 const sql=acceptedSkills(routing,'sql');
 assert.deepEqual(sql,['agm-sql','agm-exec']);
 assert.equal(skillLoaded(skillCall('agrimap-agent-skills:agm-sql'),sql),true);
 assert.equal(skillLoaded(skillCall('agrimap-agent-skills:agm-exec'),sql),true);
 assert.equal(skillLoaded(skillCall('agrimap-agent-skills:agm-be'),sql),false);
 assert.equal(skillLoaded(line({type:'user',message:{content:'<command-name>/agrimap-agent-skills:agm-sql</command-name>'}}),sql),true);
 assert.equal(skillLoaded(line({type:'assistant',message:{content:[{type:'tool_use',name:'Read',input:{file_path:'C:\\plugins\\skills\\agrimap-agent-skills\\references\\operations\\sql.md'}}]}}),sql),true);
 assert.equal(skillLoaded(hookText,sql),false);
});

test('gate denies an AgriMap SQL edit once without the lane skill, then allows the retry',async t=>{
 const h=await fixture(t);
 const repo=await initRepo(path.join(h.temp,'agmws-orders-netcore'));
 const transcript=path.join(h.temp,'transcript.jsonl');
 await writeFile(transcript,hookText);
 const session=`gate-${randomUUID()}`;
 const file=path.join(repo,'sql/ORDER/procedure/ORDER_H_I.sql');
 const first=await evaluateWrite({filePath:file,transcriptPath:transcript,session,routing});
 assert.match(first.reason,/^AGM_SKILL_GATE\[sql\]: sql\/ORDER\/procedure\/ORDER_H_I\.sql is sql work/);
 assert.match(first.reason,/agrimap-agent-skills:agm-sql/);
 assert.equal(await evaluateWrite({filePath:file,transcriptPath:transcript,session,routing}),null,'second attempt is allowed');
 const other=`gate-${randomUUID()}`;
 const be=await evaluateWrite({filePath:path.join(repo,'Controllers/OrderController.cs'),transcriptPath:transcript,session:other,routing});
 assert.match(be.reason,/AGM_SKILL_GATE\[be\].*be-main work.*agm-be/);
 await writeFile(transcript,hookText+skillCall('agrimap-agent-skills:agm-be'));
 assert.equal(await evaluateWrite({filePath:path.join(repo,'Services/OrderService.cs'),transcriptPath:transcript,session:`gate-${randomUUID()}`,routing}),null);
});

test('gate resolves a Windows 8.3 short path to the same repository file (CI temp dirs)',async t=>{
 if(process.platform!=='win32')return t.skip('Windows only');
 const h=await fixture(t);
 const repo=await initRepo(path.join(h.temp,'agmws-orders-netcore'));
 const transcript=path.join(h.temp,'transcript.jsonl');await writeFile(transcript,hookText);
 const short=spawnSync('cmd',['/d','/s','/c',`for %I in ("${repo}") do @echo %~sI`],{encoding:'utf8',windowsVerbatimArguments:true}).stdout.trim();
 if(!short||short.toLowerCase()===repo.toLowerCase())return t.skip('8.3 names unavailable');
 const verdict=await evaluateWrite({filePath:path.join(short,'sql','X_I.sql'),transcriptPath:transcript,session:`gate-${randomUUID()}`,routing});
 assert.match(verdict?.reason||'',/AGM_SKILL_GATE\[sql\]: sql\/X_I\.sql is sql work/);
});

test('gate stays out of non-code paths, non-AgriMap repositories, the skill package and opted-out projects',async t=>{
 const h=await fixture(t);
 const transcript=path.join(h.temp,'transcript.jsonl');await writeFile(transcript,hookText);
 const repo=await initRepo(path.join(h.temp,'agmws-orders-netcore'));
 const allow=async(filePath)=>assert.equal(await evaluateWrite({filePath,transcriptPath:transcript,session:`gate-${randomUUID()}`,routing}),null,filePath);
 await allow(path.join(repo,'README.md'));
 await allow(path.join(repo,'.agrimap-agent/knowledge/references/db-schema/X.sql'));
 await allow(path.join(repo,'Jenkinsfile'));
 const plain=await initRepo(path.join(h.temp,'some-tool'));
 await allow(path.join(plain,'src/index.ts'));
 await allow(path.join(h.temp,'not-a-repo','x.sql'));
 await mkdir(path.join(repo,'.agrimap-agent'),{recursive:true});
 await writeFile(path.join(repo,'.agrimap-agent/config.json'),JSON.stringify({governance:{skillGate:false}}));
 await allow(path.join(repo,'sql/ORDER/procedure/ORDER_H_I.sql'));
 const pkg=await initRepo(path.join(h.temp,'agrimap-agent-skills'));
 await writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'agrimap-agent-skills'}));
 await allow(path.join(pkg,'skills/x.sql'));
 // Missing transcript fails open.
 assert.equal(await evaluateWrite({filePath:path.join(await initRepo(path.join(h.temp,'agmwa-shop-ng')),'src/app/a.ts'),transcriptPath:path.join(h.temp,'missing.jsonl'),session:`gate-${randomUUID()}`,routing}),null);
});

test('gate CLI emits a PreToolUse deny and fails open on bad input',async t=>{
 const h=await fixture(t);
 const repo=await initRepo(path.join(h.temp,'agmwa-shop-ng'));
 const transcript=path.join(h.temp,'transcript.jsonl');await writeFile(transcript,hookText);
 const out=h.spawn(gate,['--provider','claude'],{session_id:`gate-${randomUUID()}`,transcript_path:transcript,hook_event_name:'PreToolUse',tool_name:'Write',tool_input:{file_path:path.join(repo,'src/app/order/order.component.ts'),content:'x'}});
 assert.equal(out.status,0);
 const decision=JSON.parse(out.stdout).hookSpecificOutput;
 assert.equal(decision.permissionDecision,'deny');assert.match(decision.permissionDecisionReason,/AGM_SKILL_GATE\[fe\].*agm-fe/);
 const bad=h.spawn(gate,['--provider','claude']);
 assert.equal(bad.status,0);assert.equal(bad.stdout,'');
});
