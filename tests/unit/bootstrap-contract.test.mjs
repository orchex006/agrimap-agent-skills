import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {projectRoot} from '../helpers/harness.mjs';

test('bootstrap preserves the complete owner-submitted canonical contract',async()=>{
  const bundle=path.join(projectRoot,'skills/agrimap-agent-skills/assets/bootstrap');
  const bytes=await readFile(path.join(bundle,'AGENTS.md'));
  // Approved source: owner submit 2026-09-08, missing-memory, owner-version and tracking revisions 2026-09-09. Updating this hash
  // requires an intentional new canonical contract, not a formatting repair.
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'65afd873b3b98fc36a94b25133a0fb485a24fbcdc06908f1f4aaa7f23ef168ae');
  const manifest=JSON.parse(await readFile(path.join(bundle,'manifest.json'),'utf8'));
  assert.equal(manifest.files.find(f=>f.source==='AGENTS.md').sha256,createHash('sha256').update(bytes).digest('hex'));
  for(const file of ['CLAUDE.md','GEMINI.md','CURSOR.md']){
    const pointer=await readFile(path.join(bundle,file),'utf8');
    assert.match(pointer,/@(?:\.\/)?AGENTS\.md/);
    assert.ok(pointer.split(/\r?\n/).length<12,'Keep the host file a thin pointer');
  }
});

test('release stages synchronize stale local branches and re-evaluate in one invocation',async()=>{
  const references=path.join(projectRoot,'skills/agrimap-agent-skills/references');
  const steps=await readFile(path.join(references,'release-steps.md'),'utf8');
  const workflow=await readFile(path.join(references,'release-workflow.md'),'utf8');
  assert.match(steps,/Synchronize only the branch needed by the current stage with its remote using fast-forward-only semantics/);
  assert.match(steps,/continue the same invocation instead of reporting the stale pre-sync mismatch/);
  assert.match(steps,/Do not advance jenkins-release merely to perform this readiness check/);
  assert.match(steps,/Remote divergence remains a blocker/);
  assert.match(workflow,/Before each stage, fetch and fast-forward-only synchronize the stage's local branch with its remote/);
  assert.match(workflow,/materially changed remote candidate, destination or tag requires a revised plan and confirmation/);
});


test('operation policy reaches every first-read adapter without leaking to unrelated skills', async()=>{
  const {renderAliasSkill,renderGeminiCommandPrompt,renderOperationEntrypoint,operationConfigIssues}=await import('../../tools/operation-entrypoints.mjs');
  const config=JSON.parse(await readFile(path.join(projectRoot,'config/operations.json'),'utf8'));
  const release=config.operations.find(item=>item.operation==='release');
  assert.ok(release.entrypointPolicy, 'Release authority must be available before reference loading');
  const renderers=[renderAliasSkill,renderGeminiCommandPrompt,renderOperationEntrypoint];
  for(const render of renderers){
    const output=render(release);
    assert.ok(output.includes(release.entrypointPolicy));
    const revised={...release,entrypointPolicy:'Owner supplied replacement policy'};
    assert.ok(render(revised).includes(revised.entrypointPolicy));
    assert.ok(!render(revised).includes(release.entrypointPolicy));
    const unrelated=config.operations.find(item=>item.operation!=='release');
    assert.ok(!render(unrelated).includes(release.entrypointPolicy));
  }
  const distributed=[
    'plugins/agrimap-agent-skills/skills/agm-release/SKILL.md',
    'skills/agrimap-agent-skills/references/operations/release.md',
    'commands/agm-release.toml'
  ];
  for(const file of distributed) assert.ok((await readFile(path.join(projectRoot,file),'utf8')).includes(release.entrypointPolicy),file);
  const invalid=structuredClone(config);
  invalid.operations.find(item=>item.operation==='release').entrypointPolicy=42;
  assert.ok(operationConfigIssues(invalid).some(issue=>issue.includes('entrypointPolicy')));
});
