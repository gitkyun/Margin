-- Explicit owner-confirmed deletion. Storage cleanup is retryable after metadata deletion.
create table public.rms_deletion_jobs (
 research_id uuid primary key,
 owner_id uuid not null references auth.users(id),
 name text not null,
 files jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.rms_deletion_jobs enable row level security;
revoke all on public.rms_deletion_jobs from public,anon,authenticated;
grant select,update on public.rms_deletion_jobs to service_role;

create function public.rms_pending_deletions() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
begin
 perform public.rms_assert_session();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',research_id,'name',name) order by created_at),'[]'::jsonb)
 from public.rms_deletion_jobs where owner_id=auth.uid() and completed_at is null);
end $$;

create function public.rms_purge_research(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,storage as $$
declare
 v_uid uuid:=public.rms_assert_session();
 v_id uuid:=(p_input->>'researchId')::uuid;
 v_research public.rms_researches;
 v_job public.rms_deletion_jobs;
 v_ids uuid[]; v_rounds uuid[]; v_requests uuid[]; v_runs uuid[];
 v_files jsonb; v_count integer;
begin
 if v_id is null then raise exception '연구를 선택해 주세요.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text||':purge',0));
 select * into v_job from public.rms_deletion_jobs where research_id=v_id;
 if found then
  if v_job.owner_id<>v_uid then raise exception '소유자만 삭제할 수 있습니다.' using errcode='42501'; end if;
  if p_input->>'confirmationName' is distinct from v_job.name then raise exception '연구 이름을 정확히 입력해 주세요.' using errcode='22023'; end if;
  return jsonb_build_object('id',v_id,'files',case when v_job.completed_at is null then v_job.files else '[]'::jsonb end);
 end if;
 select * into v_research from public.rms_researches where id=v_id for update;
 if not found or v_research.owner_id<>v_uid then raise exception '소유자만 삭제할 수 있습니다.' using errcode='42501'; end if;
 if nullif(v_research.data->>'deletedAt','') is null then raise exception '휴지통의 연구만 완전히 삭제할 수 있습니다.' using errcode='22023'; end if;
 if p_input->>'confirmationName' is distinct from v_research.data->>'name' then raise exception '연구 이름을 정확히 입력해 주세요.' using errcode='22023'; end if;
 select coalesce(array_agg(id),'{}') into v_ids from public.rms_records where research_id=v_id;
 select coalesce(array_agg(id),'{}') into v_requests from public.rms_review_requests where research_id=v_id;
 select coalesce(array_agg(id),'{}') into v_rounds from public.rms_review_rounds where request_id=any(v_requests);
 select coalesce(array_agg(id),'{}') into v_runs from public.rms_ai_runs where research_id=v_id;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') into v_files
 from storage.objects where bucket_id in ('research-files','research-private') and split_part(name,'/',2)=v_id::text;
 insert into public.rms_deletion_jobs(research_id,owner_id,name,files) values(v_id,v_uid,v_research.data->>'name',v_files);
 delete from public.rms_live_transcripts where research_id=v_id;
 delete from public.rms_response_history where round_id=any(v_rounds);
 delete from public.rms_review_reads where round_id=any(v_rounds);
 delete from public.rms_review_responses where round_id=any(v_rounds);
 -- Replies use RESTRICT; remove leaves before their parents in the same transaction.
 loop
  delete from public.rms_review_comments c where c.round_id=any(v_rounds)
   and not exists(select 1 from public.rms_review_comments child where child.parent_id=c.id);
  get diagnostics v_count=row_count;
  exit when v_count=0;
 end loop;
 delete from public.rms_review_rounds where id=any(v_rounds);
 delete from public.rms_review_items where request_id=any(v_requests);
 delete from public.rms_review_requests where id=any(v_requests);
 delete from public.rms_poll_participants where poll_id in(select id from public.rms_polls where research_id=v_id);
 delete from public.rms_polls where research_id=v_id;
 delete from public.rms_events where research_id=v_id;
 delete from public.rms_members where research_id=v_id;
 delete from public.rms_ai_cancellations where id=any(v_runs);
 delete from public.rms_ai_runs where research_id=v_id;
 -- Idempotency receipts can contain snapshots of removed records.
 delete from public.rms_mutation_receipts m where exists(
  select 1 from unnest(v_ids||v_requests||v_rounds||v_runs||array[v_id]) i where strpos(m.response::text,i::text)>0);
 delete from public.rms_records where research_id=v_id;
 delete from public.rms_researches where id=v_id;
 return jsonb_build_object('id',v_id,'files',v_files);
end $$;
revoke all on function public.rms_pending_deletions(),public.rms_purge_research(jsonb) from public,anon;
grant execute on function public.rms_pending_deletions(),public.rms_purge_research(jsonb) to authenticated;
