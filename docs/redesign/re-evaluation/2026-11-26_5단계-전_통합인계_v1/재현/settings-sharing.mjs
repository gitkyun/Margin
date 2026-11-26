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

const targetTitle='가상 논문 권한 실험';
const waitUntil=async (fn,message)=>{
 for (let i=0;i<26;i+=1) {
   if(await fn())return;
   await new Promise(resolve=>setTimeout(resolve,240));
 }
 throw new Error(message);
};
const renderRequest=(page,id)=>open(page,'/reviews/'+id);
const before=await input(owner,'rms_create_review',{researchId:research,title,professorEmail:professor.email,resultIds:[docs.A,docs.B]});
const previousStop=await input(owner,'rms_create_review',{researchId:research,title:'기존에 멈춘 가상 검토',professorEmail:professor.email,resultIds:[docs.A]});
await input(owner,'rms_set_sharing',{requestId:previousStop.id,status:'stopped',professorEmail:professor.email});
req=before;
const state=async id=>(await workspace(owner)).reviews.find(r=>r.id===id);
const canRead=(actor,id)=>rpc(actor,'rms_can_read_request',{p_id:id});
const readyReview=(page)=>wait(page.getByRole('complementary',{name:'검토 항목'}));
const stateBadge=(p)=>p.locator('.review-sharing-current').first();
try{
await step('새 방문의 패널 열림과 저장된 접힘, Esc 뒤 원래 설정 버튼',async()=>{
 const route='/r/'+research;
 await open(aPage,route);
 const rail=aPage.getByRole('toolbar',{name:'옆 창 열기'});
 const fold=button(rail,'사이드 창 접기');
 await wait(fold);
 await evidence(aPage,'panel-fresh-1440','마진 › 새 방문의 1440px 패널','저장된 선택 없는 상태. 기본 옆 창이 열리고 시작 탭은 할 일이다.','Margin-repo/apps/home-preview/src/lib/side-panel.ts','격리 마진 실화면');
 await click(fold);
 await wait(button(rail,'사이드 창 펼치기'));
 await open(aPage,route);
 await wait(button(rail,'사이드 창 펼치기'));
 await evidence(aPage,'panel-remembered-1440','마진 › 1440px에서 다시 방문','같은 폭에서 새로 열어도 사용자가 닫은 상태를 기억했다.','Margin-repo/apps/home-preview/src/lib/side-panel.ts','격리 마진 실화면');
 const settings=button(rail,'설정');
 await click(settings);
 const nav=aPage.getByRole('navigation',{name:'설정 항목'});
 await wait(nav);
 await click(button(nav,'화면'));
 await wait(aPage.getByRole('heading',{name:'화면 설정'}));
 await evidence(aPage,'settings-appearance-1440','마진 › 설정의 내 계정·이 연구 구획','열었던 연구 위에 설정이 겹친다. 왼쪽 선택 화면, 오른쪽 모드 전환 예시를 봤다.','Margin-repo/apps/home-preview/src/components/settings/SettingsDialog.tsx','격리 마진 실화면');
 await aPage.keyboard.press('Escape');
 await nav.waitFor({state:'hidden',timeout:8000});
 await waitUntil(()=>settings.evaluate(el=>el===document.activeElement),'초점이 설정 버튼으로 돌아오지 않음');
 assert.equal(new URL(aPage.url()).searchParams.has('settings'),false);
 await evidence(aPage,'settings-escape-1440','마진 › Esc로 설정을 닫고 복귀','설정 주소만 없어지고 바탕 연구가 유지됐다. 키보드 초점은 같은 설정 버튼으로 돌아왔다.','Margin-repo/apps/home-preview/src/components/settings/SettingsDialog.tsx','격리 마진 실화면');
});
await step('패널 키보드 너비 변화와 기본 복귀',async()=>{
 await open(aPage,'/r/'+research+'?panel=assistant');
 const grip=aPage.getByRole('separator',{name:'패널 너비 조절'});
 await wait(grip);
 const panel=aPage.locator('#margin-panel');
 const width=async()=>Math.round((await panel.boundingBox()).width);
 const initialWidth=await width();
 await grip.press('ArrowLeft');
 await waitUntil(async()=>await width()>initialWidth,'패널이 왼쪽 키로 넓어지지 않음');
 const next=await width();
 await evidence(aPage,'panel-keyboard-resized','마진 › 손잡이 방향키로 넓히기','오른쪽 패널 '+initialWidth+'px → '+next+'px. 본문을 함께 밀지만 현재 연구와 패널 내용은 유지된다.','Margin-repo/apps/home-preview/src/components/margin-panel/PanelResizer.tsx','격리 마진 실화면');
 await grip.press('Home');
 await waitUntil(async()=>await width()===initialWidth,'기본 패널 너비 복원이 안 됨');
});
await step('설정 390px은 메뉴와 본문을 왕복해서 본다',async()=>{
 const mobile=await make(owner,{width:390,height:844});
 await open(mobile,'/r/'+research+'?settings=display');
 await wait(mobile.getByRole('heading',{name:'화면 설정'}));
 await evidence(mobile,'settings-mobile-content','마진 › 390px 설정 내용','화면 설정 본문을 한 화면에서 본다. 모바일 모형은 Chromium 화면 폭 조절이다.','Margin-repo/apps/home-preview/src/components/settings/SettingsDialog.tsx','격리 마진 실화면');
 await click(mobile.locator('.settings-dialog-back'));
 const nav=mobile.getByRole('navigation',{name:'설정 항목'});
 await wait(nav);
 await evidence(mobile,'settings-mobile-list','마진 › 390px 설정 목록으로 한 단계 돌아감','내 계정과 이 연구가 같은 항목 목록 안에서 구분된다.','Margin-repo/apps/home-preview/src/components/settings/SettingsDialog.tsx','격리 마진 실화면');
 await click(button(nav,'화면'));
 await wait(mobile.getByRole('heading',{name:'화면 설정'}));
});
await step('교수·편집자 겸임의 공유 중지와 재지정 결과',async()=>{
 await input(owner,'rms_member_action',{action:'invite',researchId:research,email:professor.email});
 await input(professor,'rms_member_action',{action:'accept',researchId:research});
 await refresh(aPage);
 await click(button(aPage,'공유 설정'));
 const dialog=aPage.getByRole('dialog',{name:'공유 설정'});
 await wait(dialog);
 await evidence(aPage,'sharing-stop-copy','학생 › 겸임 교수 대상 공유 중지 안내','화면에 공유를 중지하면 교수님이 열 수 없다고 표시된다.','Margin-repo/apps/home-preview/src/pages/reviews/ReviewDetailPage.tsx:1826');
 const slide=dialog.getByRole('slider',{name:'밀어서 공유 중지'});
 await slide.focus();
 await slide.press('End');
 await waitUntil(async()=>((await state(req.id))?.status)==='stopped','검토 공유가 SQL에서 중지되지 않음');
 assert.equal(await canRead(professor,req.id),true);
 await refresh(pPage);
 assert.equal(await radio(pPage,'추가 수정 필요').count(),0);
 assert.equal(await button(pPage,'공유 설정').count(),1);
 await evidence(pPage,'overlap-stopped-still-reads','겸임 교수 › 공유 중지 뒤 같은 URL 본문','교수 응답은 사라졌다. 공동편집 권한으로 연구와 검토 본문은 남았다.','Margin-repo/apps/home-preview/supabase/migrations/20261104131740_experience_expansion.sql:29');
 await refresh(aPage);
 await click(button(aPage,'공유 설정'));
 await click(button(aPage.getByRole('dialog',{name:'공유 설정'}),'다시 공유'));
 await waitUntil(async()=>((await state(req.id))?.status)==='shared','검토의 다시 공유 상태가 반영되지 않음');
 await refresh(pPage);
 await wait(radio(pPage,'추가 수정 필요'));
 await evidence(pPage,'overlap-reopened-response','겸임 교수 › 공유 재개 뒤 응답 복귀','같은 URL에서 다시 공유하자 지정 교수 응답을 다시 할 수 있다.',desc);
 await refresh(aPage);
 await click(button(aPage,'공유 설정'));
 await dialog.getByRole('textbox',{name:'교수 계정 이메일'}).fill(stranger.email);
 await evidence(aPage,'sharing-reassign-copy','학생 › 교수 재지정 전 안내','이전에 지정된 계정이 열 수 없다는 문구와 새 수신 계정 입력을 확인했다. 외부 메일을 보내지 않는다.',desc);
 await click(button(dialog,'설정 저장'));
 await waitUntil(async()=>((await state(req.id))?.professorEmail)===stranger.email,'새 교수 이메일이 반영되지 않음');
 await refresh(pPage);
 await readyReview(pPage);
 assert.equal(await radio(pPage,'추가 수정 필요').count(),0);
 await evidence(pPage,'former-professor-editor-reads','예전 지정 교수 › 재지정 뒤에도 공동 편집 권한으로 열림','본문 열람과 공유 설정이 유지됐다. 지정 교수로서 응답하는 양식은 사라졌다.',desc);
 await refresh(xPage);
 await wait(radio(xPage,'추가 수정 필요'));
 assert.equal(await button(xPage,'공유 설정').count(),0);
 await evidence(xPage,'new-professor-can-respond','새 지정 교수 › 해당 검토만 응답','연구 편집 권한 없이 검토 응답을 할 수 있다. 이 장면에서는 실제 답을 전송하지 않았다.',desc);
});
await step('AI 일반 질문에 쓰는 연구 행을 역할별로 읽음',async()=>{
 const load=(actor)=>scoped(actor,tx=>tx.query("select id,kind,data->>'title' as title from public.rms_records where research_id=$1 and kind='materials' order by id",[research]));
 const fromOwner=(await load(owner)).rows;
 const fromEditor=(await load(editor)).rows;
 const fromAssigned=(await load(stranger)).rows;
 assert.equal(fromOwner.some(r=>r.id===docs.personal),true);
 assert.equal(fromOwner.some(r=>r.id===docs.material),true);
 assert.equal(fromEditor.some(r=>r.id===docs.personal),false);
 assert.equal(fromEditor.some(r=>r.id===docs.material),true);
 assert.equal(fromAssigned.length,0);
 await writeFile(join(dir,'ai-context-visibility.json'),JSON.stringify({test:'일반 연구 질문의 같은 권한 SQL · materials 예',owner:fromOwner,editor:fromEditor,reviewOnlyProfessor:fromAssigned},null,2)+'\n');
 await open(aPage,'/r/'+research+'/docs?panel=assistant');
 const docsMain=aPage.getByText('학생만 보는 가상 메모',{exact:true}).first();
 await wait(docsMain);
 await evidence(aPage,'ai-input-owner-materials','학생 › 같은 합성 연구의 원본 범위','학생 자료 목록에는 개인 자료와 공동 자료가 있다. 모델 응답은 이 장면에서 실행하지 않았다.','Margin-repo/apps/home-preview/supabase/functions/ai-assist/index.ts:480','격리 SQL · AI 호출 없음');
 await open(ePage,'/r/'+research+'/docs?panel=assistant');
 await wait(ePage.getByText('공유할 가상 비교표',{exact:true}).first());
 assert.equal(await ePage.getByText('학생만 보는 가상 메모',{exact:true}).count(),0);
 await evidence(ePage,'ai-input-editor-materials','편집자 › 같은 합성 연구의 원본 범위','이전 장면과 같은 연구에서 개인 자료의 제목·본문을 제외한다. 해당 모델 출력까지 확인하려면 운영 질문이 필요하다.','Margin-repo/apps/home-preview/supabase/functions/ai-assist/index.ts:480','격리 SQL · AI 호출 없음');
});
await step('휴지통 이동과 복원 뒤 두 링크의 상태를 각각 확인',async()=>{
 await input(owner,'rms_set_sharing',{requestId:req.id,status:'shared',professorEmail:stranger.email});
 assert.equal((await state(req.id)).status,'shared');
 assert.equal((await state(previousStop.id)).status,'stopped');
 await open(aPage,'/r/'+research+'?settings=danger');
 await click(button(aPage,'휴지통으로 옮기기').first());
 const confirm=aPage.getByRole('dialog',{name:'연구를 휴지통으로 옮길까요?'});
 await wait(confirm);
 await evidence(aPage,'trash-warning','학생 › 연구 휴지통 이동 확인','휴지통 이동 시 공유 중 교수 링크가 멈추고 연구를 복원해도 링크는 자동 재개되지 않는다는 안내.', 'Margin-repo/apps/home-preview/src/pages/SettingsPage.tsx:1085');
 await click(button(confirm,'휴지통으로 옮기기'));
 await aPage.waitForURL(/view=trash/,{timeout:9000});
 assert.equal(await canRead(stranger,req.id),false);
 assert.equal(await canRead(professor,previousStop.id),false);
 await evidence(aPage,'trash-card','학생 › 휴지통 카드에 복원과 완전히 삭제','완전히 삭제는 버튼과 확인창 열기·취소만 봤다. 데이터 검증은 가상 DB에서 했다.','Margin-repo/apps/home-preview/src/pages/AuthPages.tsx:580');
 await click(button(aPage,'완전히 삭제'));
 const permanent=aPage.getByRole('dialog',{name:'연구를 완전히 삭제할까요?'});
 await wait(permanent);
 await evidence(aPage,'permanent-confirm','학생 › 완전히 삭제 확인창','영구 삭제는 별도 창에 안내와 슬라이더가 나온다. 이 창에서는 취소했다.','Margin-repo/apps/home-preview/src/components/PermanentResearchDelete.tsx:104');
 await click(button(permanent,'취소'));
 await permanent.waitFor({state:'hidden',timeout:6800});
 await click(button(aPage,'복원').first());
 await waitUntil(async()=>!(await workspace(owner)).researches.find(row=>row.id===research)?.deletedAt,'SQL 복원이 되지 않음');
 assert.equal((await state(req.id)).status,'stopped');
 assert.equal((await state(previousStop.id)).status,'stopped');
 assert.equal(await canRead(stranger,req.id),false);
 await renderRequest(aPage,req.id);
 await readyReview(aPage);
 await click(button(aPage,'공유 설정'));
 await wait(stateBadge(aPage));
 await evidence(aPage,'restored-request-remains-stopped','학생 › 연구 복원 뒤 기존 공유 링크는 중지','원래 공유 중이던 A와 원래 중지된 B 모두 중지 상태였다.','Margin-repo/apps/home-preview/supabase/migrations/20261107001631_restore_research_references.sql:21');
 await renderRequest(xPage,req.id);
 await wait(xPage.getByText(/이 검토를|접근할 수 없|검토를 찾을 수 없|볼 수 없|초대받은/).first());
 assert.equal(await radio(xPage,'추가 수정 필요').count(),0);
 await evidence(xPage,'restored-professor-cannot-open','지정 교수 › 연구 복원 뒤 같은 링크는 안 열림','연구 복원으로 이전 교수 링크가 재개되지 않았다.','Margin-repo/apps/home-preview/supabase/tests/backend.test.mjs:220');
});
} finally{
 await flush();
 await writeFile(join(dir,'checks.json'),JSON.stringify({checks,failures,shots:marks.length},null,2)+'\n');
 await browser.close();
 await db.close();
 console.log(JSON.stringify({checks,failures,shots:marks.length},null,2));
}

if (failures.length) process.exitCode = 1;
