// Upload only built public assets. The short-lived credential stays in an ignored private file.
import {readFile} from 'node:fs/promises';
const out=new URL('../../../.local/pages-upload/',import.meta.url);
const token=(await readFile(new URL('upload-token.local',out),'utf8')).trim();
if(!token) throw new Error('A private Pages upload credential is required.');
const manifest=JSON.parse(await readFile(new URL('manifest.json',out),'utf8'));
async function request(path,body){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch('https://api.cloudflare.com/client/v4/pages/assets/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
   const value=await r.json();if(!r.ok||!value.success)throw new Error('Pages asset '+path+' failed ('+r.status+').');return value.result;
  }catch(e){if(attempt===2)throw e;}
 }
}
const hashes=[...new Set(Object.values(manifest))];
const missing=new Set(await request('check-missing',{hashes}));
const config=JSON.parse(await readFile(new URL('deployment.json',out),'utf8'));
let uploaded=0;
for(let i=0;;i++){
 let batch;try{batch=JSON.parse(await readFile(new URL('batch-'+i+'.json',out),'utf8'));}catch(e){if(e.code==='ENOENT')break;throw e;}
 batch=batch.filter(a=>missing.has(a.key));if(batch.length){await request('upload',batch);uploaded+=batch.length;console.log('Public assets uploaded: '+uploaded);}
}
await request('upsert-hashes',{hashes});
console.log(JSON.stringify({files:Object.keys(config.manifest).length,uniqueAssets:hashes.length,uploaded,complete:true}));
