import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
const req=createRequire(pathToFileURL(join(process.cwd(),'package.json')));
const {chromium}=req('playwright');
const browser=await chromium.launch();
const base='http://127.0.0.1:5215';
const dir=process.argv[2];
assert.ok(dir, '캡처를 쓸 새 폴더를 지정해 주세요.');
await mkdir(dir,{recursive:true});
const names={first:'복원 기준 제목',current:'글 제목만 바뀐 가상 초안'};
const ids={diff:'a1000000-1000-4000-8000-100000000001',same:'a1000000-1000-4000-8000-100000000002'};
const snapshots={diff:'a1000000-1000-4000-8000-100000000003',same:'a1000000-1000-4000-8000-100000000004'};
const findings={}, errors={}, pictures=[];
const b=(p,name)=>p.getByRole('button',{name,exact:typeof name==='string'}).first();
const t=(p,name)=>p.getByText(name,{exact:typeof name==='string'}).first();
const visible=(locator)=>locator.waitFor({state:'visible',timeout:6900});
const navigate=(page,path)=>page.goto(base+path,{waitUntil:'domcontentloaded'});
async function snap(p,name,caption){
 const file=name+'.png';
 await p.screenshot({path:join(dir,file),animations:'disabled'});
 pictures.push({file,caption,viewport:p.viewportSize(),environment:'현재 마진 체험 모드 · 합성 자료'});
}
async function newPage(width=1440,height=900){
 const page=await browser.newPage({viewport:{width,height},locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
 await page.route(/^https?:\/\//, route =>
   new URL(route.request().url()).origin === base ? route.continue() : route.abort());
 page.setDefaultTimeout(6100);
 return page;
}
async function run(key,fn){
 try{findings[key]=await fn();console.log('PASS',key,JSON.stringify(findings[key]));}
 catch(e){errors[key]=e.message.split('\n').slice(0,5).join(' | ');console.log('UNRESOLVED',key,errors[key]);}
}
const page=await newPage();
await navigate(page,'/r');
const demoLink=page.getByRole('link',{name:/연구 도구 사용 경험/}).first();
await visible(demoLink);
const research=(await demoLink.getAttribute('href')).replace(/^\/r\//,'');
const root='/r/'+research;
const seed=await page.evaluate(async ({research,ids,snapshots,names})=>{
 const repo=await import('/src/lib/repository.ts');
 const current=await repo.loadPreview();
 const date='2026-11-26T01:00:00.000Z';
 const record=id=>({id,researchId:research,createdAt:date,updatedAt:date,visibility:'private'});
 const body=(rows,bold=false)=>({type:'doc',content:rows.map(text=>({type:'paragraph',content:[{type:'text',text,...(bold?{marks:[{type:'bold'}]}:{})}]}))});
 const textBase=['여러 연구의 사례를 비교합니다.','원문의 다음 문단입니다.'];
 const joined=textBase.join('\n\n');
 await repo.updatePreview(data=>{
   data.members.push({id:'a1000000-1000-4000-8000-100000000009',researchId:research,userId:'a1000000-1000-4000-8000-100000000010',role:'editor',status:'active',email:'fixture@example.test',createdAt:date,updatedAt:date});
   data.documents.push({...record(ids.diff),type:'manuscript',title:'복원 중복 점검',revision:1,content:body(['가상 변경 뒤 첫 문단입니다.','다음 줄도 바꿉니다.']),text:'가상 변경 뒤 첫 문단입니다.\n\n다음 줄도 바꿉니다.'});
   data.documents.push({...record(ids.same),type:'manuscript',title:names.current,revision:4,content:body(textBase,true),text:joined});
   for(const key of ['diff','same'])data.documentVersions.push({...record(snapshots[key]),documentId:ids[key],number:1,title:names.first,content:body(textBase),text:joined});
 });
 return {material:current.materials.find(x=>x.researchId===research&&current.versions.some(v=>v.materialId===x.id))?.id};
},{research,ids,snapshots,names});
const versions=p=>b(p,'버전');
const menuItems=p=>p.getByRole('menuitemradio').filter({hasText:/^v\d+\s*·/});
async function openComparison(p,id,number){
 await navigate(p,root+'/docs/w/'+id);
 await visible(p.locator('.tiptap').first());
 await versions(p).click();
 const item=p.getByRole('menuitemradio').filter({hasText:new RegExp('^v'+number+'\\s*·')}).first();
 await visible(item);
 await item.click();
 await visible(p.getByRole('region',{name:'버전 비교'}));
}
async function readVersions(p,id){
 return p.evaluate(async id=>{
   const {loadPreview}=await import('/src/lib/repository.ts');
   const data=await loadPreview();
   return data.documentVersions.filter(v=>v.documentId===id).map(v=>({number:v.number,title:v.title,hasBold:JSON.stringify(v.content).includes('"bold"')}));
 },id);
}
try{
await run('01-preview-duplicate',async()=>{
 await openComparison(page,ids.diff,1);
 await snap(page,'01-preview-diff-before','체험 모드에서 v1과 저장된 변경본을 비교');
 await b(page,'이 버전으로 되살리기').click();
 await page.getByRole('region',{name:'버전 비교'}).waitFor({state:'hidden'});
 await versions(page).click();
 await menuItems(page).first().waitFor({state:'visible'});
 const versionList=await readVersions(page,ids.diff);
 assert.deepEqual(versionList.map(v=>v.number),[1,2,2]);
 const labels=await menuItems(page).allTextContents();
 await snap(page,'02-preview-duplicate','실제 버튼 조작 후 v2 · v2 · v1과 로컬 데이터의 번호 중복 확인');
 return {numbers:versionList.map(v=>v.number),labels};
});
await run('18-compare-rendering',async()=>{
 await openComparison(page,ids.same,1);
 const section=page.getByRole('region',{name:'버전 비교'});
 const restore=b(section,'이 버전으로 되살리기');
 const noChange=await section.getByText(/달라진 내용이 없|변경된 부분이 없/).count();
 const whitespace=await section.locator('.diff-content').first().evaluate(e=>({css:getComputedStyle(e).whiteSpace,textHasLF:e.textContent.includes('\n'),height:Math.round(e.getBoundingClientRect().height)}));
 await snap(page,'03-compare-same-text','글자 내용이 같으나 제목과 굵기가 다르고, 비교 화면에서 차이를 알 수 없음');
 assert.equal(await restore.isEnabled(),true);
 return {noChange,whitespace,restoreEnabled:true};
});
await run('new-restore-title-format-loss',async()=>{
 const v=await readVersions(page,ids.same);
 assert.equal(v.length,1);
 if(!await page.getByRole('region',{name:'버전 비교'}).isVisible())await openComparison(page,ids.same,1);
 await b(page,'이 버전으로 되살리기').click();
 await page.getByRole('region',{name:'버전 비교'}).waitFor({state:'hidden'});
 const after=await readVersions(page,ids.same);
 assert.deepEqual(after.map(v=>v.number),[1,2]);
 assert.ok(!after.some(v=>v.hasBold||v.title===names.current));
 assert.equal(await page.getByRole('textbox',{name:'문서 제목'}).inputValue(),names.first);
 assert.equal(await page.locator('.tiptap strong').count(),0);
 await versions(page).click();
 await menuItems(page).first().waitFor({state:'visible'});
 await snap(page,'04-preview-no-title-format-backup','복원 직전 제목과 굵기를 가진 버전이 남지 않고 두 버전이 모두 원래 제목·형식');
 return {after,titleLost:names.current,marksLost:'bold'};
});
await run('02-feedback-row-resize',async()=>{
 await page.setViewportSize({width:1760,height:900});
 await navigate(page,root+'/tasks?view=feedback');
 const fold=b(page,'사이드 창 접기');
 if(await fold.count()&&await fold.isVisible())await fold.click();
 const row=page.locator('.tasks-home .task-line').first();
 const small=row.locator('.task-line-text small');
 await row.waitFor({state:'visible'});
 const getStats=()=>small.evaluate(e=>{
   let q=e.closest('.tasks-home');
   while(q&&!(getComputedStyle(q).containerName||'').split(' ').includes('tasks'))q=q.parentElement;
   return {caption:e.textContent,display:getComputedStyle(e).display,containerWidth:q?.clientWidth,alternative:e.closest('.task-line')?.querySelectorAll('.task-line-cols').length};
 });
 const wide=await getStats();
 await snap(page,'05-feedback-wide','넓은 화면에서 피드백 상태와 연결 할 일 수가 숨겨짐');
 await page.setViewportSize({width:820,height:900});
 await small.waitFor({state:'visible'});
 const narrow=await getStats();
 await snap(page,'06-feedback-narrow','같은 피드백 행에서 창을 좁히자 상태와 수가 다시 표시됨');
 assert.equal(wide.display,'none');assert.equal(wide.alternative,0);assert.notEqual(narrow.display,'none');
 return {wide,narrow};
});
await run('10-written-dialog',async()=>{
 await page.setViewportSize({width:1440,height:900});
 await navigate(page,root+'/meetings?new=written');
 const dialog=page.getByRole('dialog',{name:'서면 피드백 붙여넣기'});
 await visible(dialog);
 const name=dialog.locator('.visibility-field > span').first();
 const bounds=async()=>name.evaluate(e=>{
  const shell=e.closest('[role=dialog]');
  let scroll=e.parentElement;
  while(scroll&&getComputedStyle(scroll).overflowY!=='auto')scroll=scroll.parentElement;
  const r=e.getBoundingClientRect();
  const field=e.parentElement, full=field.getBoundingClientRect();
  return {fieldBottom:Math.round(full.bottom),y:Math.round(r.top),bottom:Math.round(r.bottom),clipBottom:Math.round(scroll.getBoundingClientRect().bottom),dialogBottom:Math.round(shell.getBoundingClientRect().bottom),scrollTop:scroll.scrollTop,scrollSpace:scroll.scrollHeight-scroll.clientHeight};
 });
 const before=await bounds();
 await snap(page,'07-written-open','1440×900 서면 피드백 입력 모달의 초기 화면');
 await page.setViewportSize({width:1440,height:768});
 const short=await bounds();
 await snap(page,'07b-written-short','1440×768에서 공개 범위가 첫 화면의 본문 아래로 밀림');
 await name.evaluate(e=>{let scroll=e.parentElement;while(scroll&&getComputedStyle(scroll).overflowY!=='auto')scroll=scroll.parentElement;scroll.scrollTop=scroll.scrollHeight;});
 const after=await bounds();
 await snap(page,'08-written-scroll','같은 창 안에서 공개 범위까지 스크롤 가능');
 assert.ok(after.fieldBottom<=after.clipBottom+1);
 return {before,short,after};
});
await run('11-mobile-tasks',async()=>{
 await page.setViewportSize({width:320,height:680});
 await navigate(page,root+'/tasks');
 const rows=page.locator('.tasks-home .task-line');
 await visible(rows.first());
 const stats=()=>rows.first().evaluate(e=>{
  const task=e.closest('.tasks-home');
  const choices=[...task.querySelectorAll('[role=radio]')].filter(x=>['내 할 일','모두'].includes(x.innerText.trim()));
  const rect=e.getBoundingClientRect();
  return {window:[innerWidth,innerHeight],firstRowY:Math.round(rect.top),insideFirstView:rect.top<innerHeight,choices:choices.map(label=>({text:label.innerText,right:Math.round(label.getBoundingClientRect().right)}))};
 });
 const small=await stats();
 await snap(page,'09-tasks-320','320×680 할 일 목록 첫 화면과 실제 할 일의 위치');
 await page.setViewportSize({width:390,height:844});
 const typical=await stats();
 await snap(page,'10-tasks-390','390×844에서 같은 목록의 첫 화면');
 return {small,typical};
});
await run('12-mobile-pressed',async()=>{
 await page.setViewportSize({width:390,height:844});
 await navigate(page,root);
 const nav=page.getByRole('navigation',{name:'주요 메뉴'});
 await visible(nav);
 await b(nav,/연구 도우미/).click();
 await nav.locator('[aria-pressed=true]').waitFor({state:'visible'});
 const stats=await nav.locator('.ia-tab.active').evaluateAll(links=>links.map(e=>({text:e.innerText.trim(),pressed:e.getAttribute('aria-pressed'),current:e.getAttribute('aria-current'),color:getComputedStyle(e).color})));
 assert.equal(stats.length,2);
 await snap(page,'11-mobile-assistant','홈을 바탕으로 연구 도우미 보조 창을 띄웠을 때 하단 선택 표시');
 return {bottomStates:stats,barFound:await nav.count()};
});
await run('15-missing-pdf',async()=>{
 if(!seed.material)throw Error('가상 기본 자료에서 보존 버전 없음');
 await page.setViewportSize({width:1440,height:900});
 await navigate(page,root+'/docs/m/'+seed.material);
 const opener=b(page,'새 버전 올리기');
 await visible(opener);
 await opener.click();
 const dialog=page.getByRole('dialog',{name:'새 버전 추가'});
 await visible(dialog);
 const primary=b(dialog,'새 버전 추가');
 const enabled=await primary.isEnabled();
 await snap(page,'12-version-without-file','파일을 고르기 전의 활성 제출 버튼');
 await primary.click();
 const error=dialog.getByText('등록할 PDF를 선택해 주세요.',{exact:true}).first();
 await visible(error);
 assert.ok(await dialog.isVisible());
 await snap(page,'13-version-missing-error','미선택이라는 입력 오류가 뜨고 자료에는 버전 추가 안 됨');
 return {enabled,error:(await error.innerText()).trim()};
});
}finally{
 await writeFile(join(dir,'preview.json'),JSON.stringify({findings,errors,pictures},null,2)+'\n');
 await browser.close();
}

if (Object.keys(errors).length) process.exitCode = 1;
