#!/usr/bin/env node
// Read-only HTTP checks. Never prints credentials or tokens, never invokes Gemini.
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const env=Object.fromEntries((await readFile('.env.local','utf8')).split('\n').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const student=client(),professor=client();
const login=async(c,role)=>{const r=await c.auth.signInWithPassword({email:process.env[`RMS_${role}_EMAIL`],password:process.env[`RMS_${role}_PASSWORD`]});assert.ifError(r.error);return r.data.session.access_token};
const studentToken=await login(student,'STUDENT'),professorToken=await login(professor,'PROFESSOR');
const {data,error}=await student.rpc('rms_bootstrap');assert.ifError(error);
const meeting=data.meetings.find(m=>m.memo?.trim());assert(meeting);
const input={mode:'organize_meeting',researchId:meeting.researchId,meetingId:meeting.id,sourceText:meeting.memo,sourceRevision:meeting.memoRevision};
const checks=[];
const check=async(label,token,origin,status,code)=>{const r=await fetch(`${url}/functions/v1/ai-assist`,{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(origin?{Origin:origin}:{})},body:JSON.stringify(input)});const b=await r.json().catch(()=>({error:{code:'NON_JSON_RESPONSE'}}));assert.equal(r.status,status,label);assert.equal(b.error?.code,code,label);if(status===503)assert.equal(r.headers.get('access-control-allow-origin'),origin);checks.push(label);console.log(`PASS ${label}`)};
await check('비로그인 AI 요청 거부',null,null,401,'UNAUTHENTICATED');
await check('잘못된 인증 토큰 거부','invalid',null,401,'UNAUTHENTICATED');
await check('교수 계정의 학생 원문 AI 처리 거부',professorToken,null,403,'FORBIDDEN');
await check('다른 사이트의 AI 요청 거부',studentToken,'https://untrusted.example',403,'ORIGIN_NOT_ALLOWED');
for (const origin of ['https://rms-classroom-demo.pages.dev','https://margin-research.pages.dev']) {
 await check('배포 주소 허용·키 미설정 안내 '+origin,studentToken,origin,503,'NOT_CONFIGURED');
 const options=await fetch(`${url}/functions/v1/ai-assist`,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization,apikey,content-type'}});
 assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),origin);checks.push('배포 주소 사전 요청 허용 '+origin);
}
await writeFile('supabase/edge-check.local.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,geminiCalled:false},null,2)+'\n',{mode:0o600});
await student.auth.signOut({scope:"local"});await professor.auth.signOut({scope:"local"});
