import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const db=new PGlite()
const ids={student:'11111111-1111-4111-8111-111111111111',professor:'22222222-2222-4222-8222-222222222222',stranger:'33333333-3333-4333-8333-333333333333',newProfessor:'44444444-4444-4444-8444-444444444444',research:'55555555-5555-4555-8555-555555555555',otherResearch:'66666666-6666-4666-8666-666666666666',meeting:'77777777-7777-4777-8777-777777777777',feedback:'88888888-8888-4888-8888-888888888888',material:'99999999-9999-4999-8999-999999999999',v2:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v3:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',resultA:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',resultB:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}
const base=(id,researchId=ids.research)=>({id,researchId,createdAt:'2026-11-03T00:00:00Z',updatedAt:'2026-11-03T00:00:00Z'})
const call=async(name,params=[])=>{const fields=params.map((_,i)=>`$${i+1}`).join(',');return(await db.query(`select public.${name}(${fields}) as value`,params)).rows[0]?.value}
const as=async user=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);await db.exec('set role authenticated')}
const save=(kind,value)=>call('rms_save_record',[kind,JSON.stringify(value)])
const inputCall=(name,value)=>call(name,[JSON.stringify(value)])
const failure=async(fn,code)=>{await assert.rejects(fn,error=>{assert.equal(error.code,code);return true})}
let meeting,material,v2,v3,feedback,resultA,resultB,request,itemA,itemB,roundA,roundB,newRound
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;`)
 for (const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8'))
 for(const [key,email] of [['student','student@example.test'],['professor','professor@example.test'],['stranger','other@example.test'],['newProfessor','next@example.test']]){await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[ids[key],email,JSON.stringify({name:key})]);await db.query('insert into public.rms_demo_accounts(user_id) values($1)',[ids[key]])}
 await as(ids.student)
 await call('rms_save_research',[JSON.stringify({...base(ids.research),ownerId:ids.student,name:'가상 연구',description:''})])
 meeting=await save('meetings',{...base(ids.meeting),title:'지도 미팅',date:null,time:null,status:'preparing',goal:'비교표 보완',memo:'📌 비교 기준을 보완해 주세요. 연구 질문은 구체적으로 정리했습니다.',memoRevision:1,taskIds:[],versionIds:[],questionIds:[]})
 feedback=await save('feedback',{...base(ids.feedback),title:'비교표 보완',body:'비교 기준을 보완해 주세요.',meetingId:meeting.id,sourceQuote:'비교 기준을 보완',sourceMemoRevision:meeting.memoRevision,status:'unprocessed',notes:'이 개인 메모는 공유되면 안 된다.'})
 material=await save('materials',{...base(ids.material),title:'가상 비교표',type:'draft'})
 for(const [id,number] of [['afafafaf-afaf-4faf-8faf-afafafafafaf',1],[ids.v2,2],[ids.v3,3]]){const path=`${ids.student}/${ids.research}/${id}.pdf`;await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['research-files',path,JSON.stringify({size:1024,mimetype:'application/pdf'})]);const version=await save('versions',{...base(id),materialId:material.id,number,fileName:`비교표_v${number}.pdf`,storagePath:path,size:1024,mimeType:'application/pdf'});if(number===2)v2=version;else v3=version}
 resultA=await save('results',{...base(ids.resultA),title:'비교표 수정',description:'비교 기준 열을 추가했다.',feedbackIds:[feedback.id],taskIds:[],kind:'document',versionId:v2.id,location:'1쪽 표1'})
 resultB=await save('results',{...base(ids.resultB),title:'연구 질문 수정',description:'연구 대상과 상황을 구체화했다.',feedbackIds:[],taskIds:[],kind:'document',versionId:v2.id,location:'2쪽 연구 질문'})
})
after(async()=>{await db.close()})
test('migration enables RLS and denies browser direct mutation / helper execution',async()=>{
 await as(ids.student)
 await failure(()=>db.query("update public.rms_records set data='{}' where id=$1",[ids.meeting]),'42501')
 await failure(()=>call('rms_require_record',[ids.meeting,ids.research,'meetings']),'42501')
 const data=await call('rms_bootstrap');assert.equal(data.feedback[0].sourceStart,3);assert.equal(data.feedback[0].notes,'이 개인 메모는 공유되면 안 된다.')
})
test('optimistic locking rejects stale writes and retains captured source',async()=>{
 await as(ids.student);const old=meeting
 meeting=await save('meetings',{...meeting,memo:'이후 메모를 바꿨다.'})
 assert.equal(meeting.memoRevision,old.memoRevision+1)
 await failure(()=>save('meetings',{...old,title:'오래된 창의 덮어쓰기'}),'40001')
 feedback=await save('feedback',{...feedback,status:'in_progress',sourceQuote:'바꿔치기'})
 assert.equal(feedback.sourceQuote,'비교 기준을 보완')
})
test('preparation saves atomically; invalid link rolls back new question',async()=>{
 await as(ids.student);const question={...base('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),meetingId:meeting.id,text:'다음 질문',status:'open'}
 await failure(()=>call('rms_save_preparation',[JSON.stringify({...meeting,questionIds:[question.id],taskIds:[ids.stranger]}),JSON.stringify([question])]),'22023')
 const data=await call('rms_bootstrap');assert.equal(data.questions.length,0)
 meeting=await call('rms_save_preparation',[JSON.stringify({...meeting,questionIds:[question.id]}),JSON.stringify([question])]);assert.deepEqual(meeting.questionIds,[question.id])
})
test('creates two immutable item snapshots without private notes',async()=>{
 await as(ids.student)
 request=await inputCall('rms_create_review',{researchId:ids.research,title:'가상 수정 결과 검토',professorEmail:'professor@example.test',resultIds:[resultA.id,resultB.id]})
 let data=await call('rms_bootstrap');[itemA,itemB]=[data.reviewItems.find(x=>x.resultId===resultA.id),data.reviewItems.find(x=>x.resultId===resultB.id)];roundA=data.rounds.find(x=>x.itemId===itemA.id);roundB=data.rounds.find(x=>x.itemId===itemB.id)
 assert.equal(roundA.number,1);assert.equal(roundA.versionId,v2.id);assert.equal(roundA.createdBy,ids.student);assert.ok(!JSON.stringify(roundA).includes('개인 메모'))
 resultA=await save('results',{...resultA,description:'이후 개인 설명을 고쳤다.',versionId:v3.id})
 data=await call('rms_bootstrap');assert.equal(data.rounds.find(x=>x.id===roundA.id).description,'비교 기준 열을 추가했다.')
 await failure(()=>save('versions',{...v2,fileName:'바꾼파일.pdf'}),'22023')
 await failure(()=>call('rms_delete_record',['versions',v2.id]),'22023')
})
test('only designated professor can respond and read shared file, not private records',async()=>{
 await as(ids.student);await failure(()=>inputCall('rms_respond',{roundId:roundA.id,result:'confirmed',comment:''}),'42501')
 await as(ids.stranger);const none=await call('rms_bootstrap');assert.equal(none.reviews.length,0);assert.equal((await db.query('select * from public.rms_review_requests')).rows.length,0);assert.equal(await call('rms_can_read_file',[v2.storagePath]),false)
 await as(ids.professor);const data=await call('rms_bootstrap');assert.equal(data.researches.length,0);assert.equal(data.feedback.length,0);assert.equal(data.meetings.length,0);assert.equal(data.reviews.length,1);assert.equal(data.versions.length,1);assert.equal(await call('rms_can_read_file',[v2.storagePath]),true);assert.equal(await call('rms_can_read_file',[v3.storagePath]),false)
 await failure(()=>inputCall('rms_respond',{roundId:roundA.id,result:'changes_requested',comment:'  '}),'22023')
 await inputCall('rms_respond',{roundId:roundA.id,result:'changes_requested',comment:'비교 기준을 하나 더 보완해 주세요.'});await inputCall('rms_respond',{roundId:roundB.id,result:'confirmed',comment:''})
})
test('professor sees research name and direction on the request, but not the research or its records',async()=>{
 await as(ids.student)
 const own=(await call('rms_bootstrap')).researches.find(x=>x.id===ids.research)
 await call('rms_save_research',[JSON.stringify({...own,purpose:'가상 연구 목적',questions:['가상 질문 하나','가상 질문 둘']})])
 await as(ids.professor);const data=await call('rms_bootstrap');const shared=data.reviews.find(x=>x.id===request.id)
 assert.equal(shared.researchName,'가상 연구');assert.equal(shared.researchPurpose,'가상 연구 목적');assert.deepEqual(shared.researchQuestions,['가상 질문 하나','가상 질문 둘'])
 assert.equal(data.researches.length,0);assert.equal(data.feedback.length,0)
 await as(ids.stranger);assert.equal((await call('rms_bootstrap')).reviews.length,0)
 await failure(()=>db.query('select public.rms_request_json(q) from public.rms_review_requests q'),'42501')
 // 형식이 어긋난 목적·질문은 걸러서 문자열만, 질문은 앞에서 5개까지 보냅니다.
 await as(ids.student)
 const now=(await call('rms_bootstrap')).researches.find(x=>x.id===ids.research)
 await call('rms_save_research',[JSON.stringify({...now,purpose:{secret:'x'},questions:[{secret:'x'},123,'  ','하나','둘','셋','넷','다섯','여섯']})])
 await as(ids.professor);const odd=(await call('rms_bootstrap')).reviews.find(x=>x.id===request.id)
 assert.equal(odd.researchPurpose,undefined);assert.deepEqual(odd.researchQuestions,['하나','둘','셋','넷','다섯']);assert.ok(!JSON.stringify(odd).includes('secret'))
 await as(ids.student)
 const restore=(await call('rms_bootstrap')).researches.find(x=>x.id===ids.research)
 await call('rms_save_research',[JSON.stringify({...restore,purpose:'가상 연구 목적',questions:['가상 질문 하나']})])
})
test('recheck creates a new round for one item and preserves the other result',async()=>{
 await as(ids.student);await inputCall('rms_recheck',{requestId:request.id,itemId:itemA.id,resultId:resultA.id});const data=await call('rms_bootstrap');newRound=data.rounds.find(x=>x.itemId===itemA.id&&x.number===2);assert.equal(newRound.versionId,v3.id);assert.equal(data.rounds.find(x=>x.id===roundA.id).versionId,v2.id);assert.equal(data.responses.find(x=>x.roundId===roundB.id).result,'confirmed');assert.ok(!data.responses.some(x=>x.roundId===newRound.id))
 await as(ids.professor);await failure(()=>inputCall('rms_respond',{roundId:roundA.id,result:'confirmed',comment:''}),'40001')
})
test('response changes preserve author and history; new professor writes their own response',async()=>{
 await as(ids.professor);await inputCall('rms_respond',{roundId:newRound.id,result:'changes_requested',comment:'기준을 명확히 적어 주세요.'});await inputCall('rms_respond',{roundId:newRound.id,result:'confirmed',comment:'확인했습니다.'});let history=await call('rms_response_history',[newRound.id]);assert.equal(history.length,1);assert.equal(history[0].userId,ids.professor)
 await as(ids.student);await inputCall('rms_set_sharing',{requestId:request.id,status:'shared',professorEmail:'next@example.test'})
 await as(ids.newProfessor);await inputCall('rms_respond',{roundId:newRound.id,result:'changes_requested',comment:'새 검토 의견입니다.'});const data=await call('rms_bootstrap');assert.equal(data.responses.find(x=>x.roundId===newRound.id).userId,ids.newProfessor);history=await call('rms_response_history',[newRound.id]);assert.equal(history.length,2);assert.equal(history[1].userId,ids.professor)
})
test('comments are scoped to one round and sharing stop revokes future reads',async()=>{
 await as(ids.student);const comment=await inputCall('rms_comment',{roundId:newRound.id,body:'수정하겠습니다.'});await failure(()=>inputCall('rms_comment',{roundId:roundB.id,parentId:comment.id,body:'다른 항목의 답글'}),'22023');await call('rms_resolve_comment',[comment.id,true]);let data=await call('rms_bootstrap');assert.equal(data.comments[0].resolved,true);assert.equal(data.responses.find(x=>x.roundId===newRound.id).result,'changes_requested')
 await inputCall('rms_set_sharing',{requestId:request.id,status:'stopped'});await as(ids.newProfessor);data=await call('rms_bootstrap');assert.equal(data.reviews.length,0);assert.equal(data.versions.length,0);assert.equal(await call('rms_can_read_file',[v3.storagePath]),false);await failure(()=>inputCall('rms_comment',{roundId:newRound.id,body:'접근 중지 후 댓글'}),'42501')
})
test('allowlist and service-only AI admission cannot be bypassed by browser',async()=>{
 await as(ids.student);await failure(()=>call('rms_ai_begin',[ids.student,ids.research,'hash']),'42501')
 await db.exec('reset role');await db.query('update public.rms_demo_accounts set active=false where user_id=$1',[ids.stranger]);await as(ids.stranger);await failure(()=>call('rms_bootstrap'),'42501')
})
test('review create and recheck retries with the same request key do not duplicate records',async()=>{
 await as(ids.student)
 const input={researchId:ids.research,title:'중복 방지 검토',professorEmail:'professor@example.test',resultIds:[resultB.id],requestKey:'ffffffff-ffff-4fff-8fff-ffffffffffff'}
 const first=await inputCall('rms_create_review',input),second=await inputCall('rms_create_review',input);assert.equal(first.id,second.id)
 await failure(()=>inputCall('rms_create_review',{...input,title:'다른 요청'}),'22023')
 const data=await call('rms_bootstrap'),item=data.reviewItems.find(x=>x.requestId===first.id)
 const recheck={requestId:first.id,itemId:item.id,resultId:resultB.id,requestKey:'abababab-abab-4bab-8bab-abababababab'}
 const round1=await inputCall('rms_recheck',recheck),round2=await inputCall('rms_recheck',recheck);assert.equal(round1.id,round2.id)
 const result=await call('rms_bootstrap');assert.equal(result.rounds.filter(x=>x.itemId===item.id).length,2)
})
test('cross-research references and forged storage metadata are rejected',async()=>{
 await as(ids.stranger);await failure(()=>call('rms_bootstrap'),'42501')
 await as(ids.student)
 await call('rms_save_research',[JSON.stringify({...base(ids.otherResearch),ownerId:ids.student,name:'다른 가상 연구',description:''})])
 await failure(()=>save('results',{...base('acacacac-acac-4cac-8cac-acacacacacac',ids.otherResearch),title:'잘못된 연결',description:'다른 연구의 파일을 연결한다.',feedbackIds:[],taskIds:[],kind:'document',versionId:v2.id,location:'1쪽'}),'22023')
 await failure(()=>save('versions',{...base('adadadad-adad-4dad-8dad-adadadadadad'),materialId:material.id,number:99,fileName:'없는파일.pdf',storagePath:`${ids.student}/${ids.research}/adadadad-adad-4dad-8dad-adadadadadad.pdf`,size:1024,mimeType:'application/pdf'}),'22023')
})
test('lost version metadata response can be retried without overwriting a file',async()=>{
 await as(ids.student);const retry=await save('versions',{...v2,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'});assert.equal(retry.id,v2.id);assert.equal(retry.updatedAt,v2.updatedAt);await failure(()=>save('versions',{...v2,size:999}),'22023')
})
test('AI admission serializes duplicate inputs and enforces per-account limits',async()=>{
 await db.exec('reset role');await db.exec('set role service_role')
 const first=await call('rms_ai_begin',[ids.student,ids.research,'same-hash']);assert.ok(first)
 await failure(()=>call('rms_ai_begin',[ids.student,ids.research,'same-hash']),'55000')
 for(let i=0;i<5;i++)await call('rms_ai_begin',[ids.student,ids.research,`other-${i}`])
 await failure(()=>call('rms_ai_begin',[ids.student,ids.research,'seventh']),'P0001')
})
test('storage rejects other-account uploads and has no overwrite policy',async()=>{
 await as(ids.professor)
 await failure(()=>db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['research-files',`${ids.student}/${ids.research}/aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae.pdf`,JSON.stringify({size:1024,mimetype:'application/pdf'})]),'42501')
 await as(ids.student)
 const changed=await db.query("update storage.objects set metadata='{}'::jsonb where bucket_id='research-files' and name=$1 returning id",[v2.storagePath]);assert.equal(changed.rows.length,0)
})
test('identical saved payload retries return canonical values despite old timestamps',async()=>{
 await as(ids.student)
 const stale={...meeting,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',memoRevision:1}
 const retry=await save('meetings',stale);assert.equal(retry.id,meeting.id);assert.equal(retry.updatedAt,meeting.updatedAt);assert.equal(retry.memoRevision,meeting.memoRevision)
 const different={...stale,title:'다른 내용'};await failure(()=>save('meetings',different),'40001')
})
test('preparation retry after lost response keeps one set of questions and links',async()=>{
 await as(ids.student);const data=await call('rms_bootstrap'),questions=data.questions.filter(x=>meeting.questionIds.includes(x.id));const result=await call('rms_save_preparation',[JSON.stringify({...meeting,updatedAt:'2026-01-01T00:00:00Z'}),JSON.stringify(questions.map(q=>({...q,updatedAt:'2026-01-01T00:00:00Z'})))]);assert.deepEqual(result.questionIds,meeting.questionIds);assert.equal((await call('rms_bootstrap')).questions.length,questions.length)
})

test('stale upload numbers are allocated on the server and lost replies remain retryable',async()=>{
 await as(ids.student)
 const uploads=[]
 for(const id of ['bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc','bdbdbdbd-bdbd-4dbd-8dbd-bdbdbdbdbdbd']){
  const path=`${ids.student}/${ids.research}/${id}.pdf`
  await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['research-files',path,JSON.stringify({size:1024,mimetype:'application/pdf'})])
  const input={...base(id),materialId:material.id,number:3,fileName:'new.pdf',storagePath:path,size:1024,mimeType:'application/pdf'}
  const saved=await save('versions',input)
  uploads.push(saved)
  const retried=await save('versions',input)
  assert.equal(retried.number,saved.number)
  assert.equal(retried.updatedAt,saved.updatedAt)
 }
 assert.equal(uploads[0].number,4)
 assert.equal(uploads[1].number,5)
})

test('AI usage reports only the caller and denies anonymous access',async()=>{
 await as(ids.professor);const own=await call('rms_ai_usage');assert.equal(own.total,0);assert.equal(own.limit,100)
 await as(ids.student);const used=await call('rms_ai_usage');assert.ok(used.total>0);assert.equal(used.total,used.complete+used.failed+used.running);assert.equal(used.windowHours,24)
 await db.exec('reset role; set role anon');await failure(()=>call('rms_ai_usage'),'42501')
})

test('research archive and restore retain records and existing shared reviews',async()=>{
 await as(ids.student);const before=await call('rms_bootstrap');const original=before.researches.find(r=>r.id===ids.research)
 const archived=await call('rms_save_research',[JSON.stringify({...original,archivedAt:new Date().toISOString()})]);assert.ok(archived.archivedAt)
 let after=await call('rms_bootstrap');assert.equal(after.meetings.length,before.meetings.length);assert.equal(after.reviews.length,before.reviews.length)
 const restored={...archived};delete restored.archivedAt;await call('rms_save_research',[JSON.stringify(restored)]);after=await call('rms_bootstrap');assert.equal(after.researches.find(r=>r.id===ids.research).archivedAt,undefined)
})

let sharedDoc,docVersion,collabPoll
const docId='abababab-abab-4bab-8bab-abababababab'
test('coauthor invitation does not expose personal notes, private records, or direct rows',async()=>{
 await db.exec('reset role');await db.query('update public.rms_demo_accounts set active=true where user_id=$1',[ids.stranger]);await as(ids.student)
 await inputCall('rms_member_action',{action:'invite',researchId:ids.research,email:'other@example.test'})
 await as(ids.stranger);assert.equal((await call('rms_bootstrap')).researches.length,0)
 await inputCall('rms_member_action',{action:'accept',researchId:ids.research})
 const data=await call('rms_bootstrap');assert.equal(data.researches.length,1);assert.equal(data.meetings.length,0);assert.equal(data.feedback[0].notes,'')
 const rows=(await db.query('select data from public.rms_records')).rows;assert.ok(!JSON.stringify(rows).includes('개인 메모'));assert.ok(!rows.some(x=>x.data.id===meeting.id))
 await failure(()=>save('meetings',{...meeting,memo:'비공개 기록 변경'}),'42501')
 sharedDoc=await save('documents',{...base(docId),title:'공동 연구 계획서',type:'plan',content:{type:'doc',content:[]},text:'초안',revision:0,visibility:'shared'})
 await as(ids.student);assert.ok((await call('rms_bootstrap')).documents.some(x=>x.id===docId))
})
test('document conflict rejects lost updates and immutable versions survive restore',async()=>{
 await as(ids.student);const original=sharedDoc
 sharedDoc=await save('documents',{...sharedDoc,text:'소유자의 변경',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'소유자의 변경'}]}]}})
 await as(ids.stranger);await failure(()=>save('documents',{...original,text:'편집자의 오래된 변경'}),'40001')
 docVersion=await save('documentVersions',{...base('acacacac-acac-4cac-8cac-acacacacacac'),documentId:sharedDoc.id,title:'1차 정리',number:0,content:sharedDoc.content,text:sharedDoc.text})
 await failure(()=>save('documentVersions',{...docVersion,text:'덮어쓰기'}),'22023')
 sharedDoc=await save('documents',{...sharedDoc,text:'편집자의 변경'});assert.equal(sharedDoc.updatedBy,ids.stranger)
 await as(ids.student);assert.equal((await call('rms_bootstrap')).documentVersions[0].text,'소유자의 변경')
})
test('schedule participants respond without research access; confirmation creates only one meeting',async()=>{
 await as(ids.student)
 collabPoll=await inputCall('rms_poll_action',{action:'create',researchId:ids.research,title:'시간 조율',emails:['professor@example.test'],options:[{id:'adadadad-adad-4dad-8dad-adadadadadad',start:'2026-12-10T05:00:00Z',end:'2026-12-10T05:30:00Z'}]})
 await as(ids.professor);await inputCall('rms_poll_action',{action:'respond',pollId:collabPoll.id,available:[collabPoll.options[0].id]});assert.equal((await call('rms_bootstrap')).documents.length,0)
 await failure(()=>inputCall('rms_poll_action',{action:'confirm',pollId:collabPoll.id,optionId:collabPoll.options[0].id}),'42501')
 await as(ids.student);const a=await inputCall('rms_poll_action',{action:'confirm',pollId:collabPoll.id,optionId:collabPoll.options[0].id});const b=await inputCall('rms_poll_action',{action:'confirm',pollId:collabPoll.id,optionId:collabPoll.options[0].id});assert.equal(a.meetingId,b.meetingId)
})
test('trash blocks collaborator and professor; restore keeps sharing stopped; owner can revoke editor',async()=>{
 await as(ids.student);let r=(await call('rms_bootstrap')).researches.find(r=>r.id===ids.research)
 await call('rms_set_sharing',[JSON.stringify({requestId:request.id,status:'shared',professorEmail:'professor@example.test'})])
 r=await call('rms_save_research',[JSON.stringify({...r,nextMeetingId:meeting.id,deletedAt:new Date().toISOString()})])
 await as(ids.stranger);assert.equal((await call('rms_bootstrap')).documents.length,0)
 await as(ids.professor);assert.equal((await call('rms_bootstrap')).reviews.length,0);assert.equal(await call('rms_can_read_file',[v2.storagePath]),false)
 await as(ids.student);r=await call('rms_save_research',[JSON.stringify({...r,deletedAt:undefined})]);assert.equal((await call('rms_bootstrap')).reviews.find(x=>x.id===request.id).status,'stopped')
 await inputCall('rms_member_action',{action:'remove',researchId:ids.research,userId:ids.stranger})
 await as(ids.stranger);assert.equal((await call('rms_bootstrap')).documents.length,0)
})

test('AI cancellation wins before admission and ignores a late completion',async()=>{
 await db.exec('reset role');await db.query("update public.rms_ai_runs set created_at=now()-interval '2 days' where user_id=$1",[ids.student]);
 const cancelled='a1111111-1111-4111-8111-111111111111',late='a2222222-2222-4222-8222-222222222222';
 await as(ids.student);await call('rms_cancel_ai',[cancelled]);
 await db.exec('reset role;set role service_role');await failure(()=>call('rms_ai_begin_v2',[ids.student,ids.research,'cancelled-input',cancelled,'organize_meeting','test-model','minimal']),'57014');
 await call('rms_ai_begin_v2',[ids.student,ids.research,'late-input',late,'organize_meeting','test-model','minimal']);
 await as(ids.student);await call('rms_cancel_ai',[late]);
 await db.exec('reset role;set role service_role');assert.equal(await call('rms_ai_finish_v2',[late,'complete',JSON.stringify({candidates:[{title:'늦은 결과',body:'적용하면 안 된다.'}]}),'[]',null]),false);
 await as(ids.student);const data=await call('rms_bootstrap');assert.ok(!data.aiCandidates.some(c=>c.runId===late));assert.equal(data.aiRuns.find(r=>r.id===late).status,'cancelled');
})
test('AI adoption is atomic, private, caller-owned and idempotent after a lost response',async()=>{
 const run='a3333333-3333-4333-8333-333333333333';await db.exec('reset role;set role service_role');await call('rms_ai_begin_v2',[ids.student,ids.research,'adoption-input',run,'plan_research','test-model','minimal']);
 await call('rms_ai_finish_v2',[run,'complete',JSON.stringify({candidates:[{title:'비교 기준 정리',method:'기준표를 보완한다.'}]}),'[]',null]);
 await as(ids.student);const data=await call('rms_bootstrap'),c=data.aiCandidates.find(c=>c.runId===run);
 const input={candidateId:c.id,kind:'tasks',value:{...base('a4444444-4444-4444-8444-444444444444'),title:c.title,description:'기준표를 보완한다.',status:'todo',priority:'normal',dueDate:null,feedbackIds:[]}};
 const first=await inputCall('rms_adopt_candidate',input),retry=await inputCall('rms_adopt_candidate',{...input,value:{...input.value,id:'a5555555-5555-4555-8555-555555555555'}});assert.equal(first.id,retry.id);assert.equal(first.visibility,'private');assert.equal(first.createdBy,ids.student);
 await as(ids.professor);await failure(()=>inputCall('rms_adopt_candidate',input),'42501');
})
test('private attachment record rejects mismatched stored MIME metadata',async()=>{
 await as(ids.student);const id='a6666666-6666-4666-8666-666666666666',path=`${ids.student}/${ids.research}/${id}.pdf`;
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['research-private',path,JSON.stringify({size:1024,mimetype:'text/plain'})]);
 await failure(()=>save('attachments',{...base(id),title:'잘못된 파일',fileName:'sample.pdf',storagePath:path,size:1024,mimeType:'application/pdf',text:''}),'22023');
})
test('another account cannot cancel a private AI execution',async()=>{
 await as(ids.professor);await failure(()=>call('rms_cancel_ai',['a3333333-3333-4333-8333-333333333333']),'42501');
 await as(ids.student);assert.equal((await call('rms_bootstrap')).aiRuns.find(r=>r.id==='a3333333-3333-4333-8333-333333333333').status,'complete');
})

let liveRecording,liveTranscript
const transcriptArgs=(text,revision=liveTranscript?.revision??0,segments=liveTranscript?.raw_segments??[{text:'연구 계획을 보완해 주세요.',final:true},{text:'분석 기준',final:false}])=>[liveRecording.id,JSON.stringify(segments),text,liveTranscript?.consent_at??'2026-11-05T00:00:00Z',JSON.stringify(liveTranscript?.warnings??[]),revision]
test('live transcript stores Korean text and uncertain source segments independently of audio sharing',async()=>{
 await as(ids.student)
 const id='e1111111-1111-4111-8111-111111111111',path=`${ids.student}/${ids.research}/${id}.webm`
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['research-private',path,JSON.stringify({size:1024,mimetype:'audio/webm'})])
 liveRecording=await save('recordings',{...base(id),meetingId:meeting.id,title:'한국어 음성 기록',fileName:'recording.webm',storagePath:path,size:1024,mimeType:'audio/webm',duration:20,consentAt:'2026-11-05T00:00:00Z',visibility:'shared'})
 liveTranscript=await call('rms_save_live_transcript',transcriptArgs('연구 계획을 보완해 주세요.\n분석 기준'))
 assert.equal(liveTranscript.language,'ko-KR');assert.equal(liveTranscript.engine,'browser-speech-recognition');assert.equal(liveTranscript.revision,1);assert.equal(liveTranscript.raw_segments[1].final,false)
 assert.equal((await db.query('select * from public.rms_live_transcripts')).rows.length,1)
 await failure(()=>db.query("update public.rms_live_transcripts set edited_text='임의 변경'"),'42501')
})
test('live transcript edit uses optimistic locking, preserves source, and survives a lost response retry',async()=>{
 await as(ids.student);const original=liveTranscript
 liveTranscript=await call('rms_save_live_transcript',transcriptArgs('연구 계획의 분석 기준을 보완해 주세요.'))
 assert.equal(liveTranscript.revision,2);assert.deepEqual(liveTranscript.raw_segments,original.raw_segments)
 const retry=await call('rms_save_live_transcript',transcriptArgs(liveTranscript.edited_text,1));assert.equal(retry.revision,2)
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('다른 창의 오래된 초안',1)),'PT409')
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('원문 바꾸기',2,[{text:'교수가 승인했다고 위조',final:true}])),'22023')
 const rows=(await db.query('select * from public.rms_live_transcripts')).rows;assert.equal(rows[0].edited_text,liveTranscript.edited_text)
})
test('shared audio never grants transcript access to a coauthor or professor',async()=>{
 await as(ids.student);await inputCall('rms_member_action',{action:'invite',researchId:ids.research,email:'other@example.test'})
 await as(ids.stranger);await inputCall('rms_member_action',{action:'accept',researchId:ids.research})
 assert.equal(await call('rms_can_read_record',[liveRecording.id]),true)
 assert.equal((await db.query('select * from public.rms_live_transcripts')).rows.length,0)
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('다른 사람의 전사문')),'42501')
 await as(ids.professor);assert.equal((await db.query('select * from public.rms_live_transcripts')).rows.length,0)
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('교수 계정의 변경')),'42501')
 await db.exec('reset role;set role anon');await failure(()=>db.query('select * from public.rms_live_transcripts'),'42501')
})
test('transcript validates field types and length without truncating user text',async()=>{
 await as(ids.student)
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('가'.repeat(100001))),'22023')
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('입력',2,[{text:'문장',final:'false'}])),'22023')
 const args=transcriptArgs('입력');args[4]='[123]';await failure(()=>call('rms_save_live_transcript',args),'22023')
})
test('trash revokes even direct transcript reads and restore preserves the saved text',async()=>{
 await as(ids.student);let research=(await call('rms_bootstrap')).researches.find(r=>r.id===ids.research)
 research=await call('rms_save_research',[JSON.stringify({...research,deletedAt:new Date().toISOString()})])
 assert.equal((await db.query('select * from public.rms_live_transcripts')).rows.length,0)
 await failure(()=>call('rms_save_live_transcript',transcriptArgs('휴지통 이후 변경')),'42501')
 await call('rms_save_research',[JSON.stringify({...research,deletedAt:undefined})])
 const rows=(await db.query('select * from public.rms_live_transcripts')).rows;assert.equal(rows[0].edited_text,liveTranscript.edited_text)
})

const purgeResearch='f1000000-0000-4000-8000-000000000001'
let purgeValue,purgePath,purgeOtherPath
const purgeInput=(name='삭제 검증 연구')=>({researchId:purgeResearch,confirmationName:name})
test('permanent deletion requires owner, trash state, and exact name',async()=>{
 await as(ids.student)
 purgeValue=await call('rms_save_research',[JSON.stringify({...base(purgeResearch),name:'삭제 검증 연구',description:''})])
 await failure(()=>inputCall('rms_purge_research',purgeInput()),'22023')
 await as(ids.professor);await failure(()=>inputCall('rms_purge_research',purgeInput()),'42501')
 await as(ids.student)
 purgeValue=await call('rms_save_research',[JSON.stringify({...purgeValue,deletedAt:new Date().toISOString()})])
 await failure(()=>inputCall('rms_purge_research',purgeInput('다른 이름')),'22023')
 assert.ok((await call('rms_bootstrap')).researches.some(r=>r.id===purgeResearch))
 // Restore only this isolated test research to populate records and reviews.
 purgeValue=await call('rms_save_research',[JSON.stringify({...purgeValue,deletedAt:undefined})])
})
test('permanent deletion removes related reviews and nested comments atomically, retains cleanup manifest',async()=>{
 await as(ids.student)
 const mat='f1000000-0000-4000-8000-000000000002',ver='f1000000-0000-4000-8000-000000000003',res='f1000000-0000-4000-8000-000000000004'
 await save('materials',{...base(mat,purgeResearch),title:'검증 자료',type:'draft'})
 purgePath=`${ids.student}/${purgeResearch}/${ver}.pdf`
 purgeOtherPath=`${ids.student}/${ids.research}/f1000000-0000-4000-8000-000000000099.pdf`
 await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3),($1,$4,$3)',['research-files',purgePath,JSON.stringify({size:1024,mimetype:'application/pdf'}),purgeOtherPath])
 await save('versions',{...base(ver,purgeResearch),materialId:mat,number:1,fileName:'검증.pdf',storagePath:purgePath,size:1024,mimeType:'application/pdf'})
 await save('results',{...base(res,purgeResearch),title:'수정 결과',description:'비교 기준 보완',kind:'document',versionId:ver,location:'1쪽',feedbackIds:[],taskIds:[]})
 const req=await inputCall('rms_create_review',{researchId:purgeResearch,title:'삭제 검증',professorEmail:'professor@example.test',resultIds:[res]})
 const data=await call('rms_bootstrap'),round=data.rounds.find(r=>r.requestId===req.id)
 const comment=await inputCall('rms_comment',{roundId:round.id,body:'검증 댓글'})
 await inputCall('rms_comment',{roundId:round.id,parentId:comment.id,body:'검증 답글'})
 await as(ids.professor);await inputCall('rms_respond',{roundId:round.id,result:'confirmed',comment:''})
 await as(ids.student);await call('rms_save_research',[JSON.stringify({...purgeValue,deletedAt:new Date().toISOString()})])
 const job=await inputCall('rms_purge_research',purgeInput())
 assert.deepEqual(job.files,[{bucket:'research-files',path:purgePath}])
 const remaining=await call('rms_bootstrap');assert.ok(!remaining.researches.some(r=>r.id===purgeResearch));assert.ok(remaining.researches.some(r=>r.id===ids.research))
 assert.ok(!remaining.reviews.some(r=>r.id===req.id));assert.equal(await call('rms_can_read_file',[purgePath]),false)
 assert.deepEqual(await call('rms_pending_deletions'),[{id:purgeResearch,name:'삭제 검증 연구'}])
 // Storage removal happens through Edge Functions, never a direct SQL delete.
 await db.exec('reset role');assert.equal((await db.query('select name from storage.objects where name=$1',[purgeOtherPath])).rows.length,1)
})
test('cleanup retries are idempotent and private to the original owner',async()=>{
 await as(ids.student);const first=await inputCall('rms_purge_research',purgeInput()),second=await inputCall('rms_purge_research',purgeInput());assert.deepEqual(first,second)
 await failure(()=>db.query('select * from public.rms_deletion_jobs'),'42501')
 await as(ids.professor);assert.deepEqual(await call('rms_pending_deletions'),[]);await failure(()=>inputCall('rms_purge_research',purgeInput()),'42501')
 await db.exec('reset role;set role service_role');await db.query('update public.rms_deletion_jobs set completed_at=now(),files=$1 where research_id=$2',['[]',purgeResearch])
 await as(ids.student);assert.deepEqual(await call('rms_pending_deletions'),[]);assert.deepEqual((await inputCall('rms_purge_research',purgeInput())).files,[])
})


test('review preview validates recipient and denies unrelated and anonymous callers', async()=>{
 await as(ids.student)
 assert.equal(await call('rms_validate_reviewer',[ids.research,'professor@example.test']),true)
 await failure(()=>call('rms_validate_reviewer',[ids.research,'unknown@example.test']),'22023')
 await failure(()=>call('rms_validate_reviewer',[ids.research,'student@example.test']),'22023')
 await as(ids.professor)
 await failure(()=>call('rms_validate_reviewer',[ids.research,'student@example.test']),'42501')
 await db.exec('reset role;set role anon')
 await failure(()=>call('rms_validate_reviewer',[ids.research,'professor@example.test']),'42501')
})
test('invite links are the only way into the allow list',async()=>{
 const guest='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',unconfirmed='ffffffff-ffff-4fff-8fff-ffffffffffff'
 await db.exec('reset role')
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,null)',[guest,'guest@example.test',unconfirmed,'pending@example.test'])
 // 초대를 쓰지 않은 가입 계정은 아무것도 못 하고, 초대도 만들지 못한다.
 await as(guest)
 await failure(()=>call('rms_bootstrap'),'42501')
 await failure(()=>call('rms_create_invite'),'42501')
 await failure(()=>call('rms_redeem_invite',['0'.repeat(32)]),'22023')
 await failure(()=>db.query('select * from public.rms_invites'),'42501')
 // 허용된 계정이 만든 초대는 다시 불러도 같은 코드다.
 await as(ids.student)
 const invite=await call('rms_create_invite');assert.match(invite.code,/^[0-9a-f]{32}$/)
 assert.equal((await call('rms_create_invite')).code,invite.code)
 // 로그인 전(anon)에도 유효한지 물을 수 있다.
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon')
 assert.equal(await call('rms_check_invite',[invite.code]),true)
 assert.equal(await call('rms_check_invite',['nope']),false)
 await failure(()=>call('rms_redeem_invite',[invite.code]),'42501')
 // 이메일을 확인하지 않은 계정은 초대를 쓸 수 없다.
 await as(unconfirmed)
 await failure(()=>call('rms_redeem_invite',[invite.code]),'42501')
 // 초대를 쓰면 허용 목록에 들어가고, 다시 써도 그대로다.
 await as(guest)
 assert.equal(await call('rms_redeem_invite',[invite.code]),true)
 assert.equal(await call('rms_redeem_invite',['nope']),true)
 assert.ok(await call('rms_bootstrap'))
 // 중지된 계정은 초대로 되살아나지 않고, 만료·취소된 초대는 닫힌다.
 await db.exec('reset role')
 await db.query('update public.rms_demo_accounts set active=false where user_id=$1',[guest])
 await as(guest)
 await failure(()=>call('rms_redeem_invite',[invite.code]),'42501')
 await db.exec('reset role')
 await db.query('delete from public.rms_invite_uses where user_id=$1',[guest]);await db.query('delete from public.rms_demo_accounts where user_id=$1',[guest])
 await db.query("update public.rms_invites set expires_at=now()-interval '1 minute' where code=$1",[invite.code])
 await as(guest)
 assert.equal(await call('rms_check_invite',[invite.code]),false)
 await failure(()=>call('rms_redeem_invite',[invite.code]),'22023')
 await as(ids.student)
 const next=await call('rms_create_invite');assert.notEqual(next.code,invite.code)
 // 초대를 만든 계정이 중지되면 그 초대도 닫힌다.
 await db.exec('reset role')
 await db.query('update public.rms_demo_accounts set active=false where user_id=$1',[ids.student])
 await as(guest)
 assert.equal(await call('rms_check_invite',[next.code]),false)
 await failure(()=>call('rms_redeem_invite',[next.code]),'22023')
 await db.exec('reset role')
 await db.query('update public.rms_demo_accounts set active=true where user_id=$1',[ids.student])
 // 쓴 기록만 남고 허용 목록에서 빠진 계정도 다시 초대를 쓸 수 있다.
 await db.query('insert into public.rms_invite_uses(user_id,code) values($1,$2)',[guest,next.code])
 await as(guest)
 assert.equal(await call('rms_redeem_invite',[next.code]),true)
 assert.ok(await call('rms_bootstrap'))
})
// ── 연구 초대 메일(rms_project_invites) ──────────────────────────────────────
const pi={owner:'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',editor:'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2',invitee:'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3',wrong:'a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4',prof:'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a5a5',research:'a6a6a6a6-a6a6-4a6a-8a6a-a6a6a6a6a6a6',other:'a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7'}
const hashOf=async token=>(await db.query("select encode(sha256(convert_to($1,'UTF8')),'hex') as h",[token])).rows[0].h
const token=n=>`tok-${n}-`.padEnd(43,'x')
const admin=async sql=>{await db.exec('reset role');return db.query(sql)}
const invite=async(n,email,role='editor',research=pi.research)=>inputCall('rms_project_invite_create',{researchId:research,email,role,tokenHash:await hashOf(token(n))})
test('project invite: setup accounts and research',async()=>{
 await db.exec('reset role')
 // owner·editor는 허용된 계정, invitee·wrong·prof는 가입만 하고 아직 허용 목록에 없는 계정
 for(const [key,email,allowed] of [['owner','pi-owner@example.test',true],['editor','pi-editor@example.test',true],['invitee','Pi-Invitee@example.test',false],['wrong','pi-wrong@example.test',false],['prof','pi-prof@example.test',false]]){
  await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[pi[key],email,JSON.stringify({name:key})])
  if(allowed) await db.query('insert into public.rms_demo_accounts(user_id) values($1)',[pi[key]])
 }
 await as(pi.owner)
 await call('rms_save_research',[JSON.stringify({...base(pi.research,pi.research),ownerId:pi.owner,name:'초대 연구',description:''})])
 await call('rms_save_research',[JSON.stringify({...base(pi.other,pi.other),ownerId:pi.owner,name:'다른 연구',description:''})])
 await save('feedback',{...base('a8a8a8a8-a8a8-4a8a-8a8a-a8a8a8a8a8a8',pi.research),title:'공동 기록',body:'함께 보는 기록',status:'unprocessed'})
})
test('project invite: only permitted members can invite, table is closed to the browser',async()=>{
 await as(pi.owner)
 await failure(()=>db.query('select * from public.rms_project_invites'),'42501')
 await failure(()=>invite(1,'not-an-email'),'22023')
 await failure(()=>invite(1,'pi-owner@example.test'),'22023')
 await failure(()=>invite(1,'x@example.test','owner'),'22023')
 await failure(()=>inputCall('rms_project_invite_create',{researchId:pi.research,email:'x@example.test',role:'editor',tokenHash:'short'}),'22023')
 // 연구에 속하지 않은 계정과 허용되지 않은 계정은 초대할 수 없다
 await as(pi.editor);await failure(()=>invite(1,'x@example.test'),'42501');await failure(()=>invite(1,'x@example.test','advisor'),'42501')
 await failure(()=>call('rms_project_invite_list',[pi.research]),'42501')
 await as(pi.invitee);await failure(()=>invite(1,'x@example.test'),'42501')
 await db.exec('reset role;set role anon')
 await failure(()=>invite(1,'x@example.test'),'42501')
 await failure(()=>call('rms_project_invite_accept',[token(1)]),'42501')
 await failure(()=>call('rms_project_invite_email_result',[pi.research,'a','sent','b','']),'42501')
 await as(pi.owner);await failure(()=>call('rms_project_invite_email_result',[pi.research,'a','sent','b','']),'42501')
})
test('project invite: create stores only the hash, blocks duplicates, previews by token',async()=>{
 await as(pi.owner)
 const created=await invite(1,' PI-Invitee@Example.test ')
 assert.equal(created.email,'pi-invitee@example.test');assert.equal(created.status,'pending');assert.equal(created.emailStatus,'queued');assert.equal(created.role,'editor');assert.equal(created.researchName,'초대 연구')
 assert.ok(!JSON.stringify(created).includes(token(1)));assert.ok(!('tokenHash' in created))
 const row=(await admin(`select token_hash from public.rms_project_invites where id='${created.id}'`)).rows[0]
 assert.equal(row.token_hash,await hashOf(token(1)));assert.notEqual(row.token_hash,token(1))
 await as(pi.owner)
 await failure(()=>invite(2,'pi-invitee@example.test'),'22023')
 // 같은 이메일이라도 다른 연구에는 따로 초대할 수 있다
 assert.equal((await invite(3,'pi-invitee@example.test','editor',pi.other)).status,'pending')
 await db.exec('reset role;set role anon')
 const seen=await call('rms_project_invite_preview',[token(1)])
 assert.deepEqual([seen.email,seen.role,seen.status,seen.researchName,seen.invitedByName],['pi-invitee@example.test','editor','pending','초대 연구','owner'])
 assert.equal(await call('rms_project_invite_preview',[token(99)]),null)
 assert.equal(await call('rms_project_invite_preview',['short']),null)
 // 서버 함수(service_role)가 발송 결과를 적는다. 초대 상태는 그대로다.
 await db.exec('reset role;set role service_role')
 await call('rms_project_invite_email_result',[created.id,await hashOf(token(1)),'sent','re_123',null])
 await call('rms_project_invite_email_result',[created.id,await hashOf(token(77)),'failed',null,'stale'])
 await as(pi.owner)
 const list=await call('rms_project_invite_list',[pi.research])
 assert.equal(list.length,1);assert.deepEqual([list[0].status,list[0].emailStatus,list[0].canManage],['pending','sent',true])
})
test('project invite: accept needs the token and the invited email, then creates membership once',async()=>{
 // 수락 전: 초대받은 계정은 허용 목록에 없어 아무 기록도 못 본다
 await as(pi.invitee);await failure(()=>call('rms_bootstrap'),'42501')
 // 다른 이메일로 로그인한 사람은 토큰이 있어도 수락할 수 없다
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(1)]),'42501')
 await as(pi.editor);await failure(()=>call('rms_project_invite_accept',[token(1)]),'42501')
 await as(pi.invitee)
 await failure(()=>call('rms_project_invite_accept',[token(99)]),'22023')
 // 이메일 확인 전에는 수락할 수 없다
 await admin(`update auth.users set email_confirmed_at=null where id='${pi.invitee}'`);await as(pi.invitee)
 await failure(()=>call('rms_project_invite_accept',[token(1)]),'42501')
 await admin(`update auth.users set email_confirmed_at=now() where id='${pi.invitee}'`);await as(pi.invitee)
 const done=await call('rms_project_invite_accept',[token(1)])
 assert.deepEqual(done,{researchId:pi.research,role:'editor',already:false})
 // 같은 링크를 다시 열어도 결과가 같고 멤버십은 하나다
 assert.deepEqual(await call('rms_project_invite_accept',[token(1)]),{researchId:pi.research,role:'editor',already:true})
 const data=await call('rms_bootstrap')
 assert.deepEqual(data.researches.map(r=>r.id),[pi.research]);assert.equal(data.feedback.length,1)
 const members=(await admin(`select role,status from public.rms_members where research_id='${pi.research}' and user_id='${pi.invitee}'`)).rows
 assert.deepEqual(members,[{role:'editor',status:'active'}])
 // 초대받지 않은 다른 연구는 여전히 못 본다. 편집자가 된 뒤에도 공동연구자 초대는 소유자만 한다.
 await as(pi.invitee)
 await failure(()=>call('rms_project_invite_list',[pi.other]),'42501')
 await failure(()=>invite(4,'someone@example.test'),'42501')
 // 다른 사람은 이미 쓴 링크를 쓸 수 없다
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(1)]),'42501')
 await as(pi.owner)
 const list=await call('rms_project_invite_list',[pi.research]);assert.equal(list[0].status,'accepted')
 await failure(()=>call('rms_project_invite_revoke',[list[0].id]),'22023')
 await failure(()=>invite(5,'pi-invitee@example.test'),'22023')
})
test('project invite: revoked and expired links cannot be accepted; resend rotates the token',async()=>{
 await as(pi.owner)
 const a=await invite(10,'pi-wrong@example.test')
 // 편집자(초대한 사람도 소유자도 아님)는 남의 초대를 취소·재발송할 수 없다
 await as(pi.invitee);await failure(()=>call('rms_project_invite_revoke',[a.id]),'42501')
 await failure(async()=>inputCall('rms_project_invite_resend',{id:a.id,tokenHash:await hashOf(token(11))}),'42501')
 await as(pi.owner)
 // 방금 보낸 초대는 바로 다시 보낼 수 없다
 await failure(async()=>inputCall('rms_project_invite_resend',{id:a.id,tokenHash:await hashOf(token(11))}),'53400')
 await admin(`update public.rms_project_invites set last_sent_at=now()-interval '2 minutes',expires_at=now()-interval '1 hour' where id='${a.id}'`)
 // 만료: 미리보기는 expired, 수락은 거부
 await db.exec('reset role;set role anon');assert.equal((await call('rms_project_invite_preview',[token(10)])).status,'expired')
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(10)]),'22023')
 await as(pi.owner);assert.equal((await call('rms_project_invite_list',[pi.research])).find(x=>x.id===a.id).status,'expired')
 // 다시 보내면 새 토큰만 통하고 옛 토큰은 죽는다
 const again=await inputCall('rms_project_invite_resend',{id:a.id,tokenHash:await hashOf(token(11))})
 assert.deepEqual([again.status,again.sendCount,again.emailStatus],['pending',2,'queued'])
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(10)]),'22023')
 // 취소한 초대는 수락할 수 없고, 취소는 여러 번 해도 같다
 await as(pi.owner);assert.equal((await call('rms_project_invite_revoke',[a.id])).status,'revoked');assert.equal((await call('rms_project_invite_revoke',[a.id])).status,'revoked')
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(11)]),'22023')
 await failure(()=>call('rms_bootstrap'),'42501')
 await as(pi.owner);await failure(async()=>inputCall('rms_project_invite_resend',{id:a.id,tokenHash:await hashOf(token(12))}),'22023')
 // 취소 뒤에는 같은 이메일로 새로 초대할 수 있다. 재발송은 5번까지다.
 const b=await invite(13,'pi-wrong@example.test')
 await admin(`update public.rms_project_invites set send_count=5,last_sent_at=now()-interval '2 minutes' where id='${b.id}'`)
 await as(pi.owner);await failure(async()=>inputCall('rms_project_invite_resend',{id:b.id,tokenHash:await hashOf(token(14))}),'53400')
})
test('project invite: closes when the research is trashed or the inviter loses access',async()=>{
 await as(pi.owner)
 // 연구가 휴지통에 가면 열려 있던 초대는 수락할 수 없다
 const research=(await call('rms_bootstrap')).researches.find(r=>r.id===pi.research)
 const trashed=await call('rms_save_research',[JSON.stringify({...research,deletedAt:'2026-11-11T00:00:00Z'})])
 await db.exec('reset role;set role anon');assert.equal((await call('rms_project_invite_preview',[token(13)])).status,'closed')
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(13)]),'22023')
 await as(pi.owner);await call('rms_save_research',[JSON.stringify({...trashed,deletedAt:null})])
 // 초대한 계정이 중지되면 그 계정의 초대도 닫힌다
 await admin(`update public.rms_demo_accounts set active=false where user_id='${pi.owner}'`)
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(13)]),'22023')
 await admin(`update public.rms_demo_accounts set active=true where user_id='${pi.owner}'`)
 // 중지된 계정은 초대로 되살아나지 않는다
 await admin(`insert into public.rms_demo_accounts(user_id,active) values('${pi.wrong}',false)`)
 await as(pi.wrong);await failure(()=>call('rms_project_invite_accept',[token(13)]),'42501')
 await admin(`delete from public.rms_demo_accounts where user_id='${pi.wrong}'`)
 await as(pi.wrong);assert.equal((await call('rms_project_invite_accept',[token(13)])).already,false)
})
test('project invite: advisor role grants an account but no research membership',async()=>{
 // 활성 편집자도 지도교수는 초대할 수 있다(지도교수 목록 편집 권한과 같음)
 await as(pi.invitee)
 const adv=await invite(20,'pi-prof@example.test','advisor')
 assert.equal(adv.role,'advisor')
 await as(pi.prof)
 assert.deepEqual(await call('rms_project_invite_accept',[token(20)]),{researchId:pi.research,role:'advisor',already:false})
 const data=await call('rms_bootstrap')
 assert.equal(data.researches.length,0);assert.equal(data.feedback.length,0)
 assert.equal((await admin(`select count(*)::int as n from public.rms_members where user_id='${pi.prof}'`)).rows[0].n,0)
 await as(pi.prof);await failure(()=>call('rms_project_invite_list',[pi.research]),'42501')
 // 이미 마진을 쓰는 이메일은 지도교수로 다시 초대하지 않는다
 await as(pi.owner);await failure(()=>invite(21,'pi-prof@example.test','advisor'),'22023')
 // 초대한 편집자의 접근이 해제되면 그 사람이 보낸 초대도 닫힌다
 await as(pi.invitee);await invite(22,'later-prof@example.test','advisor')
 await as(pi.owner);await inputCall('rms_member_action',{researchId:pi.research,action:'remove',userId:pi.invitee})
 await db.exec('reset role;set role anon');assert.equal((await call('rms_project_invite_preview',[token(22)])).status,'closed')
})
test('project invite: daily sending limit per inviter',async()=>{
 await admin(`update public.rms_project_invites set last_sent_at=now()-interval '2 days' where invited_by='${pi.owner}'`)
 await as(pi.owner)
 for(let i=0;i<20;i++) await invite(100+i,`bulk${i}@example.test`,'editor',pi.other)
 await failure(()=>invite(130,'bulk-over@example.test','editor',pi.other),'53400')
})
test('project invite: permanent research deletion removes its invites',async()=>{
 await as(pi.owner)
 const research=(await call('rms_bootstrap')).researches.find(r=>r.id===pi.other)
 await call('rms_save_research',[JSON.stringify({...research,deletedAt:'2026-11-11T00:00:00Z'})])
 await inputCall('rms_purge_research',{researchId:pi.other,confirmationName:'다른 연구'})
 assert.equal((await admin(`select count(*)::int as n from public.rms_project_invites where research_id='${pi.other}'`)).rows[0].n,0)
})
