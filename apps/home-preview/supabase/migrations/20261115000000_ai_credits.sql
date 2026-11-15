-- AI 크레딧: 개인 계정마다 매월 1일 0시(UTC, 한국시간 오전 9시)에 20000크레딧(1크레딧 = 0.001달러)을 새로 채웁니다.
-- 추가만 합니다. 기존 rms_ai_begin_v2·rms_ai_finish_v2·rms_cancel_ai는 그대로 두고,
-- rms_ai_begin(24시간 100회 제한 제거, 분당 6회 유지)과 rms_ai_usage(응답 필드 유지 + credits)만 다시 정의합니다.
--
-- 규칙
--  * 월 지급분은 이월하지 않습니다. 운영이 따로 주는 크레딧(grant)은 별도 잔액이며 달이 바뀌어도 남습니다.
--  * 서버가 제공사에 보내기 전에 예약(reserve)하고, 실제 토큰으로 계산한 금액을 확정(settle)합니다. 예약은 실제 잔액을 넘지 못합니다.
--  * 예약은 시간이 지나도 저절로 풀리지 않습니다. 제공사가 실제로 처리했는지 알 수 없는 요청을 공짜로 만들지 않기 위해서입니다.
--    확정 또는 반환(refund)은 실행마다 한 번만 반영되고, 이후 호출(늦은 응답 포함)은 false를 돌려줍니다.
--  * 금액은 numeric(14,3)이며 소수 셋째 자리에서 올림합니다(0.0004도 0.001).
--  * 브라우저는 표를 직접 읽지 못하고 rms_ai_usage()로 자기 몫만 읽습니다. 예약·확정·지급·초기화 함수는 service_role 전용입니다.
--  * 기록(원장·예약)은 연구를 완전 삭제해도 남도록 rms_ai_runs를 참조하지 않습니다.

create function public.rms_ai_credit_allowance() returns numeric
language sql immutable set search_path=pg_catalog,public
as $$ select 20000::numeric $$;

-- 달 시작(UTC). 다음 지급 시각은 이 값 + 1개월입니다.
create function public.rms_ai_credit_period(p_at timestamptz default clock_timestamp()) returns timestamptz
language sql stable set search_path=pg_catalog,public
as $$ select date_trunc('month', p_at at time zone 'UTC') at time zone 'UTC' $$;

create table public.rms_ai_credit_balances(
 user_id uuid primary key references auth.users(id),
 period_start timestamptz not null,
 monthly_used numeric(14,3) not null default 0 check(monthly_used>=0),
 monthly_reserved numeric(14,3) not null default 0 check(monthly_reserved>=0),
 grant_balance numeric(14,3) not null default 0 check(grant_balance>=0),
 grant_reserved numeric(14,3) not null default 0 check(grant_reserved>=0),
 updated_at timestamptz not null default clock_timestamp(),
 check(monthly_used+monthly_reserved<=20000),
 check(grant_reserved<=grant_balance));

create table public.rms_ai_credit_holds(
 run_id uuid primary key,
 user_id uuid not null references auth.users(id),
 period_start timestamptz not null,
 reserved numeric(14,3) not null check(reserved>0),
 monthly_part numeric(14,3) not null check(monthly_part>=0),
 grant_part numeric(14,3) not null check(grant_part>=0),
 status text not null default 'reserved' check(status in('reserved','settled','refunded')),
 charged numeric(14,3) check(charged>=0),
 created_at timestamptz not null default clock_timestamp(),
 settled_at timestamptz,
 check(monthly_part+grant_part=reserved));
create index rms_ai_credit_holds_user on public.rms_ai_credit_holds(user_id,status);

-- amount: 잔액에 미친 영향(차감은 음수, 지급은 양수). reserve는 보류라 화면 목록에서 빼고 reserved 합계로만 보여 줍니다.
create table public.rms_ai_credit_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 run_id uuid,
 kind text not null check(kind in('reserve','charge','refund','grant')),
 amount numeric(14,3) not null,
 model text,
 usage jsonb not null default '{}',
 grant_key text,
 created_at timestamptz not null default clock_timestamp());
