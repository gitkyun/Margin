-- ============================================================================
-- 마진 연구 도우미 AI 성능 및 품질 모니터링 쿼리 (docs/ai/monitoring-queries.sql)
-- 기준일: 2026-11-19
-- 용도: 운영 환경(Supabase SQL Editor)에서 응답 속도, 실패율, 토큰 사용량 점검
-- ============================================================================

-- 1. 작업·Thinking 단계별 실행 분포 및 실패 유형 (최근 7일)
-- 목표: MAX_TOKENS(출력 잘림) 0건 유지 여부 및 작업별 평균 응답 속도 확인
select
  mode,
  thinking,
  status,
  count(*) as runs,
  count(*) filter (where error like '%OUTPUT_TRUNCATED%') as truncated,
  count(*) filter (where error like '%TIMEOUT%') as timeout,
  count(*) filter (where error like '%CANCELLED%') as cancelled,
  round(avg(extract(epoch from (completed_at - created_at))), 1) as avg_duration_sec,
  round(max(extract(epoch from (completed_at - created_at))), 1) as max_duration_sec
from rms_ai_runs
where created_at > now() - interval '7 days'
group by mode, thinking, status
order by mode, thinking, status;


-- 2. 최적화 단계 전후 성능 비교 (2026-11-19 최적화 패치 기준)
-- 1차~3차 최적화: thinking low 기본값, DB 왕복 통합, 리전 정합
select
  case
    when created_at < '2026-11-16' then '1. 초기 상태 (부분 기록)'
    when created_at < '2026-11-19' then '2. 기록 전체 읽기 도입 (high 기본값)'
    else '3. 응답 속도 최적화 적용 (low 기본값 + 작업별 보정)'
  end as phase,
  count(*) as total_runs,
  count(*) filter (where status = 'complete') as success_runs,
  round(count(*) filter (where status = 'complete') * 100.0 / nullif(count(*), 0), 1) as success_rate_pct,
  round(avg(extract(epoch from (completed_at - created_at))) filter (where status = 'complete'), 1) as avg_success_sec,
  round(max(extract(epoch from (completed_at - created_at))) filter (where status = 'complete'), 1) as max_success_sec
from rms_ai_runs
group by 1
order by 1;


-- 3. 토큰 사용량 및 생각 토큰(reasoning) 비중 분석
-- 정산 내역(ledger)에 기록된 usage JSON을 통한 토큰 세부 지표
select
  r.mode,
  r.thinking,
  count(*) as runs,
  round(avg((l.usage->>'input')::numeric)) as avg_prompt_tokens,
  round(avg((l.usage->>'output')::numeric)) as avg_output_tokens,
  round(avg((l.usage->>'reasoning')::numeric)) as avg_thoughts_tokens,
  round(avg((l.usage->>'cached')::numeric)) as avg_cached_tokens,
  round(avg(l.amount), 3) as avg_credits_charged
from rms_ai_credit_ledger l
join rms_ai_runs r on l.run_id = r.id
where l.kind = 'charge'
  and l.created_at > now() - interval '7 days'
group by r.mode, r.thinking
order by r.mode, r.thinking;


-- 4. 미정산 또는 장기 실행(stale) 예약 확인
-- 24시간 이상 running 상태이거나 settle되지 않은 예약 점검 (시스템 내장 RPC 활용)
select * from public.rms_ai_credit_unresolved(interval '1 hour');

-- 위 결과를 바탕으로 제공사 미청구 확인 후 환불 처리할 때(service_role 전용):
-- select public.rms_ai_settle_credits('RUN_UUID_HERE', 0, '{}'::jsonb, true);


-- 5. 중복 실행 및 재시도(attempts) 발생 현황
-- 한 요청에서 재시도가 발생했거나 꼬리 지연을 겪은 사례 추출
select
  r.id,
  r.mode,
  r.thinking,
  (l.usage->>'attempts')::int as attempts,
  l.usage->>'finishReason' as finish_reason,
  round(extract(epoch from (r.completed_at - r.created_at)), 1) as duration_sec,
  r.created_at
from rms_ai_credit_ledger l
join rms_ai_runs r on l.run_id = r.id
where (l.usage->>'attempts')::int > 1
order by r.created_at desc
limit 30;
