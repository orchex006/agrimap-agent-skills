// One-time v3 portability migration. Restores only bytes proven by the existing
// hash; curated references may explicitly adopt the repository's reviewed text.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve('skills/agrimap-agent-skills/references/patterns/golden');
const hash=b=>createHash('sha256').update(b).digest('hex');
const changes=[];
for(const dir of await readdir(root,{withFileTypes:true})){
  if(!dir.isDirectory())continue;
  const mp=path.join(root,dir.name,'manifest.json');
  const manifest=JSON.parse(await readFile(mp,'utf8'));
  let changed=false;
  for(const e of manifest.examples){
    const p=path.join(root,dir.name,e.fileName),bytes=await readFile(p);
    if(hash(bytes)===e.sha256)continue;
    const normalized=Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
    if(hash(normalized)===e.sha256){await writeFile(p,normalized);changes.push({file:dir.name+'/'+e.fileName,change:'restore-hash-matching-LF'});}
    else if((e.evidenceMode||manifest.evidenceMode)==='curated-reference'&&process.argv.includes('--accept-curated')){
      await writeFile(p,normalized);e.sha256=hash(normalized);changed=true;
      changes.push({file:dir.name+'/'+e.fileName,change:'adopt-reviewed-repository-reference'});
    }else throw new Error('UNRESOLVED_GOLDEN_HASH: '+p);
  }
  if(changed)await writeFile(mp,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({changes},null,2));
