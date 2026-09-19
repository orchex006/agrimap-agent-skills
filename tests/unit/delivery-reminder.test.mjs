import assert from 'node:assert/strict';
import test from 'node:test';
import {writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {createGitFixture} from '../helpers/git-fixture.mjs';
import {initPolicy} from '../../skills/agrimap-agent-skills/scripts/workflow-policy.mjs';

const REMINDER=path.join(projectRoot,'skills/agrimap-agent-skills/scripts/delivery-reminder.mjs');

async function verifiedWork(t){
  const h=await createHarness('agm-reminder-');t.after(()=>h.cleanup());
  const {repo,git}=await createGitFixture(h,{name:'svc',files:{'AGENTS.md':'# Rules\n'}});
  git(['switch','-q','develop']);
  await initPolicy(repo,'gitflow',{},'owner');
  git(['add','--','.agrimap-agent']);git(['commit','-q','-m','chore: policy']);
  const cli=args=>JSON.parse(h.spawn(h.scripts.workspace,[...args,'--cwd',repo]).stdout);
  const c=cli(['context','--session','s1']);cli(['context','--session','s1','--ack',c.chain.filter(e=>c.readRequired.includes(e.relative)).map(e=>e.sha12).join(',')]);
  const started=cli(['start','--operation','execute','--session','s1','--requested-by','Tester','--title','Add export']);
  await writeFile(path.join(repo,'export.js'),'x\n');
  cli(['checkpoint','--session','s1','--execution',started.activeTask.executionId,'--event','verified','--summary','ok','--status','passed']);
  const stop=(extra={})=>spawnSync(process.execPath,[REMINDER,'--provider','claude'],{input:JSON.stringify({hook_event_name:'Stop',session_id:'s1',cwd:repo,stop_hook_active:false,...extra}),encoding:'utf8'});
  return {repo,cli,stop,executionId:started.activeTask.executionId};
}

test('verified but undelivered work blocks Stop once per execution (AC31)',async t=>{
  const {stop}=await verifiedWork(t);
  const first=stop();
  assert.deepEqual(JSON.parse(first.stdout),{decision:'block',reason:'AGM: work is verified but not delivered. Run deliver plan/apply per workflow policy, or tell the user why delivery is skipped.'});
  assert.equal(stop().stdout,'','second stop in the same execution does not block');
});

test('stop_hook_active never blocks; guards:false is a no-op; nothing to deliver does not block',async t=>{
  const {repo,stop}=await verifiedWork(t);
  assert.equal(stop({stop_hook_active:true}).stdout,'');
  const config=path.join(repo,'.agrimap-agent','config.json');
  await writeFile(config,JSON.stringify({governance:{guards:false}}));
  assert.equal(stop().stdout,'');
  await writeFile(config,JSON.stringify({governance:{}}));
  await writeFile(path.join(repo,'export.js'),'');
  const {rm}=await import('node:fs/promises');await rm(path.join(repo,'export.js'));
  assert.equal(stop().stdout,'','no own dirty path');
  assert.equal(stop({session_id:'other'}).stdout,'','no active execution');
});
