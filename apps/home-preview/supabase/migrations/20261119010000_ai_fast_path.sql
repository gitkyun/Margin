-- 연구 도우미 응답 속도 작업 5-2·5-4(2026-11-19): 실행 앞뒤의 DB 왕복을 줄입니다.
-- 측정(2026-11-19, 싱가포르 리전): 실행 시작+예약 0.15초, 정산+청구액 읽기 0.12초, 마무리 0.08초.
-- 기존 함수(rms_ai_begin_v2·rms_ai_reserve_credits·rms_ai_settle_credits·rms_ai_finish_v2)를 그대로 부르는
-- 묶음 함수만 더합니다. 기존 함수와 규칙(한도·취소·잔액·한 번만 정산)은 바꾸지 않습니다. 서비스 전용.

-- 실행 시작과 크레딧 예약을 한 번에. 시작 단계의 오류(접근·한도·취소·중복)는 그대로 올리고,
-- 예약 단계의 오류는 실행 기록을 남긴 채 코드와 문구로 돌려줍니다(예전처럼 실패한 실행으로 남김).
create function public.rms_ai_start(p_user_id uuid,p_research_id uuid,p_input_hash text,p_id uuid,p_mode text,p_model text,p_thinking text,p_amount numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
declare v_run uuid; v_held boolean;
begin
 v_run := public.rms_ai_begin_v2(p_user_id,p_research_id,p_input_hash,p_id,p_mode,p_model,p_thinking);
 begin
  v_held := public.rms_ai_reserve_credits(v_run,p_user_id,p_amount);
 exception when others then
  return jsonb_build_object('run_id',v_run,'held',false,'error_code',sqlstate,'error_message',sqlerrm);
 end;
 return jsonb_build_object('run_id',v_run,'held',coalesce(v_held,false));
end $$;

-- 실제 사용량 정산 + 실제 청구액 + 결과 저장을 한 번에. 정산이 실패해도 결과 저장은 계속하고
-- (예약은 그대로 남아 운영이 확인) settle_error로 알려 줍니다. 취소된 실행이면 accepted=false,
-- 결과 저장이 실패하면 finish_error(실행은 running으로 남아 함수가 실패로 닫음).
create function public.rms_ai_complete(p_run_id uuid,p_amount numeric,p_usage jsonb,p_output jsonb,p_contexts jsonb default '[]')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth
as $$
declare v_closed boolean; v_error text; v_charged numeric; v_accepted boolean; v_finish_error text;
begin
 begin
  v_closed := public.rms_ai_settle_credits(p_run_id,p_amount,p_usage,false);
 exception when others then
  v_error := sqlstate;
 end;
 if v_closed then
  select abs(amount) into v_charged from public.rms_ai_credit_ledger
   where run_id=p_run_id and kind='charge' order by created_at desc limit 1;
 end if;
 -- 결과 저장이 실패해도(형식 오류 등) 위의 정산은 되돌리지 않습니다.
 begin
  v_accepted := public.rms_ai_finish_v2(p_run_id,'complete',p_output,coalesce(p_contexts,'[]'::jsonb),null);
 exception when others then
  v_finish_error := sqlstate;
 end;
 return jsonb_strip_nulls(jsonb_build_object(
  'settled', v_error is null,
  'closed', coalesce(v_closed,false),
  'charged', v_charged,
  'accepted', coalesce(v_accepted,false),
  'settle_error', v_error,
  'finish_error', v_finish_error));
end $$;

revoke all on function public.rms_ai_start(uuid,uuid,text,uuid,text,text,text,numeric),
 public.rms_ai_complete(uuid,numeric,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.rms_ai_start(uuid,uuid,text,uuid,text,text,text,numeric),
 public.rms_ai_complete(uuid,numeric,jsonb,jsonb,jsonb) to service_role;
