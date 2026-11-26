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

try{
await step('학생이 파일 붙은 두 항목을 골라 공유 미리보기와 검토 링크 생성',async()=>{
 await open(aPage,`/r/${research}/reviews?new=1`);
 const dlg=aPage.getByRole('dialog',{name:'검토 요청 만들기'});
 await wait(dlg);
 await dlg.getByRole('textbox',{name:'검토 요청 제목'}).fill(title);
 const email=dlg.getByRole('textbox',{name:'교수 계정 이메일'});
 if(await email.count())await email.fill(professor.email);
 for(const name of [A,B])await click(dlg.locator('.review-pick-row').filter({hasText:name}).getByRole('checkbox'));
 await evidence(aPage,'student-two-items','학생 › PDF가 붙은 두 항목 선택','두 수정 결과를 골랐다. 같은 가상 PDF의 1쪽·2쪽이다.','Margin-repo/apps/home-preview/src/components/reviews/ReviewComposeDialog.tsx');
 await click(button(dlg,'공유할 내용 확인'));
 const build=button(aPage,'검토 링크 만들기');
 await wait(build);
 await evidence(aPage,'student-share-preview','학생 › 공개 범위 확인','링크 만들기 전에 연구 방향, 지정 교수, 설명과 첨부 파일의 범위를 본다. 메일 발송은 실행하지 않았다.','Margin-repo/apps/home-preview/src/components/reviews/ReviewComposeDialog.tsx');
 await click(build);
 await aPage.waitForURL(/\/reviews\/[^/?]+/,{timeout:9500});
 const own=await workspace(owner);
 req=own.reviews.find(r=>r.title===title);
 assert.ok(req);
});
if(!req){
 req=await input(owner,'rms_create_review',{researchId:research,title,professorEmail:professor.email,resultIds:[docs.A,docs.B]});
 checks.push('후속 검증용 요청은 격리 SQL에서 만들었다');
}
const initial=await workspace(owner);
assert.equal(initial.reviewItems.filter(it=>it.requestId===req.id).length,2);
const itemA=initial.reviewItems.find(it=>it.requestId===req.id&&it.resultId===docs.A);
const itemB=initial.reviewItems.find(it=>it.requestId===req.id&&it.resultId===docs.B);
currentA=initial.rounds.find(r=>r.itemId===itemA.id&&r.number===1);
currentB=initial.rounds.find(r=>r.itemId===itemB.id&&r.number===1);

await step('동일 요청의 학생·지정 교수·일반 편집자·관계없는 계정 및 비로그인 화면',async()=>{
 await refresh(aPage);await refresh(pPage);await refresh(ePage);
 assert.equal(await radio(aPage,'추가 수정 필요').count(),0);
 assert.equal(await button(pPage,'공유 설정').count(),0);
 await wait(radio(pPage,'추가 수정 필요'));
 assert.equal(await radio(ePage,'추가 수정 필요').count(),0);
 assert.equal(await button(ePage,'공유 설정').count(),1);
 const pData=await workspace(professor), outside=await workspace(stranger);
 assert.equal(pData.researches.length,0);assert.equal(pData.reviews.length,1);
 assert.equal(outside.reviews.length,0);
 assert.equal(await rpc(professor,'rms_can_read_file',{p_path:path(docs.file1)}),true);
 assert.equal(await rpc(professor,'rms_can_read_file',{p_path:path(docs.personalFile)}),false);
 await evidence(aPage,'student-request-saved','학생 › 저장된 두 항목과 발신 조작','공유 설정과 다시 확인은 보인다. 교수 응답 양식은 표시되지 않는다.',desc);
 await evidence(pPage,'professor-only','지정 교수 › 단독 검토 화면','같은 주소에서 최신 차수에 응답할 수 있다. 연구 관리 메뉴와 비공개 가상 PDF는 열리지 않는다.',grant);
 await evidence(ePage,'editor-no-response','공동연구자 › 편집자지만 지정 교수는 아닌 경우','공유 설정은 표시되고 교수 응답 양식은 표시되지 않는다.',desc);
 await open(xPage,link());await wait(one(xPage.getByText(/이 검토를|접근할 수 없|검토를 찾을 수 없|볼 수 없|초대받은/)));
 assert.equal(await row(xPage,A).count(),0);
 await evidence(xPage,'outside-denied','다른 계정 › 같은 검토 링크의 접근 거절','본문과 공유 파일, 응답 조작을 볼 수 없다.',grant);
 const anon=await make(null);
 await open(anon,link());await wait(one(anon.getByRole('heading',{name:'로그인'})));
 assert.equal(await row(anon,A).count(),0);
 await evidence(anon,'signed-out','비로그인 › 검토 링크에서 로그인 안내','로그인 전에는 검토 내용이 표시되지 않는다.',desc);
});
await step('지정 교수가 A는 수정 요청, B는 확인으로 저장',async()=>{
 await refresh(pPage);await select(pPage,A);
 await click(radio(pPage,'추가 수정 필요'));
 await click(button(pPage,'응답 저장'));
 const reasonInput=pPage.getByRole('textbox',{name:'추가로 수정할 내용'});
 await wait(reasonInput);
 const bad=await workspace(owner);
 assert.equal(bad.responses.filter(r=>r.roundId===currentA.id).length,0);
 await evidence(pPage,'professor-reason-required','교수 › 수정 요청 사유 입력 전','사유 없이 저장을 눌렀다. 해당 항목의 SQL 응답은 0건이다.',desc);
 await reasonInput.fill(reason);
 await click(button(pPage,'응답 저장'));
 await wait(one(pPage.getByText('내가 남긴 응답',{exact:false})));
 await evidence(pPage,'professor-changes-saved','교수 › A에 추가 수정 필요 저장','수정 요청과 사유가 저장된 뒤 다시 표시된다.',desc);
 await select(pPage,B);
 await click(radio(pPage,'수정 내용 확인'));
 await click(button(pPage,'응답 저장'));
 await wait(one(pPage.getByText('내가 남긴 응답',{exact:false})));
 const after=await workspace(owner);
 assert.equal(after.responses.find(r=>r.roundId===currentA.id).result,'changes_requested');
 assert.equal(after.responses.find(r=>r.roundId===currentB.id).result,'confirmed');
 await evidence(pPage,'professor-item-b-confirmed','교수 › B에 수정 내용 확인 저장','두 항목의 응답은 독립적으로 저장된다.',grant);
});
await step('PDF 핀 댓글을 저장하고 학생이 답글·해결·다시 열기를 누름',async()=>{
 await refresh(pPage);await select(pPage,A);
 const canvas=pPage.locator('.pdf-canvas-stage canvas').first();
 await wait(canvas);
 await click(button(pPage,'PDF 위치 핀 찍기'));
 const dims=await canvas.boundingBox();
 assert.ok(dims);
 await canvas.click({position:{x:Math.round(dims.width*.38),y:Math.round(dims.height*.23)}});
 const text=pPage.getByRole('textbox',{name:'검토 댓글'});
 assert.match(await text.inputValue(),/^\[p\.1 @ /);
 await text.fill((await text.inputValue())+note);
 await click(button(pPage,'댓글 남기기'));
 await wait(pPage.locator('.review-comment-thread').filter({hasText:note}));
 pinned=(await workspace(owner)).comments.find(c=>c.body.includes(note));
 assert.match(pinned.body,/^\[p\.1 @ /);
 await evidence(pPage,'professor-pin-posted','교수 › 같은 PDF 페이지에 위치 댓글 저장','가상 PDF에 직접 누른 좌표와 댓글 내용이 함께 저장된다.',desc);
 await refresh(aPage);await select(aPage,A);
 const thread=aPage.locator('.review-comment-thread').filter({hasText:note});
 await wait(thread);
 await click(button(thread,'답글'));
 await aPage.getByRole('textbox',{name:'검토 댓글'}).fill(reply);
 await click(button(aPage,'답글 남기기'));
 await wait(thread.getByText(reply,{exact:true}));
 let data=await workspace(owner);
 assert.equal(data.comments.find(c=>c.body===reply).parentId,pinned.id);
 await evidence(aPage,'student-comment-reply','학생 › PDF 위치 댓글에 답글 저장','답글이 같은 대화 아래에 표시되고 SQL에서도 부모 댓글을 가리킨다.',desc);
 await click(button(thread,'해결로 표시'));
 const resolvedButton=button(aPage,/해결한 댓글 1개/);
 await wait(resolvedButton);
 await evidence(aPage,'student-comment-folded','학생 › 해결한 댓글이 기본 접힘','해결하자 해당 대화가 접히고 해결한 댓글 1개로 묶인다.',desc);
 await click(resolvedButton);
 await wait(button(thread,'다시 열기'));
 data=await workspace(owner);
 assert.equal(data.comments.find(c=>c.id===pinned.id).resolved,true);
 assert.equal(data.responses.find(r=>r.roundId===currentA.id).result,'changes_requested');
 await evidence(aPage,'student-comment-resolved','학생 › 위치 댓글의 답글과 해결','댓글은 해결됨으로 표시된다. 교수의 A 응답은 추가 수정 필요로 남는다.',desc);
 await click(button(thread,'다시 열기'));
 await wait(button(thread,'해결로 표시'));
 data=await workspace(owner);
 assert.equal(data.comments.find(c=>c.id===pinned.id).resolved,false);
 assert.equal(data.comments.find(c=>c.body===reply).parentId,pinned.id);
 assert.equal(data.responses.find(r=>r.roundId===currentA.id).result,'changes_requested');
 await evidence(aPage,'student-comment-reopened','학생 › 해결한 대화 다시 열기','해결 취소 후 같은 위치·내용·답글이 남는다.',desc);
});
await step('학생이 A만 2차로 재확인하고 교수는 기존 A·B 차수를 구분',async()=>{
 await record('results',{...savedA,title:A,description:'v2에서 비교 기준의 적용 범위를 보완했습니다.',versionId:docs.file2});
 await refresh(aPage);await select(aPage,A);
 await click(button(aPage,'다시 확인 요청'));
 const dlg=aPage.getByRole('dialog',{name:/이 항목만 다시 확인/});
 await wait(dlg);
 await evidence(aPage,'student-recheck-confirm','학생 › 항목 하나의 2차 재확인 확인창','두 항목 중 A만 새 차수로 올린다. 이전 설명·첨부·응답은 기록으로 남는다고 보여 준다.',desc);
 await click(dlg.getByRole('checkbox',{name:/설명과 파일 전체/}));
 await click(button(dlg,'2차 검토 요청'));
 await dlg.waitFor({state:'hidden',timeout:9000});
 const data=await workspace(owner);
 second=data.rounds.find(r=>r.itemId===itemA.id&&r.number===2);
 assert.equal(second.versionId,docs.file2);
 assert.equal(data.rounds.find(r=>r.id===currentA.id).versionId,docs.file1);
 assert.equal(data.rounds.filter(r=>r.itemId===itemB.id).length,1);
 assert.equal(data.responses.find(r=>r.roundId===currentB.id)?.result,'confirmed');
 await evidence(aPage,'student-recheck-created','학생 › A는 2차, B는 1차 유지','데이터베이스에서 A의 PDF v2가 새로 고정되고 B의 1차 확인이 유지됨을 확인했다.',grant);
 await refresh(pPage);await select(pPage,A);
 const rounds=pPage.getByRole('combobox',{name:/검토,/}).first();
 await click(rounds);
 const previous=pPage.getByRole('option',{name:/1차 검토/}).or(pPage.getByRole('menuitemradio',{name:/1차 검토/})).first();
 await click(previous);
 await pPage.waitForURL(new RegExp('round='+currentA.id),{timeout:8500});
 await wait(one(pPage.getByText(/최신 검토에서 결과를/)));
 await radio(pPage,'추가 수정 필요').waitFor({state:'hidden',timeout:6000});
 await evidence(pPage,'professor-old-round-readonly','교수 › 지나간 1차 다시 보기','이전 원본과 응답 기록은 표시된다. 최신 A 2차가 있어 이전 차수 응답 버튼은 없다.',desc);
});
await step('390px에서 같은 검토의 문서·응답 탐색',async()=>{
 const mobile=await make(professor,{width:390,height:844});
 await refresh(mobile);await select(mobile,A);
 const text=await mobile.locator('body').innerText();
 assert.match(text,/검토|교수/);
 await evidence(mobile,'professor-mobile-document','교수 › 390px 문서 보기','모바일 검토 화면을 역할과 같은 주소로 열었다.',desc);
 const response=mobile.getByRole('tab',{name:/응답|댓글/}).or(button(mobile,/^교수 응답과 댓글$/)).first();
 if(await response.count()&&await response.isVisible()){
   await click(response);
   await evidence(mobile,'professor-mobile-response','교수 › 390px 응답·댓글 탭','문서 보기와 응답·댓글을 화면 내에서 전환했다.',desc);
 }
});
await step('학생이 공유를 중지해 지정 교수 접근이 사라지는 화면',async()=>{
 await refresh(aPage);
 await click(button(aPage,'공유 설정'));
 const dialog=aPage.getByRole('dialog',{name:'공유 설정'});
 await wait(dialog);
 const slide=dialog.getByRole('slider',{name:'밀어서 공유 중지'});
 if(await slide.count()){
   await slide.focus();
   await slide.press('End');
   if(await slide.isVisible()&&((await workspace(owner)).reviews.find(r=>r.id===req.id)?.status==='shared')){
     const box=await slide.boundingBox();
     if(box){
       await aPage.mouse.move(box.x+25,box.y+box.height/2);
       await aPage.mouse.down();await aPage.mouse.move(box.x+box.width-3,box.y+box.height/2,{steps:16});await aPage.mouse.up();
     }
   }
 }
 let state=(await workspace(owner)).reviews.find(r=>r.id===req.id);
 assert.equal(state.status,'stopped');
 await open(pPage,link());
 await wait(one(pPage.getByText(/이 검토를|접근할 수 없|검토를 찾을 수 없|볼 수 없/)));
 assert.equal((await workspace(professor)).reviews.length,0);
 await evidence(pPage,'professor-after-stop','지정 교수 › 공유 중지 뒤 같은 주소','학생의 공유 중지 후 지정 교수에게도 검토 본문과 파일이 열리지 않는다.',grant);
 await input(owner,'rms_set_sharing',{requestId:req.id,status:'shared',professorEmail:professor.email});
});
await step('같은 지정 교수를 편집자로 초대·수락하고 두 종류의 버튼과 SQL 동작 확인',async()=>{
 const active=(await workspace(owner)).reviews.find(r=>r.id===req.id);
 if(active.status!=='shared')await input(owner,'rms_set_sharing',{requestId:req.id,status:'shared',professorEmail:professor.email});
 await open(aPage,`/r/${research}?settings=people`);
 const settings=aPage.getByRole('dialog',{name:'설정'});
 await wait(settings);
 const field=settings.getByRole('textbox',{name:/이메일 주소|초대할 이메일|이메일/}).first();
 if(await field.count()){
   await field.fill(professor.email);
   const b=button(settings,/^(초대하기|초대 보내기|초대 메일 보내기|공동연구자 초대)$/).first();
   if(await b.count()){
     await click(b);
     await aPage.waitForFunction(()=>document.body.innerText.includes('초대 링크')||document.body.innerText.includes('메일을 보내지 못'),{timeout:12000}).catch(()=>{});
     if(inviteToken)await evidence(aPage,'teacher-editor-invite','학생 › 지정 교수에게 공동연구 초대 만들기','가상 링크를 만들었고 메일 전송은 모의 실패로 처리했다.',grant);
   }
 }
 if(!inviteToken){
   inviteToken=randomBytes(25).toString('base64url');
   await input(owner,'rms_project_invite_create',{researchId:research,email:professor.email,role:'editor',tokenHash:createHash('sha256').update(inviteToken).digest('hex')});
 }
 await open(pPage,'/join?token='+inviteToken);
 const accept=button(pPage,/수락|참여하기/).first();
 await wait(accept);
 await evidence(pPage,'teacher-editor-join','지정 교수 › 공동연구자 초대 수락 전','초대받은 테스트 계정에서 공동연구자 초대를 연 화면.',grant);
 await click(accept);
 await pPage.waitForURL(new RegExp('/r/'+research),{timeout:9000});
 assert.equal((await workspace(professor)).members.find(r=>r.researchId===research&&r.userId===professor.id)?.status,'active');
 await refresh(pPage);await select(pPage,A);
 await wait(button(pPage,'공유 설정'));
 await wait(button(pPage,'다시 확인 요청'));
 await wait(radio(pPage,'추가 수정 필요'));
 await evidence(pPage,'professor-editor-overlap','지정 교수와 편집자 겸임 › 두 역할의 버튼이 동시에 열림','같은 검토·PDF에 교수 응답, 공유 설정, 다시 확인 요청이 함께 표시된다.',desc);
 await click(button(pPage,'공유 설정'));
 const share=pPage.getByRole('dialog',{name:'공유 설정'});
 await wait(share);
 await evidence(pPage,'professor-editor-share','겸임 교수 › 자기 검토의 공유 설정을 열었을 때','가상 검토에서도 공유 화면이 열렸다. 수신자 변경은 하지 않았다.',desc);
 await click(button(share,'취소'));
 await share.waitFor({state:'hidden',timeout:8500});
 const prev=(await workspace(owner)).rounds.filter(r=>r.itemId===itemA.id).length;
 assert.equal(await rpc(professor,'rms_can_read_record',{p_id:docs.A}),false);
 assert.equal(await rpc(professor,'rms_can_read_record',{p_id:docs.file2}),true);
 const recheckButton=button(pPage,'다시 확인 요청');
 assert.equal(await recheckButton.isDisabled(),true);
 const privateError=await input(professor,'rms_recheck',{requestId:req.id,itemId:itemA.id,resultId:docs.A})
   .then(()=>null,error=>({code:error.code,message:error.message}));
 assert.equal(privateError?.code,'22023');
 assert.match(privateError.message,/연결할 기록을 찾을 수 없/);
 observed.push({role:'지정 교수·편집자 겸임',api:'rms_recheck',ok:false,via:'직접 격리 SQL',...privateError});
 assert.equal((await workspace(owner)).rounds.filter(r=>r.itemId===itemA.id).length,prev);
 await evidence(pPage,'professor-editor-private-block','겸임 교수 › 학생 전용 수정 결과에서는 재확인 단추가 비활성','PDF와 교수 응답은 열리지만 재확인 요청을 누를 수 없다. 별도의 격리 SQL에서도 연결할 기록을 찾을 수 없다는 응답과 차수 유지를 확인했다.',grant);
 const latest=(await workspace(owner)).results.find(r=>r.id===docs.A);
 assert.equal((await record('results',{...latest,visibility:'shared'})).visibility,'shared');
 assert.equal(await rpc(professor,'rms_can_read_record',{p_id:docs.A}),true);
 assert.equal((await workspace(professor)).results.find(r=>r.id===docs.A)?.visibility,'shared');
 await refresh(pPage);await select(pPage,A);
 await pPage.waitForURL(new RegExp('item='+itemA.id),{timeout:8500});
 await wait(pPage.getByRole('heading',{name:A,exact:true}));
 await click(recheckButton);
 const dlg=pPage.getByRole('dialog',{name:/이 항목만 다시 확인/});
 await wait(dlg);
 await evidence(pPage,'professor-editor-shared-confirm','겸임 교수 › 연구에 공유된 수정 결과는 재확인 창이 열림','같은 PDF·항목에서 학생이 수정 결과를 연구에 공유한 뒤 재확인 요청을 눌러 공개 범위와 3차 요청을 확인했다.',desc);
 await click(dlg.getByRole('checkbox',{name:/설명과 파일 전체/}));
 await click(button(dlg,new RegExp(`^${prev+1}차 검토 요청$`)));
 await dlg.waitFor({state:'hidden',timeout:9000});
 const now=await workspace(owner);
 const created=now.rounds.find(r=>r.itemId===itemA.id&&r.number===prev+1);
 assert.equal(created?.createdBy,professor.id);
 assert.equal(created.versionId,docs.file2);
 assert.equal(now.rounds.filter(r=>r.itemId===itemB.id).length,1);
 await pPage.waitForURL(new RegExp('round='+created.id),{timeout:8500});
 await evidence(pPage,'professor-editor-recheck','겸임 교수 › 연구에 공유된 수정 결과로 3차 재확인 생성','학생 작성자가 같은 결과를 연구에 공유한 뒤 버튼을 눌렀다. SQL에서 3차 생성자가 지정 교수를 겸한 편집자이고 다른 항목은 1차 그대로다.',grant);
});
} finally{
 await flush();
 await writeFile(join(dir,'checks.json'),JSON.stringify({checks,failures,rpcResults:observed,shots:marks.length},null,2)+'\n');
 await browser.close();
 await db.close();
 console.log(JSON.stringify({checks,failures,shots:marks.length},null,2));
}

if (failures.length) process.exitCode = 1;
