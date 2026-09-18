import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createHarness} from '../helpers/harness.mjs';
import {initRepo} from '../helpers/git-fixture.mjs';

const present=p=>stat(p).then(()=>true,()=>false);
async function fixture(t){const h=await createHarness('agm-chain-');t.after(()=>h.cleanup());return h;}
function cli(h,args,cwd=h.temp){const r=h.spawn(h.scripts.workspace,args,undefined,cwd);return JSON.parse(r.stdout);}
async function tree(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);out.push(p);if(e.isDirectory()&&e.name!=='.git')out.push(...await tree(p));}return out.sort();}

async function twoRepos(h){
  const parent=path.join(h.temp,'platform');
  const a=await initRepo(path.join(parent,'services','agmws-orders-netcore'));
  const b=await initRepo(path.join(parent,'apps','agmwa-dynamic-form-ng'));
  await writeFile(path.join(parent,'AGENTS.md'),'# Parent rules\n');
  await writeFile(path.join(a,'AGENTS.md'),'<!-- AGRIMAP BOOTSTRAP VERSION: 4.5.5 -->\n# Orders\n');
  await writeFile(path.join(a,'CLAUDE.md'),'@AGENTS.md\n');
  await writeFile(path.join(b,'AGENTS.md'),'<!-- AGM-MAINTAINER-ONLY -->\n# Form\n');
  return {parent,a,b};
}

test('non-git parent with two repositories returns a root card ordered by hint and writes nothing',async t=>{
  const h=await fixture(t);const {parent}=await twoRepos(h);
  const before=await tree(parent);
  const r=cli(h,['context','--cwd',parent,'--hint','dynamic-form']);
  assert.equal(r.resolved,false);assert.equal(r.reason,'MULTIPLE_REPOSITORIES');
  assert.equal(r.card.kind,'root');
  assert.match(r.render.markdown,/^\*\*ต้องตัดสินใจ/);
  assert.equal(r.card.options.find(o=>o.id===r.card.recommended).label,'agmwa-dynamic-form-ng');
  assert.deepEqual(await tree(parent),before);
  const ack=cli(h,['context','--cwd',parent,'--session','s1','--ack','abcdefabcdef']);
  assert.equal(ack.ok,false);
  assert.equal(await present(path.join(parent,'.agrimap-agent')),false);
});

test('--paths resolves one root; chain is outer->inner with sha12, maintainer and pointer flags',async t=>{
  const h=await fixture(t);const {parent,a}=await twoRepos(h);
  const r=cli(h,['context','--cwd',parent,'--paths','services/agmws-orders-netcore/src/x.cs']);
  assert.equal(r.resolved,true);assert.equal(path.resolve(r.targetRoot),path.resolve(a));
  const local=r.chain.filter(e=>e.relative==='AGENTS.md'||e.relative==='CLAUDE.md'||e.relative==='../../AGENTS.md');
  assert.deepEqual(local.map(e=>e.relative),['../../AGENTS.md','AGENTS.md','CLAUDE.md']);
  const agents=local[1];
  assert.equal(agents.sha12,createHash('sha256').update(await readFile(path.join(a,'AGENTS.md'))).digest('hex').slice(0,12));
  assert.equal(agents.bootstrapVersion,'4.5.5');assert.equal(local[2].pointerOnly,true);
  assert.ok(!r.readRequired.includes('CLAUDE.md'));
  const form=cli(h,['context','--cwd',parent,'--target','apps/agmwa-dynamic-form-ng']);
  assert.equal(form.chain.find(e=>e.relative==='AGENTS.md').maintainerOnly,true);
});

