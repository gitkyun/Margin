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
const observed=[];
const contexts=[];
const browser=await chromium.launch({ignoreDefaultArgs:['--hide-scrollbars']});
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
const desc='Margin-repo/apps/home-preview/src/pages/reviews/ReviewDetailPage.tsx';
const grant='Margin-repo/apps/home-preview/supabase/migrations/20261104131740_experience_expansion.sql';
let req, currentA, currentB, pinned, second;
const aPage=await make(owner), pPage=await make(professor), ePage=await make(editor), xPage=await make(stranger);
let link=()=>'/reviews/'+req.id;
const row=(p,name)=>p.getByRole('complementary',{name:'검토 항목'}).getByRole('button',{name:new RegExp(name)});
const select=async(p,name)=>click(row(p,name));
const refresh=async(p)=>{await open(p,link()); await wait(p.getByRole('complementary',{name:'검토 항목'}));};

try{
await step('다음 미팅 할 일과 나머지, 미담당과 담당자의 위치 확인',async()=>{
 const fixture=[['d','다음 미팅에 가져갈 초안',owner.id,'2026-12-06'],['e','아직 담당자 없는 원문 점검',null,'2026-11-26'],['f','공동편집자가 맡은 질문 정리',editor.id,'2026-11-26']];
 for(const [d,title,assigneeId,dueDate] of fixture){
   await record('tasks',{...itemData(ident(d)),title,status:'todo',description:'순서와 범위 비교용 합성 데이터',visibility:'shared',priority:'normal',dueDate,feedbackIds:[],assigneeId});
 }
 const id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
 await record('meetings',{...itemData(id),title:'다음 가상 미팅',recordType:'meeting',visibility:'shared',date:'2026-12-08',time:'16:00',status:'preparing',goal:'할 일 묶음 비교',memo:'',memoRevision:0,taskIds:[ident('d')],versionIds:[],questionIds:[]});
 const current=(await workspace(owner)).researches.find(x=>x.id===research);
 await rpc(owner,'rms_save_research',{p_value:{...current,nextMeetingId:id}});
 assert.equal((await workspace(owner)).researches.find(x=>x.id===research).nextMeetingId,id);
 const list=p=>p.locator('.hm-lists .hm-list').first();
 const query='/r/'+research+'?tab=tasks';
 await open(aPage,query);
 await wait(list(aPage).getByText(fixture[0][1],{exact:true}));
 const homeOwn=await list(aPage).innerText();
 assert.ok(homeOwn.indexOf(fixture[0][1])<homeOwn.indexOf('그 밖의 할 일'));
 assert.ok(homeOwn.indexOf(fixture[1][1])>homeOwn.indexOf('그 밖의 할 일'));
 assert.ok(!homeOwn.includes(fixture[2][1]));
 await evidence(aPage,'home-owner','학생 › 내 할 일과 다음 미팅 묶음','기한이 더 늦은 미팅 초안이 첫 묶음에 온다. 둘째 묶음은 이름이 있고 ‘내 할 일’에도 미담당이 들어온다.','Margin-repo/apps/home-preview/src/pages/HomePage.tsx:562','격리 마진 실화면');
 await open(ePage,query);
 await wait(list(ePage).getByText(fixture[2][1],{exact:true}));
 const homeEditor=await list(ePage).innerText();
 assert.ok(homeEditor.includes(fixture[1][1]));
 assert.ok(!homeEditor.includes(fixture[0][1]));
 await evidence(ePage,'home-editor','공동편집자 › 같은 연구의 내 할 일','편집자가 맡은 일과 미담당이 남는다. 학생의 미팅 초안은 이 탭에서 빠졌다.','Margin-repo/apps/home-preview/src/pages/HomePage.tsx:748','격리 마진 실화면');
 const all=ePage.getByText('모두',{exact:true}).first();
 await click(all);
 await wait(list(ePage).getByText(fixture[0][1],{exact:true}));
 await evidence(ePage,'home-all','공동편집자 › 모두로 전환','같은 미팅 초안과 세 할 일이 모두 나온다. 선택 범위와 우선순위를 독립해서 설계할 수 있다.','Margin-repo/apps/home-preview/src/lib/home-lists.ts:41','격리 마진 실화면');
});
await step('자료 미리보기 전후 공유 표기의 가시성',async()=>{
 const wide=await make(owner,{width:1760,height:990});
 await open(wide,'/r/'+research+'/docs');
 const shared=wide.locator('.docs-row').filter({hasText:'공유할 가상 비교표'});
 const personal=wide.locator('.docs-row').filter({hasText:'학생만 보는 가상 메모'});
 await wait(shared);
 const fold=button(wide,'사이드 창 접기');
 if(await fold.count())await click(fold);
 await wait(shared.getByText('함께 보기',{exact:true}));
 await evidence(wide,'docs-scope-wide','마진 › 넓은 목록에 공개 범위 열','함께 보기와 나만 보기 열이 표시된다. 합성 자료의 공개 범위는 서로 다르다.','Margin-repo/apps/home-preview/src/pages/docs/docs.css:446','격리 마진 실화면');
 await click(button(shared,'공유할 가상 비교표 미리보기'));
 await wait(wide.getByRole('complementary',{name:'미리보기'}));
 assert.equal(await shared.getByText('함께 보기',{exact:true}).isVisible(),false);
 assert.equal(await personal.locator('.docs-row-lock').isVisible(),true);
 await evidence(wide,'docs-scope-preview','마진 › 같은 표를 미리보기로 열었을 때','오른쪽 미리보기와 함께 목록 열이 줄었다. 개인 자료 자물쇠는 남았지만 공동 자료의 함께 보기 열은 화면에서 빠졌다.','Margin-repo/apps/home-preview/src/pages/docs/DocsPage.tsx:634','격리 마진 실화면');
});
await step('같은 자료 화면에서 짧고 긴 본문, 스크롤바 유무를 따로 측정',async()=>{
 await open(aPage,'/r/'+research+'/docs');
 await wait(aPage.locator('.docs-head h1'));
 const read=()=>aPage.evaluate(()=>{
   const box=document.querySelector('.workspace-content');
   const heading=document.querySelector('.docs-head h1');
   return {outer:window.innerWidth-document.documentElement.clientWidth,client:box.clientWidth,actual:box.offsetWidth- box.clientWidth,titleX:Math.round(heading.getBoundingClientRect().x),scrollHeight:box.scrollHeight,height:box.clientHeight,gutter:getComputedStyle(box).scrollbarGutter};
 });
 const add=()=>aPage.evaluate(()=>{const parent=document.querySelector('.workspace-content');const e=document.createElement('div');e.id='margin-audit-scroll-test';e.style.height='2000px';parent.append(e);});
 const clear=()=>aPage.evaluate(()=>document.querySelector('#margin-audit-scroll-test').remove());
 const overlayShort=await read();
 await add();
 const overlayLong=await read();
 await clear();
 await aPage.addStyleTag({content:'.workspace-content::-webkit-scrollbar{width:14px}.workspace-content::-webkit-scrollbar-thumb{background:#7d8994}'});
 const classicShort=await read();
 await add();
 const classicLong=await read();
 const results={overlayShort,overlayLong,classicShort,classicLong};
 assert.ok(classicLong.scrollHeight>classicLong.height);
 await writeFile(join(dir,'scrollbar-measurements.json'),JSON.stringify(results,null,2)+'\n');
 assert.equal(classicLong.actual,14, JSON.stringify(results));
 await evidence(aPage,'scrollbar-14px','마진 › 안쪽 스크롤바에 폭 14px을 둔 실험','로컬 브라우저에서만 14px 고정 폭 CSS로 모형을 만들었다. 실제 안쪽 스크롤의 제목 x는 '+classicShort.titleX+'→'+classicLong.titleX+'px, 본문 너비는 '+classicShort.client+'→'+classicLong.client+'px였다.','Margin-repo/apps/home-preview/src/components/shell/shell.css:264','격리 마진 · 스크롤 가정');
});
} finally{
 await flush();
 await writeFile(join(dir,'checks.json'),JSON.stringify({checks,failures,shots:marks.length},null,2)+'\n');
 await browser.close();
 await db.close();
 console.log(JSON.stringify({checks,failures,shots:marks.length},null,2));
}

if (failures.length) process.exitCode = 1;
