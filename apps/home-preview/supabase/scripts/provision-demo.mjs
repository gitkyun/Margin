#!/usr/bin/env node
// Run locally with ignored environment values. This script never prints keys or passwords.
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RMS_STUDENT_EMAIL','RMS_STUDENT_PASSWORD','RMS_PROFESSOR_EMAIL','RMS_PROFESSOR_PASSWORD']
for(const name of required)if(!process.env[name])throw new Error(`${name} 값을 로컬 환경에 설정해 주세요.`)
const url=new URL(process.env.SUPABASE_URL)
if(url.protocol!=='https:'&&url.hostname!=='127.0.0.1'&&url.hostname!=='localhost')throw new Error('HTTPS Supabase 주소를 사용해 주세요.')
if(process.env.RMS_STUDENT_EMAIL.toLowerCase()===process.env.RMS_PROFESSOR_EMAIL.toLowerCase())throw new Error('학생과 교수 이메일은 서로 달라야 합니다.')
for(const role of ['STUDENT','PROFESSOR'])if(process.env[`RMS_${role}_PASSWORD`].length<8)throw new Error('시연 비밀번호는 8자 이상으로 설정해 주세요.')
if(!process.argv.includes('--apply')){console.log('설정 확인 완료. 실제 계정 생성은 --apply를 붙여 실행하세요. 기존 계정의 비밀번호는 변경하지 않습니다.');process.exit(0)}
const headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'}
async function request(path,init={}){const response=await fetch(new URL(path,url),{...init,headers:{...headers,...init.headers}});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(`계정 준비 요청이 실패했습니다 (${response.status}). 키·프로젝트·마이그레이션을 확인해 주세요.`);return body}
async function findUser(email){for(let page=1;page<=20;page++){const result=await request(`/auth/v1/admin/users?page=${page}&per_page=100`);const users=result.users??[];const user=users.find(user=>user.email?.toLowerCase()===email.toLowerCase());if(user)return user;if(users.length<100)return null}throw new Error('계정 수가 많아 자동 확인을 중단했습니다. 전용 시연 프로젝트를 사용해 주세요.')}
for(const [role,label,name]of[['STUDENT','학생','김학생'],['PROFESSOR','교수','지도교수']]){
 const email=process.env[`RMS_${role}_EMAIL`].trim(),password=process.env[`RMS_${role}_PASSWORD`]
 let user=await findUser(email)
 if(!user){const result=await request('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});user=result.user??result}
 else if(!user.email_confirmed_at)throw new Error(`${label} 계정의 이메일 확인을 먼저 완료해 주세요. 기존 계정은 자동 변경하지 않습니다.`)
 if(!user.id)throw new Error(`${label} 계정 식별자를 확인하지 못했습니다.`)
 await request('/rest/v1/rms_demo_accounts?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,active:true})})
 console.log(`${label} 시연 계정 준비 완료${user.created_at?' (기존 계정 비밀번호는 유지)':''}`)
}
console.log('허용 계정 등록 완료. 서비스 브라우저에서 두 계정의 로그인을 각각 확인하세요.')
