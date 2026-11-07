// Read-only deployed boundary checks. Does not generate content or create records.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const env=await readFile('.env.local','utf8');const vars=Object.fromEntries(env.split('\n').filter(v=>v&&!v.startsWith('#')).map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const url=vars.VITE_SUPABASE_URL,key=vars.VITE_SUPABASE_PUBLISHABLE_KEY;
const student=createClient(url,key,{auth:{persistSession:false}});const {data:auth,error}=await student.auth.signInWithPassword({email:process.env.RMS_STUDENT_EMAIL,password:process.env.RMS_STUDENT_PASSWORD});assert.ifError(error);
const {data:usage,error:usageError}=await student.rpc('rms_ai_usage');assert.ifError(usageError);assert.equal(usage.limit,100);assert.equal(usage.windowHours,24);console.log('PASS own usage returns counts without prompts');
const {data:workspace,error:bootError}=await student.rpc('rms_bootstrap');assert.ifError(bootError);const meeting=workspace.meetings.find(m=>m.id==='3689af4f-b077-4c67-a9ff-d9841ca41d30');assert.ok(meeting);
const input={mode:'ask_research',researchId:meeting.researchId,meetingId:meeting.id,sourceRevision:meeting.memoRevision,sourceText:meeting.memo,question:'원문에서 다음에 확인할 점을 정리해 줘.',history:[]};
const response=await fetch(url+'/functions/v1/ai-assist',{method:'POST',headers:{Authorization:'Bearer '+auth.session.access_token,apikey:key,'Content-Type':'application/json',Origin:'https://rms-classroom-demo.pages.dev'},body:JSON.stringify(input)});const body=await response.json();assert.equal(response.status,503);assert.equal(body.error.code,'NOT_CONFIGURED');assert.ok(!body.answer);console.log('PASS contextual chat validates source then reports missing key; no fabricated response');
const anon=createClient(url,key,{auth:{persistSession:false}});const {error:denied}=await anon.rpc('rms_ai_usage');assert.ok(denied);console.log('PASS anonymous usage access denied');
await student.auth.signOut({scope:"local"});
