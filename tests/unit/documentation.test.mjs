import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHarness,projectRoot} from '../helpers/harness.mjs';
import {validateDocumentation} from '../../tools/validate-docs.mjs';

test('distributed beginner docs have working links, supported commands and exact mirrors',async()=>{
  const result=await validateDocumentation(projectRoot);
  assert.deepEqual(result.errors,[]);
  assert.ok(result.files>=10);
});
test('documentation validation detects broken links, anchors, unsupported commands and mirror drift',async t=>{
  const h=await createHarness('agrimap-docs-');t.after(()=>h.cleanup());
  await mkdir(path.join(h.temp,'config'));await mkdir(path.join(h.temp,'docs'));
  await writeFile(path.join(h.temp,'config/operations.json'),JSON.stringify({operations:[{name:'agm-be',actions:[{name:'edit'}]}]}));
  await writeFile(path.join(h.temp,'README.md'),'# Home\n[Guide](docs/USAGE.md#good)\n');
  await writeFile(path.join(h.temp,'docs/USAGE.md'),'# Good\n`agm-be`\n```text\n$agm-be action=edit\n```\n');
  assert.equal((await validateDocumentation(h.temp,{mirrors:false})).ok,true);
  await writeFile(path.join(h.temp,'README.md'),'[Missing](missing.md)\n[Anchor](docs/USAGE.md#absent)\n```text\n$agm-be action=destroy\n$agm-missing\n```\n');
  const result=await validateDocumentation(h.temp);
  for(const issue of ['missing link','missing anchor','unsupported action','unknown example alias','stale documentation mirror'])assert.ok(result.errors.some(e=>e.includes(issue)),issue);
});
