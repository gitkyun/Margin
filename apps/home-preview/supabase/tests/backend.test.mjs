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
test('task document link: same research, readable by the saver, not archived; others cannot write',async()=>{
 const taskId='a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',privateDocId='a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2',otherDocId='a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3',spareDocId='a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4'
 const task={...base(taskId),title:'계획서 2장 고치기',description:'',status:'todo',priority:'normal',dueDate:null,feedbackIds:[],visibility:'shared'}
 await as(ids.student)
 // 연결된 문서가 없는 할 일은 그대로 저장되고, 같은 연구의 공유 문서는 연결할 수 있다
 let saved=await save('tasks',task);saved=await save('tasks',{...saved,documentId:sharedDoc.id});assert.equal(saved.documentId,sharedDoc.id)
 // 없는 문서·잘못된 값·다른 연구의 문서는 거부
 await failure(()=>save('tasks',{...saved,documentId:'a9a9a9a9-a9a9-4a9a-8a9a-a9a9a9a9a9a9'}),'22023')
 await failure(()=>save('tasks',{...saved,documentId:'not-a-uuid'}),'22023')
 await save('documents',{...base(otherDocId,ids.otherResearch),title:'다른 연구 문서',type:'note',content:{type:'doc',content:[]},text:'',revision:0})
 await failure(()=>save('tasks',{...saved,documentId:otherDocId}),'22023')
 // 공동연구자의 비공개 문서는 볼 수 없으므로 연결할 수 없다
 await as(ids.stranger);await save('documents',{...base(privateDocId),title:'공동연구자 비공개 메모',type:'note',content:{type:'doc',content:[]},text:'',revision:0,visibility:'private'})
 await as(ids.student);await failure(()=>save('tasks',{...saved,documentId:privateDocId}),'42501')
 // 공동연구자는 학생이 건 연결을 유지한 채 다른 칸을 고칠 수 있다
 await as(ids.stranger);saved=await save('tasks',{...saved,status:'doing'});assert.equal(saved.documentId,sharedDoc.id)
 // 보관된 문서는 새로 연결할 수 없지만, 이미 걸린 연결이 있는 할 일은 계속 고칠 수 있다
 await as(ids.student);const spare=await save('documents',{...base(spareDocId),title:'보관할 문서',type:'note',content:{type:'doc',content:[]},text:'',revision:0,visibility:'shared'})
 saved=await save('tasks',{...saved,documentId:spare.id})
 await call('rms_delete_record',['documents',spare.id])
 saved=await save('tasks',{...saved,title:'계획서 2장 고치기(보관 뒤)'});assert.equal(saved.documentId,spare.id)
 saved=await save('tasks',{...saved,documentId:sharedDoc.id})
 await failure(()=>save('tasks',{...saved,documentId:spare.id}),'22023')
 // 연결 해제는 언제나 가능
 saved=await save('tasks',{...saved,documentId:null});assert.equal(saved.documentId??null,null)
 // 연구에 참여하지 않은 교수와 익명 사용자는 할 일을 바꿀 수 없다
 await as(ids.professor);await failure(()=>save('tasks',{...saved,documentId:sharedDoc.id}),'42501')
 await as(null);await assert.rejects(()=>save('tasks',{...saved,documentId:sharedDoc.id}))
 // 브라우저 역할은 검사 함수를 직접 부를 수 없다
 await as(ids.student);await failure(()=>db.query('select public.rms_check_task_document()'),'42501')
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
