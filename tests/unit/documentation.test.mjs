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

test('service URL matrix lists every service and job, loads automatically and holds no DB or IP data (4.9.7)',async()=>{
  const {readFile}=await import('node:fs/promises');
  const references=path.join(projectRoot,'skills/agrimap-agent-skills/references');
  const matrix=await readFile(path.join(references,'service-url-matrix.md'),'utf8');
  for(const name of ['agmws-plus-netcore','agmws-license-management-netcore','agmbo-cleansing-service-netcore','agmbo-cleansing-file-netcore','agmws-gateway-netcore','agmws-platform-proxy','agmbo-publisher-netcore-svc` (`agrimap-job`)'])assert.ok(matrix.includes(name),name);
  assert.doesNotMatch(matrix,/\b\d{1,3}(?:\.\d{1,3}){3}\b/,'no IP addresses');
  assert.doesNotMatch(matrix,/mongo|sql server|connection ?string=|password=|:27017|:6381|nas_media|nas01/i,'no database or storage endpoints');
  const operations=JSON.parse(await readFile(path.join(projectRoot,'config/operations.json'),'utf8')).operations;
  const loads=name=>operations.find(item=>item.name===name).conditionalReferences.some(item=>item.path==='service-url-matrix.md');
  for(const name of ['agm-be','agm-exec','agm-diagnose','agm-analyze'])assert.ok(loads(name),name);
  assert.match(await readFile(path.join(references,'application-url-matrix.md'),'utf8'),/\[service-url-matrix\.md\]\(service-url-matrix\.md\)/);
  assert.match(await readFile(path.join(references,'patterns/checklists/backend-main.md'),'utf8'),/service-url-matrix\.md/);
});
