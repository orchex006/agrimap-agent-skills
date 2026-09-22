import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {createGitFixture} from '../helpers/git-fixture.mjs';
import {splitCommands,gitInvocation,evaluate,guardCommand} from '../../skills/agrimap-agent-skills/scripts/git-guard.mjs';

const GUARD=path.join(projectRoot,'skills/agrimap-agent-skills/scripts/git-guard.mjs');
const ctx={protectedList:['main','develop','jenkins','jenkins-release','release/*'],currentBranch:'feature/x',release:false};
const verdict=(command,context=ctx)=>{
  let result=null;
  for(const segment of splitCommands(command)){const inv=gitInvocation(segment);if(!inv)continue;const v=evaluate(inv,context);if(v?.decision==='deny')return v;result||=v;}
  return result;
};
const rule=(command,context)=>verdict(command,context)?.rule||null;

test('G1 force and mirror pushes are denied in Bash and PowerShell forms',()=>{
  for(const command of ['git push --force origin feature/x','git push -f','git push -uf origin feature/x','git push --force-with-lease','git push --mirror','git push origin +feature/x','cd repo && git push -f','& git push --force origin feature/x','git -C D:/repo push --force']) assert.equal(rule(command),'G1',command);
  assert.equal(verdict('git push -u origin feature/x'),null);
});

test('G2 pushes to protected branches are denied outside a release execution',()=>{
  for(const command of ['git push origin develop','git push origin HEAD:develop','git push origin feature/x:refs/heads/main','git push origin release/4.9.0','echo ok; git push origin jenkins']) assert.equal(rule(command),'G2',command);
  assert.equal(rule('git push',{...ctx,currentBranch:'develop'}),'G2');
  assert.equal(rule('git push'),null);
  assert.equal(verdict('git push origin develop',{...ctx,release:true}),null,'release exception');
  assert.equal(rule('git push --force origin develop',{...ctx,release:true}),'G1','release never allows force');
});

test('G3 add-everything and .agrimap-agent/local are denied',()=>{
  for(const command of ['git add -A','git add --all','git add .','git add -- .','git add -- .agrimap-agent','git add -f .agrimap-agent/local/memory.md','git add .agrimap-agent/local']) assert.equal(rule(command),'G3',command);
  assert.equal(verdict('git add -- src/a.js .agrimap-agent/logs/2026-09/2026-09-19/1.jsonl'),null);
});

test('G4 and G6 ask; G5 deletes of protected branches and tags are denied',()=>{
  for(const command of ['git reset --hard','git clean -fd','git checkout -- .','git restore .']) assert.deepEqual([rule(command),verdict(command).decision],['G4','ask'],command);
  for(const command of ['git stash','git stash push -m x','git stash pop']) assert.deepEqual([rule(command),verdict(command).decision],['G6','ask'],command);
  for(const command of ['git stash list','git stash show']) assert.equal(verdict(command),null,command);
  for(const command of ['git branch -D develop','git push origin --delete main','git push origin :jenkins','git tag -d v1.0.0','git push origin --delete v4.9.0','git push origin :refs/tags/v1.0.0']) assert.deepEqual([rule(command),verdict(command).decision],['G5','deny'],command);
  assert.equal(verdict('git branch -D feature/old'),null);
  assert.equal(verdict('git push origin --delete feature/old'),null);
});

test('deny wins over ask in a chained command; quotes and redirections are parsed',()=>{
  assert.equal(rule('git stash; git push --force'),'G1');
  assert.equal(verdict('git commit -m "a; git push --force"'),null);
  assert.equal(verdict('git status 2>&1 | Select-String x'),null);
  assert.deepEqual(splitCommands('git add a.js `\n  b.js && git commit -m x'),['git add a.js    b.js','git commit -m x']);
});

test('hook: deny output for Claude, empty output on allow, fail-open on parse errors, guards:false is a no-op (AC13, AC30)',async t=>{
  const h=await createHarness('agm-guard-');t.after(()=>h.cleanup());
  const {repo}=await createGitFixture(h,{name:'svc'});
  const run=(command,extra={})=>spawnSync(process.execPath,[GUARD,'--provider','claude'],{input:JSON.stringify({hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command},cwd:repo,session_id:'s1',...extra}),encoding:'utf8'});
  const denied=run('git push origin develop');
  const output=JSON.parse(denied.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName,'PreToolUse');assert.equal(output.hookSpecificOutput.permissionDecision,'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason,/^AGM guard G2: push to protected branch develop/);
  assert.equal(run('git push -u origin feature/x').stdout,'');
  const broken=run('git push "unterminated');
  assert.equal(broken.stdout,'');assert.match(broken.stderr,/fail-open/);assert.equal(broken.status,0);
  await mkdir(path.join(repo,'.agrimap-agent','runtime','active'),{recursive:true});
  await writeFile(path.join(repo,'.agrimap-agent','runtime','active','s1.json'),JSON.stringify({executionId:'1',operation:'release'}));
  assert.equal(run('git push origin develop').stdout,'','release execution may push develop');
  await writeFile(path.join(repo,'.agrimap-agent','config.json'),JSON.stringify({governance:{guards:false}}));
  for(const command of ['git push --force origin develop','git add -A','git stash']) assert.equal(run(command).stdout,'',command);
  assert.equal(await guardCommand('git push --force',{cwd:repo}),null);
});
