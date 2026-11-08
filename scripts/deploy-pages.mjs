import { readdir, readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const required = ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_PAGES_PROJECT'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing deployment setting: ${key}`);
const token = process.env.CLOUDFLARE_API_TOKEN;
const project = process.env.CLOUDFLARE_PAGES_PROJECT;
const prefix = `/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}`;
const root = new URL('../apps/home-preview/dist/client/', import.meta.url);
const sha = process.env.GITHUB_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const types = {'.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.pdf':'application/pdf','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm'};
async function request(path, {body, method='GET', auth=token}={}) {
  const headers = {Authorization:`Bearer ${auth}`};
  if (body && !(body instanceof FormData)) headers['Content-Type']='application/json';
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare ${method} ${path}: ${response.status}; codes ${(data.errors??[]).map(e=>e.code).join(',')}`);
  return data.result;
}
const manifest = {}, assets = new Map();
async function walk(dir, relative='') {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const name = relative + entry.name;
    if (entry.isDirectory()) { await walk(new URL(entry.name+'/',dir),name+'/'); continue; }
    if (['_headers','_redirects','brand/sources.json'].includes(name) || name.startsWith('brand/source-svg/')) continue;
    if (/\.env|\.local|\.map$|brand\/source-svg|brand\/sources\.json/.test(name)) throw new Error(`Unexpected private/source file in build: ${name}`);
    const bytes = await readFile(new URL(entry.name,dir));
    if (bytes.length > 25*1024*1024) throw new Error(`Asset exceeds Pages limit: ${name}`);
    const key = createHash('sha256').update(bytes).update(extname(name)).digest('hex').slice(0,32);
    manifest['/'+name]=key;
    assets.set(key,{key,value:bytes.toString('base64'),base64:true,metadata:{contentType:types[extname(name)]||'application/octet-stream'}});
  }
}
await walk(root);
if (!manifest['/index.html']) throw new Error('Missing built index.html');
const jwt = (await request(prefix+'/upload-token')).jwt;
const hashes = [...assets.keys()];
const missing = await request('/pages/assets/check-missing',{method:'POST',auth:jwt,body:{hashes}});
let batch=[],size=0,uploaded=0;
async function flush() { if (!batch.length) return; await request('/pages/assets/upload',{method:'POST',auth:jwt,body:batch});uploaded+=batch.length;batch=[];size=0; }
for (const hash of missing) { const asset=assets.get(hash); if (!asset) throw new Error('Unexpected missing hash'); if (batch.length && size+asset.value.length>10*1024*1024) await flush();batch.push(asset);size+=asset.value.length; }
await flush();
await request('/pages/assets/upsert-hashes',{method:'POST',auth:jwt,body:{hashes}});
const form = new FormData();
form.set('manifest',JSON.stringify(manifest));form.set('branch','main');form.set('commit_hash',sha);form.set('commit_dirty','false');form.set('commit_message','Margin verified main');
for (const file of ['_headers','_redirects']) form.set(file,new Blob([await readFile(new URL(file,root))],{type:'text/plain'}),file);
const deployment = await request(prefix+'/deployments',{method:'POST',body:form});
let succeeded=false;
for (let attempt=0;attempt<60;attempt++) {
  const status = await request(prefix+'/deployments/'+deployment.id);
  if (status.latest_stage.status==='success' && status.latest_stage.name==='deploy') { succeeded=true;break; }
  if (['failure','canceled'].includes(status.latest_stage.status)) throw new Error(`Deployment ${deployment.id} failed`);
  await new Promise(resolve=>setTimeout(resolve,3000));
}
if (!succeeded) throw new Error('Cloudflare deployment status timed out');
const base=`https://${project}.pages.dev`;
for (const route of ['/','/login','/r']) {
  let matched=false;
  for(let n=0;n<12;n++) {
    const response=await fetch(base+route+'?release='+sha,{headers:{'Cache-Control':'no-cache'}});
    const html=await response.text();
    if(response.ok && createHash('sha256').update(html).digest('hex')===createHash('sha256').update(await readFile(new URL('index.html',root))).digest('hex')) { matched=true;break; }
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  if(!matched) throw new Error('Published HTML does not match checked build: '+route);
}
console.log(JSON.stringify({deploymentId:deployment.id,commit:sha,url:base,uploaded,verifiedRoutes:3}));
if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,`Published ${sha} to ${base}\n\nDeployment: ${deployment.id}. Three entry routes match the built HTML.\n`);
