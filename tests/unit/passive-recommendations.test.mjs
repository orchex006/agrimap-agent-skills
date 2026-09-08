import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {projectRoot,createHarness} from '../helpers/harness.mjs';
import {AGRIMAP_OPERATION_ALIASES} from '../../skills/agrimap-agent-skills/scripts/operation-aliases.mjs';

const removed=['agm-design','agm-simulate','agm-review','agm-history'];
test('removed operations have no distributed commands, alias skills or entrypoints',async()=>{
  const config=JSON.parse(await readFile(path.join(projectRoot,'config/operations.json'),'utf8'));
  assert.equal(config.operations.length,10);
  for(const alias of removed){
    assert.equal(AGRIMAP_OPERATION_ALIASES.includes(alias),false);
    for(const file of [`commands/${alias}.toml`,`plugins/agrimap-agent-skills/skills/${alias}/SKILL.md`,`skills/agrimap-agent-skills/references/operations/${alias.slice(4)}.md`]){
      assert.equal(await stat(path.join(projectRoot,file)).then(()=>true,()=>false),false,file);
    }
  }
});
test('passive recommendation contract is reachable in every remaining operation without extra action',async()=>{
  const config=JSON.parse(await readFile(path.join(projectRoot,'config/operations.json'),'utf8'));
  const map=JSON.parse(await readFile(path.join(projectRoot,'skills/agrimap-agent-skills/assets/passive-skill-map.json'),'utf8'));
  const design=map.capabilities.find(c=>c.id==='design-discipline');
  assert.equal(design.grantsProductWrite,false);
  assert.deepEqual(design.actions,['*']);
  assert.deepEqual([...design.operations].sort(),config.operations.map(o=>o.operation).sort());
  for(const operation of config.operations)assert.ok(operation.references.some(r=>r.path===design.reference),operation.name);
});
test('removed alias mentions do not implicitly activate hook in unrelated workspace',async t=>{
  const h=await createHarness('agrimap-removed-alias-');t.after(()=>h.cleanup());
  for(const alias of removed){
    const result=h.run(h.scripts.hook,['--provider','codex'],{cwd:h.temp,session_id:'one',hook_event_name:'UserPromptSubmit',prompt:'$'+alias});
    assert.equal(result.hookSpecificOutput,undefined,alias);
  }
});