create index rms_ai_credit_ledger_user on public.rms_ai_credit_ledger(user_id,created_at desc);
create unique index rms_ai_credit_grant_key on public.rms_ai_credit_ledger(user_id,grant_key) where kind='grant' and grant_key is not null;

alter table public.rms_ai_credit_balances enable row level security;
alter table public.rms_ai_credit_holds enable row level security;
alter table public.rms_ai_credit_ledger enable row level security;
revoke all on public.rms_ai_credit_balances,public.rms_ai_credit_holds,public.rms_ai_credit_ledger from public,anon,authenticated;
grant all on public.rms_ai_credit_balances,public.rms_ai_credit_holds,public.rms_ai_credit_ledger to service_role;

-- 내부용: 행을 잠그고 달이 바뀌었으면 월 사용·예약을 0으로 되돌립니다. 이월은 없습니다.
create function public.rms_ai_credit_roll(p_user_id uuid) returns public.rms_ai_credit_balances
language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
declare v_period timestamptz:=public.rms_ai_credit_period(); b public.rms_ai_credit_balances;
begin
 insert into public.rms_ai_credit_balances(user_id,period_start) values(p_user_id,v_period) on conflict(user_id) do nothing;
 select * into b from public.rms_ai_credit_balances where user_id=p_user_id for update;
 if b.period_start<v_period then
  update public.rms_ai_credit_balances set period_start=v_period,monthly_used=0,monthly_reserved=0,updated_at=clock_timestamp() where user_id=p_user_id returning * into b;
 end if;
 return b;
end $$;

-- 내부용: 쓰기 없이 현재 잔액을 계산합니다(달이 바뀐 행은 0으로 간주).
create function public.rms_ai_credit_summary(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth
as $$
declare v_period timestamptz:=public.rms_ai_credit_period(); b public.rms_ai_credit_balances; v_allow numeric:=public.rms_ai_credit_allowance();
 v_used numeric:=0; v_mres numeric:=0; v_ledger jsonb;
begin
 select * into b from public.rms_ai_credit_balances where user_id=p_user_id;
 if found and b.period_start>=v_period then v_used:=b.monthly_used; v_mres:=b.monthly_reserved; end if;
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'createdAt',created_at,'amount',amount,'kind',kind,'model',model,'runId',run_id)) order by created_at desc,id desc),'[]') into v_ledger
 from (select * from public.rms_ai_credit_ledger where user_id=p_user_id and kind<>'reserve' order by created_at desc,id desc limit 50) l;
 return jsonb_build_object('balance',v_allow-v_used-v_mres+coalesce(b.grant_balance-b.grant_reserved,0),'allowance',v_allow,'reserved',v_mres+coalesce(b.grant_reserved,0),'used',v_used,
  'grant',coalesce(b.grant_balance,0),'resetsAt',(date_trunc('month',v_period at time zone 'UTC')+interval '1 month') at time zone 'UTC','ledger',v_ledger);
end $$;

