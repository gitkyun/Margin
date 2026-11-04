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
 assert.equal(roundA.number,1);assert.equal(roundA.versionId,v2.id);assert.ok(!JSON.stringify(roundA).includes('개인 메모'))
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
