-- ============================================================================
-- 마진 연구 도우미 AI 성능 및 품질 모니터링 쿼리 (docs/ai/monitoring-queries.sql)
-- 기준일: 2026-11-19
-- 대상 테이블: public.rms_ai_runs, public.rms_ai_credit_ledger, public.rms_ai_credit_holds
-- ============================================================================

-- 1. 작업(mode) 및 Thinking 단계별 실행 결과와 실패 유형 (최근 7일)
-- 실제 error 컬럼은 AIError.code가 아닌 한국어 메시지(error.message)가 저장됩니다:
-- - 출력 잘림(MAX_TOKENS): "답이 길어 끝까지 받지 못했어요..."
-- - 시간 초과(TIMEOUT): "AI 응답이 늦어 중단했습니다..."
-- - 사용 한도(RATE_LIMITED): "AI 사용 한도에 도달했습니다..."
-- - 크레딧 부족(CREDITS_EXHAUSTED): "남은 AI 크레딧이 부족합니다..."
-- - 사용자 취소(CANCELLED): status = 'cancelled' ("중단한 요청입니다." / "AI 실행을 중단했습니다.")
select
  mode,
  coalesce(thinking, 'default(high)') as thinking,
  status,
  count(*) as runs,
  count(*) filter (where error like '%답이 길어%') as truncated_runs,
  count(*) filter (where error like '%응답이 늦어%') as timeout_runs,
  count(*) filter (where status = 'cancelled' or error in ('중단한 요청입니다.', 'AI 실행을 중단했습니다.')) as cancelled_runs,
  count(*) filter (where error like '%한도에 도달%') as rate_limited_runs,
  count(*) filter (where error like '%크레딧이 부족%') as credit_exhausted_runs,
  round(avg(extract(epoch from (completed_at - created_at))) filter (where completed_at is not null), 2) as avg_duration_sec,
  round(max(extract(epoch from (completed_at - created_at))) filter (where completed_at is not null), 2) as max_duration_sec
from public.rms_ai_runs
where created_at > clock_timestamp() - interval '7 days'
group by mode, thinking, status
order by mode, thinking, status;


-- 2. 최적화 단계 전후 성능 및 성공률 비교
-- 커밋 기준 실제 도입 시점:
-- 1) 2026-11-16 22:08:14+09 이전: 기록 부분 읽기 (초기)
-- 2) 2026-11-16 22:08:14+09 ~ 2026-11-19 00:43:32+09: 기록 전체 읽기 도입 (PR #99, high 기본값)
-- 3) 2026-11-19 00:43:32+09 ~ 2026-11-19 02:00:00+09: 1~3차 최적화 (PR #146~#148, low 기본값 + DB 통합)
-- 4) 2026-11-19 02:00:00+09 이후: 4차 최적화 (PR #149, 작업별 생각 단계 보정 + depth 분리 + low 45초)
select
  case
    when created_at < '2026-11-16 22:08:14+09' then '1. 초기 상태 (부분 기록)'
    when created_at < '2026-11-19 00:43:32+09' then '2. 기록 전체 읽기 (high 기본값, 평균 60.7초)'
    when created_at < '2026-11-19 02:00:00+09' then '3. 1~3차 속도 최적화 (low 기본값, DB 왕복 통합)'
    else '4. 4차 최적화 (작업별 생각 보정, low 45초, depth 분리)'
  end as phase,
  count(*) as total_runs,
  count(*) filter (where status = 'complete') as success_runs,
  count(*) filter (where status = 'cancelled') as cancelled_runs,
  count(*) filter (where status = 'failed') as failed_runs,
  count(*) filter (where status = 'running') as unresolved_runs,
  round(count(*) filter (where status = 'complete') * 100.0 / nullif(count(*), 0), 1) as success_rate_pct,
  round(avg(extract(epoch from (completed_at - created_at))) filter (where status = 'complete'), 2) as avg_success_sec,
  round(max(extract(epoch from (completed_at - created_at))) filter (where status = 'complete'), 2) as max_success_sec
from public.rms_ai_runs
group by 1
order by 1;


-- 3. 토큰 사용량, 생각 토큰(reasoning) 비중 및 실제 차감 크레딧 분석
-- rms_ai_credit_ledger에서 kind = 'charge'의 amount는 음수(-amount)로 기록되므로 abs(amount)로 집계합니다.
-- usage JSON 안의 필드:
-- - input: 입력 프롬프트 토큰 수
-- - output: 생성된 토큰 총합 (답변 + 생각 토큰)
-- - reasoning: Gemini의 내부 생각(thinking) 토큰 수
-- - cached: Gemini 컨텍스트 캐시 적중 토큰 수
select
  r.mode,
  coalesce(r.thinking, 'default') as thinking,
  count(*) as charged_runs,
  round(avg((l.usage->>'input')::numeric), 0) as avg_prompt_tokens,
  round(avg((l.usage->>'output')::numeric), 0) as avg_output_tokens,
  round(avg((l.usage->>'reasoning')::numeric), 0) as avg_thoughts_tokens,
  round(avg(coalesce((l.usage->>'cached')::numeric, 0)), 0) as avg_cached_tokens,
  round(avg(abs(l.amount)), 3) as avg_credits_charged,
  round(sum(abs(l.amount)), 3) as total_credits_charged
from public.rms_ai_credit_ledger l
join public.rms_ai_runs r on l.run_id = r.id
where l.kind = 'charge'
  and l.created_at > clock_timestamp() - interval '7 days'
group by r.mode, r.thinking
order by r.mode, r.thinking;


-- 4. 미정산 또는 장기 실행(stale) 예약 확인
-- 시스템 내장 함수 rms_ai_credit_unresolved(interval)를 사용하여 1시간 이상 정산되지 않은 예약 조회 (service_role 전용)
select
  run_id,
  user_id,
  reserved,
  model,
  run_status,
  created_at
from public.rms_ai_credit_unresolved(interval '1 hour');

-- 제공사가 처리하지 않은 것이 확실한 경우(Google 429, 네트워크 끊김 등) 안전하게 환불 처리:
-- select public.rms_ai_settle_credits('RUN_UUID_HERE', 0, '{}'::jsonb, true);


-- 5. 재시도(attempts) 발생 및 출력 종료 원인(finishReason) 현황
-- 한 번의 요청에서 시간 초과로 재시도(attempt = 2)가 발생했거나, MAX_TOKENS로 끝난 내역 분석
select
  r.id,
  r.mode,
  r.thinking,
  r.status,
  (l.usage->>'attempts')::int as attempts,
  l.usage->>'finishReason' as finish_reason,
  round(extract(epoch from (r.completed_at - r.created_at)), 2) as duration_sec,
  abs(l.amount) as credits_charged,
  r.created_at
from public.rms_ai_credit_ledger l
join public.rms_ai_runs r on l.run_id = r.id
where (l.usage->>'attempts')::int > 1
   or l.usage->>'finishReason' = 'MAX_TOKENS'
order by r.created_at desc
limit 50;