-- 서비스 전용: 계정의 크레딧 행을 만들고(달이 바뀌었으면 초기화) 현재 잔액을 돌려줍니다.
create function public.rms_ai_credit_init(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
begin
 if p_user_id is null or not exists(select 1 from public.rms_demo_accounts where user_id=p_user_id and active) then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
 perform public.rms_ai_credit_roll(p_user_id);
 return public.rms_ai_credit_summary(p_user_id);
end $$;

-- 서비스 전용: 운영 지급. 월 지급분과 별도 잔액이고 이월 규칙을 받지 않습니다. 같은 p_grant_key는 한 번만 반영합니다.
create function public.rms_ai_credit_grant(p_user_id uuid,p_amount numeric,p_reason text default null,p_grant_key text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
declare v_amt numeric;
begin
 if p_user_id is null or p_amount is null or p_amount<=0 or p_amount>1000000000 then raise exception '지급 금액을 확인해 주세요.' using errcode='22023'; end if;
 if not exists(select 1 from public.rms_demo_accounts where user_id=p_user_id and active) then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
 v_amt:=ceil(p_amount*1000)/1000;
 perform public.rms_ai_credit_roll(p_user_id);
 if p_grant_key is not null and exists(select 1 from public.rms_ai_credit_ledger where user_id=p_user_id and kind='grant' and grant_key=left(p_grant_key,128)) then return public.rms_ai_credit_summary(p_user_id); end if;
 update public.rms_ai_credit_balances set grant_balance=grant_balance+v_amt,updated_at=clock_timestamp() where user_id=p_user_id;
 insert into public.rms_ai_credit_ledger(user_id,kind,amount,usage,grant_key) values(p_user_id,'grant',v_amt,jsonb_build_object('reason',left(p_reason,200)),left(p_grant_key,128));
 return public.rms_ai_credit_summary(p_user_id);
end $$;

-- 서비스 전용: 제공사 호출 전에 최대 예상 금액을 보류합니다.
-- true: 이 실행의 예약이 살아 있음(같은 요청 재시도 포함). false: 이미 확정·반환된 실행. 잔액 부족은 P0001.
create function public.rms_ai_reserve_credits(p_run_id uuid,p_user_id uuid,p_amount numeric) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
declare v_amt numeric; r public.rms_ai_runs; b public.rms_ai_credit_balances; h public.rms_ai_credit_holds;
 v_avail_m numeric; v_avail_g numeric; v_m numeric;
begin
 if p_run_id is null or p_user_id is null or p_amount is null or p_amount<=0 or p_amount>1000000000 then raise exception '예약 금액을 확인해 주세요.' using errcode='22023'; end if;
 v_amt:=ceil(p_amount*1000)/1000;
 if not exists(select 1 from public.rms_demo_accounts where user_id=p_user_id and active) then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
 select * into r from public.rms_ai_runs where id=p_run_id;
 if r.id is null or r.user_id<>p_user_id then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
 b:=public.rms_ai_credit_roll(p_user_id);
 select * into h from public.rms_ai_credit_holds where run_id=p_run_id for update;
 if found then
  if h.user_id<>p_user_id then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
  if h.status<>'reserved' then return false; end if;
  if h.reserved<>v_amt then raise exception '이미 다른 금액으로 예약한 요청입니다.' using errcode='55000'; end if;
  return true;
 end if;
 if r.status='cancelled' or exists(select 1 from public.rms_ai_cancellations where id=p_run_id and user_id=p_user_id) then raise exception '중단한 요청입니다.' using errcode='57014'; end if;
 if r.status<>'running' then raise exception '이미 끝난 요청입니다.' using errcode='55000'; end if;
 v_avail_m:=public.rms_ai_credit_allowance()-b.monthly_used-b.monthly_reserved;
 v_avail_g:=b.grant_balance-b.grant_reserved;
 if v_avail_m+v_avail_g<v_amt then raise exception 'AI 크레딧이 부족합니다.' using errcode='P0001'; end if;
 v_m:=least(v_avail_m,v_amt);
 update public.rms_ai_credit_balances set monthly_reserved=monthly_reserved+v_m,grant_reserved=grant_reserved+(v_amt-v_m),updated_at=clock_timestamp() where user_id=p_user_id;
 insert into public.rms_ai_credit_holds(run_id,user_id,period_start,reserved,monthly_part,grant_part) values(p_run_id,p_user_id,b.period_start,v_amt,v_m,v_amt-v_m);
 insert into public.rms_ai_credit_ledger(user_id,run_id,kind,amount,model) values(p_user_id,p_run_id,'reserve',-v_amt,r.model);
 return true;
end $$;

-- 서비스 전용: 실제 사용량으로 확정하거나(p_refund=false) 제공사가 처리하지 않았음이 확실할 때 전액 반환합니다(p_refund=true).
-- 실행마다 처음 한 번만 true. 이미 처리했거나 예약이 없으면 false라 취소 뒤 늦은 응답이 두 번 차감하지 않습니다.
-- 확정 금액이 예약보다 크면 남은 잔액 범위에서만 더 차감하고 모자란 만큼은 usage.clamped에 남깁니다(잔액은 음수가 되지 않음).
create function public.rms_ai_settle_credits(p_run_id uuid,p_amount numeric,p_usage jsonb default '{}',p_refund boolean default false) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
declare v_user uuid; b public.rms_ai_credit_balances; h public.rms_ai_credit_holds; v_charge numeric:=0; v_same boolean;
 v_from_m numeric; v_from_g numeric; v_extra numeric; v_used numeric; v_mres numeric; v_gbal numeric; v_gres numeric; v_x_m numeric; v_x_g numeric; v_clamped numeric;
 v_total numeric; v_model text; v_usage jsonb;
begin
 if p_run_id is null then raise exception '실행 번호를 확인해 주세요.' using errcode='22023'; end if;
 v_usage:=coalesce(p_usage,'{}');
 if jsonb_typeof(v_usage)<>'object' then raise exception '사용량 형식을 확인해 주세요.' using errcode='22023'; end if;
 if not coalesce(p_refund,false) then
  if p_amount is null or p_amount<0 or p_amount>1000000000 then raise exception '확정 금액을 확인해 주세요.' using errcode='22023'; end if;
  v_charge:=ceil(p_amount*1000)/1000;
 end if;
 select user_id into v_user from public.rms_ai_credit_holds where run_id=p_run_id;
 if v_user is null then return false; end if;
 b:=public.rms_ai_credit_roll(v_user);
 select * into h from public.rms_ai_credit_holds where run_id=p_run_id for update;
 if h.status<>'reserved' then return false; end if;
 v_same:=h.period_start=b.period_start;
 v_from_m:=least(v_charge,h.monthly_part);
 v_from_g:=least(v_charge-v_from_m,h.grant_part);
 v_extra:=v_charge-v_from_m-v_from_g;
 v_used:=b.monthly_used+case when v_same then v_from_m else 0 end;
 v_mres:=b.monthly_reserved-case when v_same then h.monthly_part else 0 end;
 v_gbal:=b.grant_balance-v_from_g;
 v_gres:=b.grant_reserved-h.grant_part;
 v_x_m:=greatest(least(v_extra,public.rms_ai_credit_allowance()-v_used-v_mres),0);
 v_x_g:=greatest(least(v_extra-v_x_m,v_gbal-v_gres),0);
 v_clamped:=v_extra-v_x_m-v_x_g;
 v_total:=v_from_m+v_from_g+v_x_m+v_x_g;
 update public.rms_ai_credit_balances set monthly_used=v_used+v_x_m,monthly_reserved=v_mres,grant_balance=v_gbal-v_x_g,grant_reserved=v_gres,updated_at=clock_timestamp() where user_id=v_user;
 update public.rms_ai_credit_holds set status=case when coalesce(p_refund,false) then 'refunded' else 'settled' end,charged=v_total,settled_at=clock_timestamp() where run_id=p_run_id;
 select model into v_model from public.rms_ai_runs where id=p_run_id;
 if coalesce(p_refund,false) then
  insert into public.rms_ai_credit_ledger(user_id,run_id,kind,amount,model,usage) values(v_user,p_run_id,'refund',0,v_model,v_usage||jsonb_build_object('released',h.reserved));
 else
  insert into public.rms_ai_credit_ledger(user_id,run_id,kind,amount,model,usage) values(v_user,p_run_id,'charge',-v_total,v_model,
   v_usage||jsonb_build_object('reserved',h.reserved,'released',greatest(h.reserved-v_total,0))||case when v_clamped>0 then jsonb_build_object('clamped',v_clamped) else '{}'::jsonb end);
 end if;
 return true;
end $$;

-- 24시간 100회 제한을 크레딧으로 바꿉니다. 분당 6회 안전 제한과 같은 입력 중복 막기는 그대로입니다.
create or replace function public.rms_ai_begin(p_user_id uuid,p_research_id uuid,p_input_hash text) returns uuid language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.rms_demo_accounts where user_id=p_user_id and active) or not public.rms_member_access(p_research_id,p_user_id) then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 if (select count(*) from public.rms_ai_runs where user_id=p_user_id and created_at>clock_timestamp()-interval '1 minute')>=6 then raise exception 'AI 사용 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.' using errcode='P0001'; end if;
 if exists(select 1 from public.rms_ai_runs where user_id=p_user_id and input_hash=p_input_hash and status='running' and created_at>clock_timestamp()-interval '100 seconds') then raise exception '같은 내용의 AI 처리가 진행 중입니다.' using errcode='55000'; end if;
 insert into public.rms_ai_runs(user_id,research_id,input_hash) values(p_user_id,p_research_id,left(p_input_hash,128)) returning id into v_id;
 return v_id;
end $$;

-- 기존 응답 필드(total·complete·failed·running·cancelled·limit·windowHours)는 그대로 두고 credits를 더합니다. 본인 것만 돌려줍니다.
create or replace function public.rms_ai_usage() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ declare who uuid:=public.rms_assert_session();v jsonb;begin
 select jsonb_build_object('total',count(*),'complete',count(*)filter(where status='complete'),'failed',count(*)filter(where status='failed'),'running',count(*)filter(where status='running'),'cancelled',count(*)filter(where status='cancelled'),'limit',100,'windowHours',24,'perMinuteLimit',6) into v from public.rms_ai_runs where user_id=who and created_at>now()-interval '24 hours';
 return v||jsonb_build_object('credits',public.rms_ai_credit_summary(who));end $$;

revoke all on function public.rms_ai_credit_allowance(),public.rms_ai_credit_period(timestamptz),public.rms_ai_credit_roll(uuid),public.rms_ai_credit_summary(uuid),
 public.rms_ai_credit_init(uuid),public.rms_ai_credit_grant(uuid,numeric,text,text),public.rms_ai_reserve_credits(uuid,uuid,numeric),public.rms_ai_settle_credits(uuid,numeric,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.rms_ai_credit_init(uuid),public.rms_ai_credit_grant(uuid,numeric,text,text),public.rms_ai_reserve_credits(uuid,uuid,numeric),public.rms_ai_settle_credits(uuid,numeric,jsonb,boolean) to service_role;

-- 서비스 전용: 사용량을 알 수 없어 예약이 남은 실행을 찾습니다(시간 초과·연결 끊김·사용량 누락).
-- 운영자는 제공사 청구 내역을 확인한 뒤 rms_ai_settle_credits(실행 번호, 금액, 사용량, false)로 확정하거나,
-- 제공사가 처리하지 않은 것이 확실할 때만 rms_ai_settle_credits(실행 번호, 0, '{}', true)로 반환합니다.
-- 추측한 토큰을 실제 사용량으로 적지 않습니다. 이 함수는 읽기만 합니다.
create function public.rms_ai_credit_unresolved(p_older interval default interval '15 minutes') returns table(run_id uuid,user_id uuid,reserved numeric,model text,run_status text,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public,auth
as $$ select h.run_id,h.user_id,h.reserved,r.model,r.status,h.created_at
 from public.rms_ai_credit_holds h left join public.rms_ai_runs r on r.id=h.run_id
 where h.status='reserved' and h.created_at<clock_timestamp()-p_older order by h.created_at $$;
revoke all on function public.rms_ai_credit_unresolved(interval) from public,anon,authenticated;
grant execute on function public.rms_ai_credit_unresolved(interval) to service_role;
