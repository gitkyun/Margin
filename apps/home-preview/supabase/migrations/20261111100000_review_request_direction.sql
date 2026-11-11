-- 검토 요청에 연구 이름과 연구 방향(목적·질문)을 함께 싣습니다.
-- gitkyun이 2026-11-11에 정했습니다: 지도교수가 검토할 때 연구 맥락을 볼 수 있어야 합니다.
-- 이 함수는 rms_can_read_request를 통과한 요청에만 쓰이는 security definer RPC
-- (rms_bootstrap·rms_create_review·rms_set_sharing) 안에서만 부릅니다.
-- 브라우저 역할의 직접 실행 권한은 첫 마이그레이션에서 회수된 그대로 둡니다.
-- purpose·questions는 rms_save_research가 형식을 검사하지 않으므로 여기서 거릅니다:
-- 목적은 문자열만 1,000자까지, 질문은 비어 있지 않은 문자열만 앞에서 5개, 각 500자까지.
create or replace function public.rms_request_json(p_row public.rms_review_requests)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
 select jsonb_build_object(
  'id',p_row.id,'researchId',p_row.research_id,'title',p_row.title,
  'professorEmail',p_row.professor_email,'professorId',p_row.professor_id,
  'status',p_row.status,'createdAt',p_row.created_at,'updatedAt',p_row.updated_at)
 || coalesce((
  select jsonb_strip_nulls(jsonb_build_object(
   'researchName',nullif(btrim(r.data->>'name'),''),
   'researchPurpose',case when jsonb_typeof(r.data->'purpose')='string'
     then nullif(left(btrim(r.data->>'purpose'),1000),'') end,
   'researchQuestions',(
     select jsonb_agg(q.body order by q.n)
     from (
      select left(btrim(e.value#>>'{}'),500) body, e.n
      from jsonb_array_elements(case when jsonb_typeof(r.data->'questions')='array'
        then r.data->'questions' else '[]'::jsonb end) with ordinality e(value,n)
      where jsonb_typeof(e.value)='string' and btrim(e.value#>>'{}')<>''
      order by e.n limit 5
     ) q)))
  from public.rms_researches r where r.id=p_row.research_id),'{}'::jsonb)
$$;