test('ack clears readRequired; a one-byte change requires reading again; ack without target outside git fails',async t=>{
  const h=await fixture(t);const {a}=await twoRepos(h);
  const r=cli(h,['context','--cwd',a,'--session','s1']);
  const shas=r.chain.filter(e=>r.readRequired.includes(e.relative)).map(e=>e.sha12).join(',');
  assert.equal(cli(h,['context','--cwd',a,'--session','s1','--ack','000000000000']).code,'ACK_HASH_MISMATCH');
  const acked=cli(h,['context','--cwd',a,'--session','s1','--ack',shas]);
  assert.deepEqual(acked.readRequired,[]);
  assert.match(await readFile(path.join(a,'.agrimap-agent/.gitignore'),'utf8'),/local\//);
  await writeFile(path.join(a,'AGENTS.md'),(await readFile(path.join(a,'AGENTS.md'),'utf8'))+'x');
  assert.deepEqual(cli(h,['context','--cwd',a,'--session','s1']).readRequired,['AGENTS.md']);
});

test('context without --ack is read-only and stray .agrimap-agent in a non-git parent is reported',async t=>{
  const h=await fixture(t);const {parent,a}=await twoRepos(h);
  const before=await tree(a);
  cli(h,['context','--cwd',a,'--session','s1']);
  assert.deepEqual(await tree(a),before);
  await mkdir(path.join(parent,'.agrimap-agent/logs'),{recursive:true});
  const r=cli(h,['context','--cwd',parent,'--target','services/agmws-orders-netcore']);
  assert.ok(r.strayStateRoots.some(p=>path.resolve(p)===path.resolve(parent)));
  assert.ok(r.warnings.includes('STRAY_STATE_ROOT'));
});

async function specProject(h,a,{remote=null}={}){
  await mkdir(path.join(a,'.agrimap-agent/policy'),{recursive:true});
  const source={id:'orders-spec',kind:'external',format:'morynth-context-index@1',version:'1.0.0',fingerprint:{file:'06-agent/CONTEXT-INDEX.yaml',contains:'id: orders-spec'},remote};
  await writeFile(path.join(a,'.agrimap-agent/policy/project.json'),JSON.stringify({schemaVersion:1,status:'confirmed',developmentMode:'spec-first',confirmedBy:'t',confirmedAt:'2026-09-18',decisionRef:null,inference:null,specs:{sources:[source],scopes:[],sync:'auto',enforcement:'warn'},hybrid:{newWork:'spec-first'}}));
}
async function specPack(dir,version='1.0.0'){
  await mkdir(path.join(dir,'06-agent'),{recursive:true});
  await writeFile(path.join(dir,'06-agent/CONTEXT-INDEX.yaml'),`schema: morynth-context-index@1\nproject:\n  id: orders-spec\n  version: ${version}\n`);
  return dir;
}

test('context resolves external specs from local memory, bounded discovery (persisted on ack) or a card',async t=>{
  const h=await fixture(t);const {a}=await twoRepos(h);await specProject(h,a);
  // Not found anywhere: card with free text answer.
  let r=cli(h,['context','--cwd',a,'--session','s1']);
  assert.equal(r.projectProfile.sources[0].resolved,false);
  assert.equal(r.cards[0].card.recordAs,'local:spec:orders-spec');
  // One sibling passes the fingerprint: discovered without a question.
  const pack=await specPack(path.join(path.dirname(a),'orders-spec-v1.0.0'));
  r=cli(h,['context','--cwd',a,'--session','s1']);
  assert.equal(r.projectProfile.sources[0].via,'discovery');assert.equal(r.cards.length,0);
  assert.equal(await present(path.join(a,'.agrimap-agent/local/memory.md')),false);
  const shas=r.chain.filter(e=>r.readRequired.includes(e.relative)).map(e=>e.sha12).join(',');
  cli(h,['context','--cwd',a,'--session','s1','--ack',shas]);
  const memory=await readFile(path.join(a,'.agrimap-agent/local/memory.md'),'utf8');
  assert.ok(memory.includes(pack.replaceAll('\\','/')));
  r=cli(h,['context','--cwd',a,'--session','s1']);
  assert.equal(r.projectProfile.sources[0].via,'local-memory');
  // Stale path plus two versions nearby: stale warning and a choice card.
  await writeFile(path.join(a,'.agrimap-agent/local/memory.md'),memory.replace(pack.replaceAll('\\','/'),pack.replaceAll('\\','/')+'-moved'));
  await specPack(path.join(path.dirname(a),'orders-spec-v1.1.0'),'1.1.0');
  r=cli(h,['context','--cwd',a,'--session','s1']);
  assert.ok(r.warnings.includes('LOCAL_PATH_STALE'));
  assert.equal(r.cards[0].card.options.length,2);
});
