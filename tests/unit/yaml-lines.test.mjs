import assert from 'node:assert/strict';
import test from 'node:test';
import {topLevelScalar,mappingUnder,listUnder,listItemBlocks,setBlockScalar,insertBlockScalar} from '../../skills/agrimap-agent-skills/scripts/yaml-lines.mjs';

const TASKS=[
  'schema: task-manifest@1 # manifest',
  'project:',
  '  id: "demo-pack"',
  "  version: '1.0.0'",
  '  nested:',
  '    deep: ignored',
  'read_order:',
  '  - 00-source-of-truth/SPEC.md',
  '  - REQUIREMENTS.yaml',
  'tags: [fe, "be"]',
  'tasks:',
  '  - id: FE-001',
  '    title: Login form',
  '    status: delivered # shipped',
  '    acceptance:',
  '      - AC-LOGIN-001',
  '  - id: FE-002',
  '    title: "Registry summary: totals"',
  '    status: planned',
  '',
  '  - id: FE-003',
  '    title: Export',
  'execution_packets:',
  '  - id: EP-1',
  '',
].join('\n');

test('scalars, mappings and lists of the supported subset',()=>{
  assert.deepEqual(topLevelScalar(TASKS,'schema'),{ok:true,value:'task-manifest@1',line:1});
  assert.deepEqual(mappingUnder(TASKS,'project').value,{id:'demo-pack',version:'1.0.0'});
  assert.deepEqual(listUnder(TASKS,'read_order').value,['00-source-of-truth/SPEC.md','REQUIREMENTS.yaml']);
  assert.deepEqual(listUnder(TASKS,'tags').value,['fe','be']);
  assert.equal(topLevelScalar(TASKS,'missing').value,null);
});

test('list item blocks end at the next item or a less indented key',()=>{
  const {ok,blocks}=listItemBlocks(TASKS,'tasks');
  assert.equal(ok,true);
  assert.deepEqual(blocks.map(b=>[b.id,b.startLine,b.endLine]),[['FE-001',12,16],['FE-002',17,19],['FE-003',21,22]]);
  assert.equal(blocks[0].fields.status.value,'delivered');
  assert.equal(blocks[1].fields.title.value,'Registry summary: totals');
  assert.equal(blocks[2].fields.status,undefined);
  assert.equal(blocks[0].fieldIndent,4);
});

test('setBlockScalar changes one line and keeps the trailing comment and quotes',()=>{
  const blocks=listItemBlocks(TASKS,'tasks').blocks;
  const first=setBlockScalar(TASKS,blocks[0],'status','done');
  assert.equal(first.edit.after,'    status: done # shipped');
  const second=setBlockScalar(TASKS,blocks[1],'title','New title');
  assert.equal(second.edit.after,'    title: "New title"');
  const changed=first.text.split('\n').filter((line,index)=>line!==TASKS.split('\n')[index]);
  assert.deepEqual(changed,['    status: done # shipped']);
});

test('insertBlockScalar adds the field under the id line with the field indent',()=>{
  const block=listItemBlocks(TASKS,'tasks').blocks[2];
  const result=insertBlockScalar(TASKS,block,'status','in-progress');
  assert.equal(result.edit.line,22);
  assert.equal(result.text.split('\n')[21],'    status: in-progress');
  assert.equal(listItemBlocks(result.text,'tasks').blocks[2].fields.status.value,'in-progress');
});

test('CRLF files round-trip with their line ending',()=>{
  const crlf=TASKS.replaceAll('\n','\r\n');
  const block=listItemBlocks(crlf,'tasks').blocks[1];
  const result=setBlockScalar(crlf,block,'status','delivered');
  assert.equal(result.text,crlf.replace('    status: planned\r\n','    status: delivered\r\n'));
  assert.ok(!/[^\r]\n/.test(result.text));
});

test('unsupported constructs fail only for that construct',()=>{
  const tabbed=TASKS.replace('    title: Export','\ttitle: Export');
  const failed=listItemBlocks(tabbed,'tasks');
  assert.equal(failed.ok,false);assert.equal(failed.code,'ADAPTER_PARSE_FAILED');assert.equal(failed.line,22);
  assert.equal(topLevelScalar(tabbed,'schema').ok,true);
  const block=TASKS.replace('    status: planned','    status: |');
  const parsed=listItemBlocks(block,'tasks');
  assert.equal(parsed.ok,true);
  assert.equal(parsed.blocks[1].fields.status.unsupported,'block scalar');
  assert.equal(setBlockScalar(block,parsed.blocks[1],'status','done').code,'ADAPTER_PARSE_FAILED');
  assert.equal(topLevelScalar('anchor: &a x\n','anchor').code,'ADAPTER_PARSE_FAILED');
});
