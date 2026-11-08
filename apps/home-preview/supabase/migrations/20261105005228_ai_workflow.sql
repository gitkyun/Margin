create table public.rms_ai_cancellations(id uuid primary key,user_id uuid not null references auth.users(id),created_at timestamptz default now());
alter table public.rms_ai_cancellations enable row level security;
revoke all on public.rms_ai_cancellations from public,anon,authenticated;
grant all on public.rms_ai_cancellations to service_role;
create or replace function public.rms_cancel_ai(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ begin perform public.rms_assert_session();if p_id is null then return;end if;insert into public.rms_ai_cancellations(id,user_id) values(p_id,auth.uid()) on conflict do nothing;update public.rms_ai_runs set status='cancelled',completed_at=clock_timestamp() where id=p_id and user_id=auth.uid() and status='running'; end $$;
create function public.rms_ai_begin_v2(p_user_id uuid,p_research_id uuid,p_input_hash text,p_id uuid,p_mode text,p_model text,p_thinking text) returns uuid language plpgsql security definer set search_path=pg_catalog,public,auth as $$ declare run uuid;begin
 if not public.rms_member_access(p_research_id,p_user_id) then raise exception '접근할 수 없습니다.' using errcode='42501';end if;
 if exists(select 1 from public.rms_ai_cancellations where id=p_id and user_id=p_user_id) then raise exception '중단한 요청입니다.' using errcode='57014';end if;
 if exists(select 1 from public.rms_ai_runs where id=p_id) then raise exception '이미 실행한 요청입니다.' using errcode='55000';end if;
 run:=public.rms_ai_begin(p_user_id,p_research_id,p_input_hash);
 update public.rms_ai_runs set id=p_id,mode=p_mode,model=p_model,thinking=p_thinking where id=run;
 return p_id;
end $$;
create function public.rms_ai_finish_v2(p_run_id uuid,p_status text,p_output jsonb default null,p_contexts jsonb default '[]',p_error text default null) returns boolean language plpgsql security definer set search_path=pg_catalog,public,auth as $$ declare r public.rms_ai_runs;c jsonb;cid uuid;begin
 select * into r from public.rms_ai_runs where id=p_run_id for update;
 if r.id is null or r.status<>'running' or exists(select 1 from public.rms_ai_cancellations where id=p_run_id and user_id=r.user_id) then return false;end if;
 if p_status not in ('complete','failed','cancelled') or octet_length(coalesce(p_output::text,''))>262144 then raise exception '결과 형식을 확인해 주세요.' using errcode='22023';end if;
 update public.rms_ai_runs set status=p_status,output=p_output,error=left(p_error,1000),completed_at=clock_timestamp() where id=p_run_id;
 if p_status='complete' then
  for c in select jsonb_array_elements(coalesce(p_output->'candidates','[]')) loop
   cid:=gen_random_uuid();insert into public.rms_records(id,research_id,kind,data) values(cid,r.research_id,'aiCandidates',jsonb_build_object('id',cid,'researchId',r.research_id,'runId',r.id,'title',c->>'title','candidate',c,'mode',r.mode,'contexts',p_contexts,'status','pending','createdBy',r.user_id,'updatedBy',r.user_id,'visibility','private','createdAt',clock_timestamp(),'updatedAt',clock_timestamp()));
  end loop;
 end if;
 return true;
end $$;
revoke all on function public.rms_ai_begin_v2(uuid,uuid,text,uuid,text,text,text),public.rms_ai_finish_v2(uuid,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.rms_ai_begin_v2(uuid,uuid,text,uuid,text,text,text),public.rms_ai_finish_v2(uuid,text,jsonb,jsonb,text) to service_role;
