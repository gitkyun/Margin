-- 연구 도우미 응답 속도 작업 6-1(2026-11-19): 화면을 떠났다 돌아와도 같은 실행 번호로 결과를 다시 읽습니다.
-- 내 실행만 읽습니다. 결과(output)는 서버가 검증을 거쳐 rms_ai_finish_v2로 저장한 값이고,
-- 크레딧은 정산 내역(ledger)에 실제로 차감된 값만 돌려줍니다. 기존 표·함수는 바꾸지 않습니다.
create function public.rms_ai_run_result(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth
as $$
declare who uuid := public.rms_assert_session(); r public.rms_ai_runs; v_charged numeric;
begin
 if p_id is null then return null; end if;
 select * into r from public.rms_ai_runs where id = p_id and user_id = who;
 if r.id is null then return null; end if;
 select abs(amount) into v_charged from public.rms_ai_credit_ledger
  where run_id = p_id and kind = 'charge' order by created_at desc limit 1;
 return jsonb_strip_nulls(jsonb_build_object(
  'id', r.id,
  'status', r.status,
  'mode', r.mode,
  'model', r.model,
  'output', case when r.status = 'complete' then r.output end,
  'error', r.error,
  'creditsUsed', v_charged,
  'createdAt', r.created_at,
  'completedAt', r.completed_at));
end $$;
revoke all on function public.rms_ai_run_result(uuid) from public, anon;
grant execute on function public.rms_ai_run_result(uuid) to authenticated;
