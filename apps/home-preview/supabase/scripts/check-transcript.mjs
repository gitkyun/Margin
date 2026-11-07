// Isolated storage/auth contract test. The silent fixture and Korean strings
// below are test inputs, never claimed as real microphone recognition results.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
if(!process.argv.includes('--apply'))throw new Error('가상 연구와 녹음 저장 검증에는 --apply가 필요합니다.');
const cfg=Object.fromEntries((await readFile('.env.local','utf8')).split('\n').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
const client=()=>createClient(cfg.VITE_SUPABASE_URL,cfg.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,i)=>fetch(u,{...i,signal:AbortSignal.timeout(20000)})}});
const owner=client(),other=client(),anon=client(),rid=randomUUID(),checks=[];
const pass=x=>{checks.push(x);console.log('PASS '+x)};
async function rpc(c,n,args){const r=await c.rpc(n,args);if(r.error)throw Object.assign(new Error(n+': '+r.error.message),{code:r.error.code});return r.data;}
const base=()=>({id:randomUUID(),researchId:rid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
let research;
try{
 let own,foreign;
 for(const [c,role] of [[owner,'STUDENT'],[other,'PROFESSOR']]){const r=await c.auth.signInWithPassword({email:process.env[`RMS_${role}_EMAIL`],password:process.env[`RMS_${role}_PASSWORD`]});assert.ifError(r.error);if(c===owner)own=r.data.user;else foreign=r.data.user;}
 research=await rpc(owner,'rms_save_research',{p_value:{...base(),id:rid,ownerId:own.id,name:'한국어 전사 저장 검증 · 가상 기록',description:'실제 전사 결과가 아닌 저장·권한 검사용 입력과 1초 무음 파일입니다.',example:true}});
 const meeting=await rpc(owner,'rms_save_record',{p_kind:'meetings',p_value:{...base(),title:'전사 저장 검증',date:null,time:null,goal:'저장 확인',memo:'',memoRevision:1,status:'recording',taskIds:[],versionIds:[],questionIds:[],visibility:'private'}});
 const recordingId=randomUUID(),path=`${own.id}/${rid}/${recordingId}.webm`,bytes=await readFile('.local/transcription/silence.webm');
 const upload=await owner.storage.from('research-private').upload(path,bytes,{contentType:'audio/webm',upsert:false});assert.ifError(upload.error);
 const recording=await rpc(owner,'rms_save_record',{p_kind:'recordings',p_value:{...base(),id:recordingId,meetingId:meeting.id,title:'저장 검증용 무음 · 실제 미팅 아님',storagePath:path,fileName:'silence.webm',mimeType:'audio/webm',size:bytes.length,duration:1,consentAt:new Date().toISOString(),visibility:'shared'}});
 const args={p_recording_id:recording.id,p_segments:[{text:'저장 검사용 입력입니다.',final:true},{text:'실제 전사 아님',final:false}],p_text:'저장 검사용 입력입니다. 실제 전사 아님',p_consent_at:recording.consentAt,p_warnings:[],p_revision:0};
 let transcript=await rpc(owner,'rms_save_live_transcript',args);assert.equal(transcript.language,'ko-KR');assert.equal(transcript.raw_segments[1].final,false);pass('실제 음성 파일과 한국어 텍스트 저장');
 transcript=await rpc(owner,'rms_save_live_transcript',{...args,p_revision:1,p_text:'직접 고친 저장 검사용 문장입니다.'});assert.equal(transcript.revision,2);assert.deepEqual(transcript.raw_segments,args.p_segments);
 const replay=await rpc(owner,'rms_save_live_transcript',{...args,p_revision:1,p_text:transcript.edited_text});assert.equal(replay.revision,2);
 const stale=await owner.rpc('rms_save_live_transcript',{...args,p_revision:1,p_text:'오래된 창의 수정'});assert.equal(stale.error?.code,'PT409');
 const forged=await owner.rpc('rms_save_live_transcript',{...args,p_revision:2,p_segments:[{text:'바뀐 원문',final:true}]});assert.equal(forged.error?.code,'22023');pass('수정본 저장·원 인식문 보존·충돌 거부·재시도');
 await rpc(owner,'rms_member_action',{p_input:{action:'invite',researchId:rid,email:foreign.email}});await rpc(other,'rms_member_action',{p_input:{action:'accept',researchId:rid}});
 const voice=await other.storage.from('research-private').download(path);assert.ifError(voice.error);
 const foreignRead=await other.from('rms_live_transcripts').select('*').eq('recording_id',recording.id);assert.ifError(foreignRead.error);assert.equal(foreignRead.data.length,0);
 const write=await other.rpc('rms_save_live_transcript',args);assert.equal(write.error?.code,'42501');pass('음성 공유와 전사문 비공개 권한 분리');
 const anonymous=await anon.from('rms_live_transcripts').select('*');assert.ok(anonymous.error);const anonWrite=await anon.rpc('rms_save_live_transcript',args);assert.ok(anonWrite.error);pass('비로그인 조회·수정 거부');
 const fresh=client();try{const login=await fresh.auth.signInWithPassword({email:process.env.RMS_STUDENT_EMAIL,password:process.env.RMS_STUDENT_PASSWORD});assert.ifError(login.error);const read=await fresh.from('rms_live_transcripts').select('*').eq('recording_id',recording.id).single();assert.ifError(read.error);assert.equal(read.data.edited_text,transcript.edited_text);}finally{await fresh.auth.signOut({scope:'local'});}pass('새 로그인 세션에서 저장문 다시 조회');
 research=await rpc(owner,'rms_save_research',{p_value:{...research,deletedAt:new Date().toISOString()}});
 const trashed=await owner.from('rms_live_transcripts').select('*').eq('recording_id',recording.id);assert.ifError(trashed.error);assert.equal(trashed.data.length,0);
 research=await rpc(owner,'rms_save_research',{p_value:{...research,deletedAt:undefined}});const restored=await owner.from('rms_live_transcripts').select('*').eq('recording_id',recording.id).single();assert.ifError(restored.error);assert.equal(restored.data.edited_text,transcript.edited_text);pass('휴지통 접근 차단·복원 후 전사문 유지');
 await mkdir('../../.local/transcription',{recursive:true});await writeFile('../../.local/transcription/live-check.json',JSON.stringify({checkedAt:new Date().toISOString(),researchId:rid,checks,realMicrophoneRecognitionTested:false,geminiCalled:false},null,2)+'\n',{mode:0o600});
}finally{
 if(research){try{const r=await rpc(owner,'rms_bootstrap');const latest=r.researches.find(x=>x.id===rid);if(latest)await rpc(owner,'rms_save_research',{p_value:{...latest,archivedAt:new Date().toISOString()}});}catch{}}
 await owner.auth.signOut({scope:'local'});await other.auth.signOut({scope:'local'});
}
