import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const app=process.cwd();
const require=createRequire(pathToFileURL(join(app,'package.json')));
const { PGlite }=await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
const { chromium }=require('playwright');
const base='http://127.0.0.1:5203';
const endpoint='http://127.0.0.1:54399';
const dir=process.argv[2];
assert.ok(dir);
await mkdir(dir,{recursive:true});
const user=(digit,name,email)=>({id:`${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,email,name});
const owner=user('1','가상 학생','student@example.test');
const professor=user('2','지정 교수','professor@example.test');
const stranger=user('3','검토 밖 계정','outside@example.test');
const editor=user('4','일반 공동연구자','editor@example.test');
const research='55555555-5555-4555-8555-555555555555';
const ident=(d)=>user(d,'','').id;
const docs={material:ident('6'),file1:ident('7'),file2:ident('8'),A:ident('9'),B:ident('a'),personal:ident('b'),personalFile:ident('c')};
const path=(id)=>`${owner.id}/${research}/${id}.pdf`;
const title='가상 논문 두 항목 검토';
const A='비교 기준 표 보완';
const B='연구 질문 구체화';
const reason='비교 기준의 적용 범위를 한 문장 더 적어 주세요.';
const note='표의 비교 기준 열을 이 위치에서 확인해 주세요.';
const reply='가상 학생이 보완 목적과 출처를 확인했습니다.';
const marks=[];
const checks=[];
const failures=[];
let shotIndex=0;
const pdf=(edition)=>{
  const a=`BT /F1 24 Tf 68 712 Td (Research review fixture - ${edition}) Tj 0 -50 Td /F1 16 Tf (Item A: Comparison criteria, research scope and sources.) Tj 0 -35 Td (The case and PDF do not contain real research data.) Tj ET`;
  const b='BT /F1 24 Tf 68 712 Td (Item B: Research question) Tj 0 -50 Td /F1 16 Tf (Purpose, population and context.) Tj ET';
  const stream=s=>`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',stream(a),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',stream(b),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let text='%PDF-1.4\n';
  const offsets=objects.map((part,n)=>{const offset=Buffer.byteLength(text);text+=`${n+1} 0 obj\n${part}\nendobj\n`;return offset});
  const xref=Buffer.byteLength(text);
  text+='xref\n0 8\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text);
};
const fileTable=new Map([[path(docs.file1),pdf('v1')],[path(docs.file2),pdf('v2')],[path(docs.personalFile),pdf('private sentinel')]]);
const db=new PGlite();
const backend=await readFile(join(app,'supabase/tests/backend.test.mjs'),'utf8');
const bootstrap=backend.match(/await db\.exec\(`(create role anon;[\s\S]*?)`\)/)?.[1];
assert.ok(bootstrap);
await db.exec(bootstrap);
for(const file of (await readdir(join(app,'supabase/migrations'))).filter(x=>x.endsWith('.sql')).sort()){
  await db.exec(await readFile(join(app,'supabase/migrations',file),'utf8'));
}
for(const account of [owner,professor,stranger,editor]){
  await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[account.id,account.email,JSON.stringify({name:account.name})]);
  await db.query('insert into public.rms_demo_accounts(user_id) values($1)',[account.id]);
}
let queue=Promise.resolve();
const scoped=(actor,work)=>{
  const pending=queue.then(()=>db.transaction(async txn=>{
    await txn.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[
      actor?.id??'',JSON.stringify({sub:actor?.id??null,email:actor?.email??null,role:actor?'authenticated':'anon'})]);
    await txn.exec(actor?'set local role authenticated':'set local role anon');
    return work(txn);
  }));
  queue=pending.catch(()=>{});
  return pending;
};
const jsonInput=(v)=>v&&typeof v==='object'?JSON.stringify(v):v;
const rpc=(actor,name,args={})=>{
  assert.match(name,/^rms_[a-z_]+$/);
  const keys=Object.keys(args??{});
  assert.ok(keys.every(x=>/^p_[a-z0-9_]+$/.test(x)));
  return scoped(actor,async txn=>(await txn.query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as value`,keys.map(key=>jsonInput(args[key])))).rows[0]?.value);
};
const record=(kind,payload)=>rpc(owner,'rms_save_record',{p_kind:kind,p_value:payload});
const input=(actor,name,payload)=>rpc(actor,name,{p_input:payload});
const workspace=actor=>rpc(actor,'rms_bootstrap');
const stamp='2026-11-25T02:30:00Z';
const itemData=id=>({id,researchId:research,createdAt:stamp,updatedAt:stamp});
await rpc(owner,'rms_save_research',{p_value:{...itemData(research),ownerId:owner.id,name:'가상 논문 권한 실험',description:'검토용 두 항목과 별도 비공개 원본으로 구성한 가상 연구',purpose:'검토 응답과 공동연구 권한을 비교합니다.',questions:['같은 검토 링크에서 역할에 따라 무엇이 보이나요?']}});
await input(owner,'rms_member_action',{action:'invite',researchId:research,email:editor.email});
await input(editor,'rms_member_action',{action:'accept',researchId:research});
await record('materials',{...itemData(docs.material),title:'공유할 가상 비교표',type:'draft',visibility:'shared'});
await record('materials',{...itemData(docs.personal),title:'학생만 보는 가상 메모',type:'draft',visibility:'private'});
for(const [id,matId,n,name] of [[docs.file1,docs.material,1,'가상_비교표_v1.pdf'],[docs.file2,docs.material,2,'가상_비교표_v2.pdf'],[docs.personalFile,docs.personal,1,'비공개_가상_자료.pdf']]){
 const filePath=path(id);
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['research-files',filePath,JSON.stringify({size:fileTable.get(filePath).length,mimetype:'application/pdf'})]);
 await record('versions',{...itemData(id),materialId:matId,number:n,fileName:name,storagePath:filePath,size:fileTable.get(filePath).length,mimeType:'application/pdf',visibility:matId===docs.material?'shared':'private'});
}
const savedA=await record('results',{...itemData(docs.A),title:A,visibility:'private',description:'비교 기준과 출처 열을 추가했습니다.',feedbackIds:[],taskIds:[],kind:'document',versionId:docs.file1,location:'1쪽 표 1'});
const savedB=await record('results',{...itemData(docs.B),title:B,visibility:'private',description:'연구 대상과 조사 상황을 구체화했습니다.',feedbackIds:[],taskIds:[],kind:'document',versionId:docs.file1,location:'2쪽 연구 질문'});
console.log('마이그레이션과 합성 PDF 및 네 역할 준비 완료');

const session=account=>{
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const expires_at=Math.floor(Date.now()/1000)+3600;
  return {access_token:encode({alg:'none',typ:'JWT'})+'.'+encode({sub:account.id,email:account.email,role:'authenticated',exp:expires_at})+'.local',refresh_token:'audit-local',token_type:'bearer',expires_in:3600,expires_at,
    user:{id:account.id,email:account.email,aud:'authenticated',role:'authenticated',user_metadata:{name:account.name},app_metadata:{provider:'email'},created_at:stamp}};
};
let inviteToken;
let rejectSnapshot;
let pauseSave;
const observed=[];
const contexts=[];
const browser=await chromium.launch();
const make=async(actor,{width=1440,height=900}={})=>{
 const context=await browser.newContext({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',colorScheme:'light'});
 contexts.push(context);
 if(actor) await context.addInitScript(value=>{if(window.self===window.top)localStorage.setItem('sb-127-auth-token',JSON.stringify(value))},session(actor));
 // Only the temporary app and test API can be reached by these contexts.
 await context.route(/^https?:\/\/(?:[^/]+)\//,async route=>{
   const request=route.request(), url=new URL(request.url());
   if(url.origin===base)return route.continue();
   if(url.origin!==endpoint)return route.abort();
   const cors={'access-control-allow-origin':'*','access-control-allow-methods':'*','access-control-allow-headers':'*'};
   const answer=(status,body)=>route.fulfill({status,json:body,headers:cors});
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   if(url.pathname==='/auth/v1/user')return actor?answer(200,session(actor).user):answer(401,{message:'로그인이 필요합니다'});
   if(url.pathname.startsWith('/auth/v1/token'))return actor?answer(200,session(actor)):answer(401,{message:'로그인이 필요합니다'});
   const api=url.pathname.match(/^\/rest\/v1\/rpc\/(rms_[a-z_]+)$/)?.[1];
   let args;
   if(api||url.pathname.startsWith('/functions/v1/')){
     try{args=request.postDataJSON()??{};}catch{args={};}
   }
   if (api === 'rms_save_record' && args?.p_kind === 'documentVersions' &&
       args.p_value?.documentId === rejectSnapshot?.id && ++rejectSnapshot.attempt === 2) {
     return answer(503,{code:'AUDIT',message:'테스트로 복원 뒤 버전 저장을 한 번 중단했어요.'});
   }
   if (api === 'rms_save_record' && args?.p_kind === 'documents' && args.p_value?.id === pauseSave?.id && !pauseSave.started) {
     pauseSave.started = true;
     await pauseSave.release.promise;
   }
   if(api){
     try{
       const value=await rpc(actor,api,args);
       observed.push({role:actor?.name??'비로그인',api,ok:true});
       return answer(200,value??null);
     }catch(error){
       observed.push({role:actor?.name??'비로그인',api,ok:false,code:error.code,message:error.message});
       return answer(400,{code:error.code??'22023',message:error.message});
     }
   }
   if(url.pathname.endsWith('/project-invite')){
     try{
       inviteToken=randomBytes(25).toString('base64url');
       const invite=await input(actor,'rms_project_invite_create',{researchId:args.researchId,email:args.email,role:args.role, tokenHash:createHash('sha256').update(inviteToken).digest('hex')});
       return answer(200,{invite:{...invite,emailStatus:'failed'},emailStatus:'failed',emailFailure:'not_configured',link:base+'/join?token='+inviteToken});
     }catch(error){return answer(400,{error:error.message});}
   }
   if(url.pathname.startsWith('/functions/v1/'))return answer(503,{error:'격리된 테스트 환경에서 외부 함수는 호출하지 않습니다.'});
   const file=url.pathname.match(/^\/storage\/v1\/object\/(?:sign\/|authenticated\/)?research-files\/(.+)$/)?.[1];
   if(file){
     const candidate=decodeURIComponent(file);
     const allowed=actor&&await rpc(actor,'rms_can_read_file',{p_path:candidate}).catch(()=>false);
     if(!allowed||!fileTable.has(candidate))return answer(403,{message:'파일을 볼 권한이 없습니다'});
     if(request.method()==='POST')return answer(200,{signedURL:'/object/sign/research-files/'+file+'?token=audit-local'});
     return route.fulfill({status:200,body:fileTable.get(candidate),contentType:'application/pdf',headers:cors});
   }
   return answer(200,[]);
 });
 return context.newPage();
};

const flush=()=>writeFile(join(dir,'manifest.json'),JSON.stringify(marks,null,2)+'\n');
const evidence=async(page,slug,label,observation,source,mode='실제 UI · 격리 SQL')=>{
 const file=String(++shotIndex).padStart(2,'0')+'-'+slug+'.png';
 await page.screenshot({path:join(dir,file),animations:'disabled'});
 marks.push({file,label,observation,source,mode,viewport:{w:page.viewportSize().width,h:page.viewportSize().height}});
 await flush();
};
const step=async(label,work)=>{
 try{await work();checks.push(label);console.log('PASS',label);}
 catch(error){
   const location=error.stack?.split('\n').find(line=>line.includes('review.mjs:'))?.trim();
   const detail=error.message.split('\n').slice(0,9).join(' | ');
   failures.push([label,detail,location]);
   console.log('BLOCKED',label,detail,location);
 }
};
const button=(page,name)=>page.getByRole('button',{name,exact:typeof name==='string'});
const radio=(page,name)=>page.getByRole('radio',{name,exact:true});
const click=(loc)=>loc.click({timeout:5500});
const wait=(loc)=>loc.waitFor({state:'visible',timeout:8500});
const open=(page,route)=>page.goto(base+route,{waitUntil:'domcontentloaded',timeout:12000});
const one=(loc)=>loc.first();
const aPage=await make(owner);
const ePage=await make(editor);
const researchPath='/r/'+research;
const status=page=>page.locator('.editor-save');
const bodyEditor=page=>page.locator('.tiptap').first();
const titleField=page=>page.getByRole('textbox',{name:'문서 제목'});
const editorData=(text,bold=false)=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text,...(bold?{marks:[{type:'bold'}]}:{})}]}]});
const seedDoc=(id,title,text,opts={})=>record('documents',{...itemData(id),type:'manuscript',title,visibility:'shared',text,content:editorData(text),...opts});
const keep=(doc,id)=>record('documentVersions',{...itemData(id),documentId:doc.id,number:0,title:doc.title,content:doc.content,text:doc.text});
const versions=async id=>(await workspace(owner)).documentVersions.filter(v=>v.documentId===id).sort((a,b)=>a.number-b.number);
const stored=async id=>(await workspace(owner)).documents.find(doc=>doc.id===id);
const details={};
const waitUntil=async(predicate,label,max=5400)=>{
 const end=Date.now()+max;
 while(Date.now()<end){
   if(await predicate())return;
   await new Promise(resolve=>setTimeout(resolve,90));
 }
 throw Error(label+' 시간 초과');
};
async function openDoc(page,id){
 await open(page,researchPath+'/docs/w/'+id);
 await wait(bodyEditor(page));
 await wait(titleField(page));
}
const versionItems=page=>page.getByRole('menuitemradio').filter({hasText:/^v\d+\s*·/});
async function openVersion(page,num=1){
 await click(button(page,'버전'));
 const item=page.getByRole('menuitemradio').filter({hasText:new RegExp('^v'+num+'\\s*·')}).first();
 if(!await item.isVisible()){
   console.log('VERSION MENU',await page.getByRole('menu').allTextContents());
 }
 await click(item);
 await wait(page.getByRole('region',{name:'버전 비교'}));
}
const restore=page=>click(button(page,'이 버전으로 되살리기'));
async function attachDiffScenario(id,historyId){
 const v1=await seedDoc(id,'처음 남긴 제목','가상 버전 v1의 내용입니다.');
 await keep(v1,historyId);
 const v2=await record('documents',{...v1,title:'자동 저장만 된 새 문장',text:'아직 이력으로 남기지 않은 문장입니다.',content:editorData('아직 이력으로 남기지 않은 문장입니다.')});
 assert.equal(v2.title,'자동 저장만 된 새 문장');
 return {v1,v2};
}

try{
await step('01 연결 저장소의 정상 복원은 버전 번호를 1·2·3으로 할당',async()=>{
 const id='71000000-1000-4000-8000-000000000001';
 const {v1,v2}=await attachDiffScenario(id,'71000000-1000-4000-8000-000000000002');
 await openDoc(aPage,id);
 await openVersion(aPage);
 await restore(aPage);
 await aPage.getByRole('region',{name:'버전 비교'}).waitFor({state:'hidden',timeout:12000});
 const rows=await versions(id);
 assert.deepEqual(rows.map(v=>v.number),[1,2,3]);
 assert.deepEqual(rows.map(v=>v.title),[v1.title,v2.title,v1.title]);
 assert.equal((await stored(id)).title,v1.title);
 await click(button(aPage,'버전'));
 const labels=await versionItems(aPage).allTextContents();
 await evidence(aPage,'01-connected-numbering','연결 모드 복원의 번호','v3 · v2 · v1이며 복원 직전 본문은 v2에 남습니다.','WritingPage.tsx / 20261123000000_material_default_private.sql');
 details.connectedHistory={numbers:rows.map(v=>v.number),titles:rows.map(v=>v.title),labels};
});
await step('신규 1 본문이 같고 제목·굵기만 바뀌면 복원 직전 상태가 사라짐',async()=>{
 const id='71000000-1000-4000-8000-000000000003';
 const text='동일한 원문에서 제목과 굵기만 달라졌습니다.';
 const v1=await seedDoc(id,'처음 남긴 제목',text);
 await keep(v1,'71000000-1000-4000-8000-000000000004');
 await record('documents',{...v1,title:'새 제목과 굵은 본문',content:editorData(text,true)});
 await openDoc(aPage,id);
 assert.equal(await titleField(aPage).inputValue(),'새 제목과 굵은 본문');
 assert.equal(await bodyEditor(aPage).locator('strong').innerText(),text);
 await evidence(aPage,'new-title-format-before','복원 직전 제목과 굵기','본문 문자는 v1과 같고 현재 저장된 제목과 글자 굵기가 다릅니다.','WritingPage.tsx');
 await openVersion(aPage);
 await evidence(aPage,'18-compare-no-title-format','본문 평문만 보이는 버전 비교','버전 비교에서 제목과 굵기의 차이를 표시하지 않으며 복원 버튼은 켜져 있습니다.','CompareView.tsx');
 await restore(aPage);
 await aPage.getByRole('region',{name:'버전 비교'}).waitFor({state:'hidden',timeout:12000});
 const rows=await versions(id);
 assert.deepEqual(rows.map(v=>[v.number,v.title,JSON.stringify(v.content).includes('"bold"')]),[[1,v1.title,false],[2,v1.title,false]]);
 const now=await stored(id);
 assert.equal(now.title,v1.title);
 assert.equal(JSON.stringify(now.content).includes('"bold"'),false);
 await click(button(aPage,'버전'));
 await evidence(aPage,'new-title-format-after','복원 후 되돌릴 이력 없음','버전에는 과거 제목과 굵기가 없는 v1과 v2만 있고 복원 직전 상태는 빠져 있습니다.','WritingPage.tsx');
 details.equalTextRestore={before:{title:'새 제목과 굵은 본문',hasBold:true},after:{title:now.title,hasBold:false},history:rows.map(({number,title})=>({number,title}))};
});
await step('신규 2 복원본 버전 저장이 실패하면 화면과 원고 저장 상태가 갈라짐',async()=>{
 const id='71000000-1000-4000-8000-000000000005';
 const {v1,v2}=await attachDiffScenario(id,'71000000-1000-4000-8000-000000000006');
 await openDoc(aPage,id);
 await openVersion(aPage);
 rejectSnapshot={id,attempt:0};
 await restore(aPage);
 const err=aPage.getByText(/테스트로 복원 뒤 버전 저장을 한 번 중단했어요/).first();
 await wait(err);
 assert.equal(await titleField(aPage).inputValue(),v2.title);
 assert.equal((await stored(id)).title,v1.title);
 const rows=await versions(id);
 assert.deepEqual(rows.map(v=>v.title),[v1.title,v2.title]);
 await evidence(aPage,'new-restore-failed-version','실패 알림과 복원 직전 제목','마지막 저장 요청 한 번만 실패시켰습니다. 오류 화면은 편집 중이던 제목을 보여 주나 실제 저장본은 과거 내용으로 바뀌었습니다.','WritingPage.tsx','실제 UI · 격리 SQL · 마지막 요청만 실패 주입');
 await aPage.reload({waitUntil:'domcontentloaded'});
 await wait(titleField(aPage));
 assert.equal(await titleField(aPage).inputValue(),v1.title);
 await evidence(aPage,'new-restore-after-refresh','새로고침 뒤 드러난 복원 상태','오류 직후 새로고침하면 v1 제목과 본문이 나옵니다. 복원 직전 상태는 v2에 보존돼 있습니다.','WritingPage.tsx','실제 UI · 격리 SQL · 마지막 요청만 실패 주입');
 details.partialRestore={screenAfterFailure:v2.title,persisted:v1.title,history:rows.map(({number,title})=>({number,title}))};
 rejectSnapshot=undefined;
});
await step('신규 3 저장 지연 중 내 원고를 나만 보기로 바꾸면 이전 공유 상태가 남음',async()=>{
 const id='71000000-1000-4000-8000-000000000007';
 await seedDoc(id,'공개 범위 테스트용 가상 원고','저장 중 변경의 유지 여부를 확인합니다.');
 await openDoc(aPage,id);
 const release=Promise.withResolvers();
 pauseSave={id,release,started:false};
 try{
   await bodyEditor(aPage).fill('저장을 누른 뒤 공유 범위를 바꿉니다.');
   await aPage.keyboard.press('Control+s');
   await waitUntil(()=>pauseSave.started,'첫 저장 시작');
   await wait(status(aPage).getByText('저장 중',{exact:true}));
   const visibility=aPage.locator('.editor-head-meta [aria-label*="공동연구자와 공유"]').first();
   await click(visibility);
   await click(aPage.locator('[role=option],[role=menuitemradio]').filter({hasText:/^나만 보기$/}).filter({visible:true}).last());
 }finally{
   release.resolve();
 }
 await wait(status(aPage).getByText(/저장됨/));
 await wait(aPage.locator('.editor-head-meta [aria-label*="나만 보기"]').first());
 await new Promise(resolve=>setTimeout(resolve,1750));
 const server=await stored(id);
 assert.equal(server.visibility,'shared');
 assert.ok((await workspace(editor)).documents.some(doc=>doc.id===id));
 await evidence(aPage,'new-visibility-stale','나만 보기와 저장됨으로 표시되는 원고','지연시킨 저장 응답 이후에도 화면은 나만 보기지만 서버 공유가 유지돼 공동연구자가 가상 원고를 읽을 수 있습니다.','WritingPage.tsx','실제 UI · 격리 SQL · 응답 한 번 지연');
 await aPage.reload({waitUntil:'domcontentloaded'});
 await wait(aPage.locator('.editor-head-meta [aria-label*="공동연구자와 공유"]').first());
 await evidence(aPage,'new-visibility-reload','새로고침하면 공유 상태로 표시','이전 화면에서 저장했다고 표시되던 변경이 적용되지 않았습니다.','WritingPage.tsx','실제 UI · 격리 SQL · 응답 한 번 지연');
 details.visibilityDuringSave={before:'shared',label:'나만 보기',status:'저장됨',persisted:server.visibility,visibleToEditor:true};
 pauseSave=undefined;
});
await step('19 충돌 뒤 내 내용을 유지하는 버튼은 즉시 저장하지 않음',async()=>{
 const id='71000000-1000-4000-8000-000000000008';
 const initial='공동연구용 가상 문서에 남긴 처음 문장입니다.';
 const studentDraft='학생이 먼저 저장한 내용입니다.';
 const editorDraft='공동연구자가 나중에 입력한 내용입니다.';
 await seedDoc(id,'공동편집 충돌 실험',initial);
 await Promise.all([openDoc(aPage,id),openDoc(ePage,id)]);
 await bodyEditor(aPage).fill(studentDraft);
 await aPage.keyboard.press('Control+s');
 await waitUntil(async()=>(await stored(id)).text===studentDraft,'학생 첫 저장');
 await bodyEditor(ePage).fill(editorDraft);
 const dialog=ePage.getByRole('dialog',{name:'다른 창이나 공동연구자가 먼저 저장했어요'});
 await wait(dialog);
 await evidence(ePage,'19-conflict-choice','파일 저장 충돌 선택','파란 버튼은 내 편집 내용을 화면에 유지하고 다음 저장의 기준을 바꿉니다.','WritingPage.tsx');
 await click(button(dialog,'내가 쓴 내용 유지'));
 await dialog.waitFor({state:'hidden'});
 await new Promise(resolve=>setTimeout(resolve,1700));
 assert.equal((await stored(id)).text,studentDraft);
 await evidence(ePage,'19-conflict-keep','내 문장을 편집기에 유지한 상태','누른 직후와 자동 저장 대기 1.7초 뒤에도 서버에 학생 문장이 남습니다.','WritingPage.tsx');
 await ePage.keyboard.press('Control+s');
 await waitUntil(async()=>(await stored(id)).text===editorDraft,'공동연구자 명시적 저장');
 details.conflict={afterKeep:studentDraft,afterExplicitSave:editorDraft};
});
await step('신규 4 기록에서 만든 할 일이 출처를 잃어 같은 기록 필터에서 누락',async()=>{
 const id='71000000-1000-4000-8000-000000000009';
 const name='가상 5차 지도 기록';
 const taskName='원고 2장 표의 출처 추가';
 await record('meetings',{...itemData(id),title:name,visibility:'shared',date:'2026-11-24',time:'15:00',status:'recorded',memo:'교수 검토용 가상 미팅입니다.',memoRevision:0,goal:'',taskIds:[],questionIds:[],versionIds:[]});
 await open(aPage,researchPath+'/meetings/'+id+'?tab=record');
 const recordSide=aPage.getByRole('complementary',{name:'요약·할 일',exact:true});
 await click(button(recordSide,'할 일 추가'));
 const inputField=recordSide.getByRole('textbox',{name:'새 할 일 제목'});
 await inputField.fill(taskName);
 await inputField.press('Enter');
 await new Promise(resolve=>setTimeout(resolve,450));
 console.log('TASK',JSON.stringify({save:observed.slice(-5),toast:await aPage.locator('[data-sonner-toast]').allTextContents()}));
 const data=await workspace(owner);
 const saved=data.tasks.find(task=>task.title===taskName);
 assert.equal(saved?.sourceRecordId,id);
 await wait(recordSide.getByText(taskName,{exact:true}).first());
 await evidence(aPage,'new-task-from-record','출처 기록의 할 일','기록에서 할 일 추가를 눌러 작성한 항목이 같은 기록에 보입니다. 저장 데이터에 기록 식별자가 들어 있습니다.','RecordSide.tsx');
 await open(aPage,researchPath+'/tasks');
 const row=aPage.locator('.tasks-home .task-line').filter({hasText:taskName});
 const text=row.getByText(taskName,{exact:true});
 await wait(row);
 assert.match(await row.innerText(),/직접 추가/);
 await evidence(aPage,'03-task-source-label','전체 할 일에서 잘못 표시된 출처','작성한 학생 계정에서도 기록 제목 대신 직접 추가로 표시됩니다.','task-groups.ts');
 const filter=aPage.locator('.tasks-home .tasks-filters label').filter({hasText:/^기록/});
 console.log('TASK FILTER',await filter.evaluate(e=>[...e.querySelectorAll('button,[role]')].map(x=>[x.tagName,x.getAttribute('role'),x.getAttribute('aria-label'),x.textContent])));
 const pickRecord=async(next)=>{
   await click(filter.locator('button,[role=combobox]').first());
   const listChoice=aPage.locator('[role=option],[role=menuitemradio]').filter({hasText:new RegExp('^'+next+'$')}).filter({visible:true}).last();
   await click(listChoice);
 };
 await pickRecord(name);
 await text.first().waitFor({state:'hidden',timeout:4500});
 await evidence(aPage,'new-task-filter-miss','같은 기록 필터를 선택하면 목록에서 빠짐','전체 할 일에서 보였던 항목이 원본 기록 선택 직후 사라집니다.','TasksHome.tsx');
 await pickRecord('모든 기록');
 await wait(text.first());
 details.taskSource={storedSource:name,label:'직접 추가',includedInAll:true,includedWhenFilteringSource:false};
});
await step('04 목표만 적힌 미팅이 준비 없음으로 보임',async()=>{
 const id='71000000-1000-4000-8000-000000000010';
 const name='가상 다음 미팅';
 const goal='분석 결과 해석의 범위를 확정합니다.';
 const nextDate=new Date(Date.now()+6*86400000).toISOString().slice(0,10);
 await record('meetings',{...itemData(id),title:name,visibility:'shared',date:nextDate,time:'15:00',status:'preparing',memo:'',memoRevision:0,goal,taskIds:[],questionIds:[],versionIds:[]});
 await open(aPage,researchPath+'/meetings/'+id+'?tab=prepare');
 await wait(aPage.getByText(goal,{exact:true}).first());
 await evidence(aPage,'04-meeting-goal-edit','다음 미팅 준비 화면의 저장된 목표','할 일·질문·자료 없이 목표 한 줄만 저장돼 있습니다.','MeetingsPage.tsx');
 await open(aPage,researchPath);
 await wait(aPage.getByText(name,{exact:true}).first());
 const summary=aPage.getByText(/아직 준비한 내용이 없어요|아직 미팅에 가져갈 내용이 없어요/).first();
 await wait(summary);
 await evidence(aPage,'04-meeting-goal-home','홈 다음 미팅의 빈 준비 표시','저장된 목표가 있지만 홈 요약은 준비 내용이 없다고 표시합니다.','HomePage.tsx / NextMeetingPreview.tsx');
 details.goalPreview={stored:goal,homeLabel:await summary.innerText()};
});
await step('24 사용량 화면이 현재와 다른 24시간 제한을 안내',async()=>{
 await open(aPage,researchPath+'?settings=usage');
 const policy=aPage.getByText(/월간 한도는 없고, 최근 24시간 한도만 있어요/);
 await wait(policy);
 await policy.scrollIntoViewIfNeeded();
 await evidence(aPage,'24-usage-policy-stale','사용량 화면의 구형 한도 문구','화면에는 최근 24시간 한도만 있다고 표시되며, 적용한 서버 규칙은 월 크레딧과 분당 제한을 사용합니다.','UsageMeters.tsx / 20261115000000_ai_credits.sql');
 details.usagePolicy={label:await policy.innerText()};
});
}finally{
 await writeFile(join(dir,'connected-evidence.json'),JSON.stringify({details,checks,failures,marks},null,2)+'\n');
 await browser.close();
 await db.close();
}

if (failures.length) process.exitCode = 1;
