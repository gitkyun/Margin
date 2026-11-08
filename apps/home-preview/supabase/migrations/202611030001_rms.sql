-- RMS classroom: private records, immutable review snapshots, validated RPC writes.
create table public.rms_demo_accounts(user_id uuid primary key references auth.users(id) on delete cascade,active boolean not null default true,created_at timestamptz not null default now());

create table public.rms_researches(id uuid primary key,owner_id uuid not null references auth.users(id),data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create table public.rms_records(id uuid primary key,research_id uuid not null references public.rms_researches(id) on delete restrict,kind text not null check(kind in ('meetings','feedback','plans','tasks','questions','decisions','materials','versions','results')),data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create index rms_records_research_kind on public.rms_records(research_id,kind);

create unique index rms_material_version_number on public.rms_records((data->>'materialId'),((data->>'number')::integer)) where kind='versions';

create table public.rms_review_requests(id uuid primary key default gen_random_uuid(),research_id uuid not null references public.rms_researches(id) on delete restrict,owner_id uuid not null references auth.users(id),professor_id uuid not null references auth.users(id),professor_email text not null,title text not null,status text not null check(status in ('draft','shared','stopped')) default 'shared',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(owner_id<>professor_id));

create index rms_review_professor on public.rms_review_requests(professor_id,status);

create index rms_review_owner on public.rms_review_requests(owner_id);

create table public.rms_review_items(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.rms_review_requests(id) on delete restrict,result_id uuid not null references public.rms_records(id) on delete restrict,title text not null,unique(request_id,result_id));

create table public.rms_review_rounds(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.rms_review_requests(id) on delete restrict,item_id uuid not null references public.rms_review_items(id) on delete restrict,number integer not null check(number>0),snapshot jsonb not null,created_at timestamptz not null default now(),unique(item_id,number));

create index rms_round_request on public.rms_review_rounds(request_id);

create table public.rms_review_responses(id uuid primary key default gen_random_uuid(),round_id uuid not null unique references public.rms_review_rounds(id) on delete restrict,user_id uuid not null references auth.users(id),result text not null check(result in ('confirmed','changes_requested')),comment text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(result<>'changes_requested' or length(btrim(comment))>0));

create table public.rms_response_history(id uuid primary key default gen_random_uuid(),response_id uuid not null references public.rms_review_responses(id) on delete restrict,round_id uuid not null references public.rms_review_rounds(id) on delete restrict,data jsonb not null,replaced_at timestamptz not null default now());

create table public.rms_review_comments(id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rms_review_rounds(id) on delete restrict,user_id uuid not null references auth.users(id),author_name text not null,body text not null check(length(btrim(body)) between 1 and 10000),parent_id uuid references public.rms_review_comments(id) on delete restrict,resolved boolean not null default false,created_at timestamptz not null default now());

create index rms_comments_round on public.rms_review_comments(round_id,created_at);

create table public.rms_review_reads(round_id uuid not null references public.rms_review_rounds(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,last_seen_at timestamptz not null default now(),primary key(round_id,user_id));

create table public.rms_ai_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),research_id uuid not null references public.rms_researches(id),input_hash text not null,status text not null check(status in ('running','complete','failed')) default 'running',created_at timestamptz not null default now(),completed_at timestamptz);

create index rms_ai_rate_window on public.rms_ai_runs(user_id,created_at);

create table public.rms_mutation_receipts(user_id uuid not null references auth.users(id),request_key uuid not null,operation text not null,payload_hash text not null,response jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_key));

alter table public.rms_mutation_receipts enable row level security;

revoke all on public.rms_mutation_receipts from public,anon,authenticated;

grant all on public.rms_mutation_receipts to service_role;

-- Helpers intentionally have a fixed search_path and no dynamic SQL.
create function public.rms_is_allowed() returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select auth.uid() is not null and exists(select 1 from public.rms_demo_accounts where user_id=auth.uid() and active) $$;

create function public.rms_assert_session() returns uuid language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ begin if not public.rms_is_allowed() then raise exception '허용된 시연 계정으로 로그인해 주세요.' using errcode='42501'; end if; return auth.uid(); end $$;

create function public.rms_owns_research(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_is_allowed() and exists(select 1 from public.rms_researches where id=p_id and owner_id=auth.uid()) $$;

create function public.rms_can_read_request(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_is_allowed() and exists(select 1 from public.rms_review_requests where id=p_id and (owner_id=auth.uid() or (professor_id=auth.uid() and status='shared'))) $$;

create function public.rms_can_read_round(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select exists(select 1 from public.rms_review_rounds where id=p_id and public.rms_can_read_request(request_id)) $$;

create function public.rms_can_read_file(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_is_allowed() and ((split_part(p_path,'/',1)=auth.uid()::text and public.rms_owns_research(case when split_part(p_path,'/',2) ~ '^[0-9a-f-]{36}$' then split_part(p_path,'/',2)::uuid else null end)) or exists(select 1 from public.rms_review_rounds rr join public.rms_review_requests r on r.id=rr.request_id where rr.snapshot->>'storagePath'=p_path and r.status='shared' and r.professor_id=auth.uid())) $$;

alter table public.rms_demo_accounts enable row level security;

alter table public.rms_researches enable row level security;

alter table public.rms_records enable row level security;

alter table public.rms_review_requests enable row level security;

alter table public.rms_review_items enable row level security;

alter table public.rms_review_rounds enable row level security;

alter table public.rms_review_responses enable row level security;

alter table public.rms_response_history enable row level security;

alter table public.rms_review_comments enable row level security;

alter table public.rms_review_reads enable row level security;

alter table public.rms_ai_runs enable row level security;

create policy researches_owner_read on public.rms_researches for select to authenticated using(public.rms_owns_research(id));

create policy records_owner_read on public.rms_records for select to authenticated using(public.rms_owns_research(research_id));

create policy requests_allowed_read on public.rms_review_requests for select to authenticated using(public.rms_can_read_request(id));

create policy items_allowed_read on public.rms_review_items for select to authenticated using(public.rms_can_read_request(request_id));

create policy rounds_allowed_read on public.rms_review_rounds for select to authenticated using(public.rms_can_read_request(request_id));

create policy responses_allowed_read on public.rms_review_responses for select to authenticated using(public.rms_can_read_round(round_id));

create policy response_history_allowed_read on public.rms_response_history for select to authenticated using(public.rms_can_read_round(round_id));

create policy comments_allowed_read on public.rms_review_comments for select to authenticated using(public.rms_can_read_round(round_id));

create policy reads_own_read on public.rms_review_reads for select to authenticated using(public.rms_is_allowed() and user_id=auth.uid() and public.rms_can_read_round(round_id));

revoke all on public.rms_demo_accounts,public.rms_researches,public.rms_records,public.rms_review_requests,public.rms_review_items,public.rms_review_rounds,public.rms_review_responses,public.rms_response_history,public.rms_review_comments,public.rms_review_reads,public.rms_ai_runs from anon,authenticated;

grant select on public.rms_researches,public.rms_records,public.rms_review_requests,public.rms_review_items,public.rms_review_rounds,public.rms_review_responses,public.rms_response_history,public.rms_review_comments,public.rms_review_reads to authenticated;

create function public.rms_required_text(p_value jsonb,p_key text,p_limit integer default 10000) returns text language plpgsql immutable as $$ declare v text; begin if jsonb_typeof(p_value->p_key) is distinct from 'string' then raise exception '% 입력을 확인해 주세요.',p_key using errcode='22023'; end if; v:=btrim(p_value->>p_key); if length(v)=0 or length(v)>p_limit then raise exception '% 입력 길이를 확인해 주세요.',p_key using errcode='22023'; end if; return v; end $$;

create function public.rms_optional_text(p_value jsonb,p_key text,p_limit integer default 10000) returns text language plpgsql immutable as $$ begin if p_value->p_key is null or p_value->p_key='null'::jsonb then return ''; end if; if jsonb_typeof(p_value->p_key)<>'string' or length(p_value->>p_key)>p_limit then raise exception '% 입력을 확인해 주세요.',p_key using errcode='22023'; end if; return p_value->>p_key; end $$;

create function public.rms_require_record(p_id uuid,p_research_id uuid,p_kind text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ declare v jsonb; begin select data into v from public.rms_records where id=p_id and research_id=p_research_id and kind=p_kind; if v is null then raise exception '연결할 기록을 찾을 수 없습니다.' using errcode='22023'; end if; return v; end $$;

create function public.rms_validate_refs(p_value jsonb,p_key text,p_research_id uuid,p_kind text) returns void language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ declare v text; begin if jsonb_typeof(p_value->p_key) is distinct from 'array' or jsonb_array_length(p_value->p_key)>100 then raise exception '연결 기록 목록을 확인해 주세요.' using errcode='22023'; end if; for v in select jsonb_array_elements_text(p_value->p_key) loop perform public.rms_require_record(v::uuid,p_research_id,p_kind); end loop; end $$;

create function public.rms_utf16_length(p_text text) returns integer language sql immutable as $$ select coalesce(sum(case when ascii(c)>65535 then 2 else 1 end),0)::integer from regexp_split_to_table(p_text,'') c $$;

create function public.rms_professor_id(p_email text) returns uuid language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ declare v uuid; begin select u.id into v from auth.users u join public.rms_demo_accounts a on a.user_id=u.id and a.active where lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null; if v is null then raise exception '등록된 교수 시연 계정의 이메일을 입력해 주세요.' using errcode='22023'; end if; if v=auth.uid() then raise exception '본인 계정을 검토 대상으로 지정할 수 없습니다.' using errcode='22023'; end if; return v; end $$;

create function public.rms_save_research(p_value jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_uid uuid:=public.rms_assert_session(); v_id uuid; v_old public.rms_researches; v jsonb; v_stamp timestamptz:=clock_timestamp();
begin
 v_id:=(p_value->>'id')::uuid; if v_id is null then raise exception '연구 식별자가 필요합니다.' using errcode='22023'; end if;
 perform public.rms_required_text(p_value,'name',120); perform public.rms_optional_text(p_value,'description',3000);
 select * into v_old from public.rms_researches where id=v_id for update;
 if found then if v_old.owner_id<>v_uid then raise exception '이 연구를 변경할 수 없습니다.' using errcode='42501'; end if; if (p_value-'createdAt'-'updatedAt'-'ownerId')=(v_old.data-'createdAt'-'updatedAt'-'ownerId') then return v_old.data; end if; if p_value->>'updatedAt' is distinct from v_old.data->>'updatedAt' then raise exception '다른 창에서 연구가 변경되었습니다. 새로 불러온 뒤 다시 저장해 주세요.' using errcode='40001'; end if; end if;
 if nullif(p_value->>'nextMeetingId','') is not null then perform public.rms_require_record((p_value->>'nextMeetingId')::uuid,v_id,'meetings'); end if;
 v:=(p_value-'ownerId'-'createdAt'-'updatedAt')||jsonb_build_object('id',v_id,'ownerId',v_uid,'createdAt',coalesce(v_old.created_at,v_stamp),'updatedAt',v_stamp);
 insert into public.rms_researches(id,owner_id,data,created_at,updated_at) values(v_id,v_uid,v,coalesce(v_old.created_at,v_stamp),v_stamp) on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
 return v;
end $$;

create function public.rms_save_record(p_kind text,p_value jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,storage as $$
declare v_uid uuid:=public.rms_assert_session(); v_id uuid; v_research uuid; v_old public.rms_records; v jsonb; v_link jsonb; v_memo jsonb; v_quote text; v_stamp timestamptz:=clock_timestamp(); v_path text; v_position integer;
begin
 if p_kind not in ('meetings','feedback','plans','tasks','questions','decisions','materials','versions','results') then raise exception '기록 유형을 확인해 주세요.' using errcode='22023'; end if;
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception '기록 입력을 확인해 주세요.' using errcode='22023'; end if;
 v_id:=(p_value->>'id')::uuid; v_research:=(p_value->>'researchId')::uuid;
 if v_id is null or not public.rms_owns_research(v_research) then raise exception '이 기록을 변경할 수 없습니다.' using errcode='42501'; end if;
 select * into v_old from public.rms_records where id=v_id for update;
 if found then
  if v_old.research_id<>v_research or v_old.kind<>p_kind then raise exception '다른 연구의 기록으로 바꿀 수 없습니다.' using errcode='42501'; end if;
  if p_kind='versions' then
   if (p_value-'createdAt'-'updatedAt')=(v_old.data-'createdAt'-'updatedAt') then return v_old.data; end if;
   raise exception '보존 파일은 덮어쓸 수 없습니다. 새 버전을 추가해 주세요.' using errcode='22023';
  end if;
  if (p_value-'createdAt'-'updatedAt'-'memoRevision'-'sourceStart'-'sourceEnd')=(v_old.data-'createdAt'-'updatedAt'-'memoRevision'-'sourceStart'-'sourceEnd') then return v_old.data; end if;
  if p_value->>'updatedAt' is distinct from v_old.data->>'updatedAt' then raise exception '다른 창에서 기록이 변경되었습니다. 작성 내용을 유지하고 새로 불러와 주세요.' using errcode='40001'; end if;
 end if;
 v:=p_value-'createdAt'-'updatedAt';
 case p_kind
 when 'meetings' then
  perform public.rms_required_text(v,'title',200); perform public.rms_optional_text(v,'memo',50000); perform public.rms_optional_text(v,'goal',5000);
  if v->>'status' not in ('preparing','recording','recorded','cancelled') or v->>'status' is null then raise exception '미팅 상태를 확인해 주세요.' using errcode='22023'; end if;
  if nullif(v->>'date','') is not null then if v->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '미팅 날짜를 확인해 주세요.' using errcode='22023'; end if; perform (v->>'date')::date; end if;
  if nullif(v->>'time','') is not null and (nullif(v->>'date','') is null or v->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception '미팅 시각을 확인해 주세요.' using errcode='22023'; end if;
  perform public.rms_validate_refs(v,'taskIds',v_research,'tasks'); perform public.rms_validate_refs(v,'versionIds',v_research,'versions'); perform public.rms_validate_refs(v,'questionIds',v_research,'questions');
  v:=v||jsonb_build_object('memoRevision',case when v_old.id is null then 1 when coalesce(v_old.data->>'memo','') is distinct from coalesce(v->>'memo','') then coalesce((v_old.data->>'memoRevision')::integer,1)+1 else coalesce((v_old.data->>'memoRevision')::integer,1) end);
 when 'feedback' then
  perform public.rms_required_text(v,'title',200); perform public.rms_required_text(v,'body',20000); perform public.rms_optional_text(v,'notes',20000);
  if v->>'status' not in ('unprocessed','in_progress','recorded','held','unchanged') or v->>'status' is null then raise exception '피드백 처리 상태를 확인해 주세요.' using errcode='22023'; end if;
  if nullif(v->>'meetingId','') is not null then v_memo:=public.rms_require_record((v->>'meetingId')::uuid,v_research,'meetings'); end if;
  v_quote:=public.rms_optional_text(v,'sourceQuote',20000);
  if v_old.id is not null and nullif(v_old.data->>'sourceQuote','') is not null then
   v:=v-'sourceQuote'-'sourceStart'-'sourceEnd'-'sourceMemoRevision'-'meetingId';
   v:=v||jsonb_build_object('sourceQuote',v_old.data->'sourceQuote','sourceStart',v_old.data->'sourceStart','sourceEnd',v_old.data->'sourceEnd','sourceMemoRevision',v_old.data->'sourceMemoRevision','meetingId',v_old.data->'meetingId');
  elsif v_quote<>'' then
   if v_memo is null or strpos(v_memo->>'memo',v_quote)=0 or (v->>'sourceMemoRevision')::integer is distinct from (v_memo->>'memoRevision')::integer then raise exception '원문이 변경되었거나 발췌를 찾을 수 없습니다. 원문을 다시 선택해 주세요.' using errcode='40001'; end if;
   v_position:=public.rms_utf16_length(substr(v_memo->>'memo',1,strpos(v_memo->>'memo',v_quote)-1));
   v:=v||jsonb_build_object('sourceStart',v_position,'sourceEnd',v_position+public.rms_utf16_length(v_quote));
  end if;
 when 'plans' then
  v_link:=public.rms_require_record((v->>'feedbackId')::uuid,v_research,'feedback');
  perform public.rms_required_text(v,'title',200); perform public.rms_required_text(v,'method',20000); perform public.rms_optional_text(v,'expectedResult',10000); perform public.rms_optional_text(v,'assumptions',10000); perform public.rms_optional_text(v,'requiredMaterials',10000);
  if v->>'status' not in ('suggested','saved','cancelled') or v->>'status' is null or jsonb_typeof(v->'suggestedTasks') is distinct from 'array' then raise exception '수정 방안 입력을 확인해 주세요.' using errcode='22023'; end if;
  v_quote:=public.rms_optional_text(v,'sourceQuote',20000); if v_quote<>'' and strpos(coalesce(v_link->>'body',''),v_quote)=0 and strpos(coalesce(v_link->>'sourceQuote',''),v_quote)=0 then raise exception '방안의 원문 발췌를 확인해 주세요.' using errcode='22023'; end if;
 when 'tasks' then
  perform public.rms_required_text(v,'title',300); perform public.rms_optional_text(v,'description',20000);
  if v->>'status' not in ('todo','doing','done') or v->>'status' is null or v->>'priority' not in ('high','normal','low') or v->>'priority' is null then raise exception '작업 상태·우선순위를 확인해 주세요.' using errcode='22023'; end if;
  if nullif(v->>'dueDate','') is not null then if v->>'dueDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '작업 기한을 확인해 주세요.' using errcode='22023'; end if; perform (v->>'dueDate')::date; end if;
  perform public.rms_validate_refs(v,'feedbackIds',v_research,'feedback'); if nullif(v->>'planId','') is not null then perform public.rms_require_record((v->>'planId')::uuid,v_research,'plans'); end if;
 when 'questions' then
  perform public.rms_required_text(v,'text',10000); if v->>'status' not in ('open','resolved') or v->>'status' is null then raise exception '질문 상태를 확인해 주세요.' using errcode='22023'; end if;
  if nullif(v->>'meetingId','') is not null then perform public.rms_require_record((v->>'meetingId')::uuid,v_research,'meetings'); end if;
 when 'decisions' then perform public.rms_required_text(v,'text',10000); perform public.rms_require_record((v->>'meetingId')::uuid,v_research,'meetings');
 when 'materials' then
  perform public.rms_required_text(v,'title',300); if v->>'type' not in ('draft','reference','analysis','other') or v->>'type' is null then raise exception '자료 유형을 확인해 주세요.' using errcode='22023'; end if;
  if nullif(v->>'externalUrl','') is not null and (length(v->>'externalUrl')>3000 or v->>'externalUrl' !~* '^https?://[^[:space:]]+$') then raise exception 'http 또는 https 외부 주소를 입력해 주세요.' using errcode='22023'; end if;
 when 'versions' then
  perform public.rms_require_record((v->>'materialId')::uuid,v_research,'materials'); perform public.rms_required_text(v,'fileName',300);
  if v->>'mimeType' is distinct from 'application/pdf' or lower(v->>'fileName') !~ '\.pdf$' or (v->>'number')::integer is null or (v->>'number')::integer<1 or (v->>'size')::bigint is null or (v->>'size')::bigint not between 1 and 20971520 then raise exception '20MB 이하의 PDF 파일을 등록해 주세요.' using errcode='22023'; end if;
  v_path:=v_uid::text||'/'||v_research::text||'/'||v_id::text||'.pdf'; if v->>'storagePath' is distinct from v_path then raise exception '파일 경로를 확인해 주세요.' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='research-files' and o.name=v_path and (o.metadata->>'size')::bigint=(v->>'size')::bigint and o.metadata->>'mimetype'='application/pdf') then raise exception '파일 업로드를 완료한 뒤 연결해 주세요.' using errcode='22023'; end if;
 when 'results' then
  perform public.rms_required_text(v,'title',300); perform public.rms_required_text(v,'description',20000); perform public.rms_optional_text(v,'location',1000);
  if v->>'kind' not in ('document','other') or v->>'kind' is null then raise exception '수정 결과 유형을 확인해 주세요.' using errcode='22023'; end if;
  perform public.rms_validate_refs(v,'feedbackIds',v_research,'feedback'); perform public.rms_validate_refs(v,'taskIds',v_research,'tasks');
  if nullif(v->>'versionId','') is not null then perform public.rms_require_record((v->>'versionId')::uuid,v_research,'versions'); end if;
 end case;
 if octet_length(v::text)>262144 then raise exception '기록 용량이 너무 큽니다.' using errcode='22023'; end if;
 v:=v||jsonb_build_object('id',v_id,'researchId',v_research,'createdAt',coalesce(v_old.created_at,v_stamp),'updatedAt',v_stamp);
 insert into public.rms_records(id,research_id,kind,data,created_at,updated_at) values(v_id,v_research,p_kind,v,coalesce(v_old.created_at,v_stamp),v_stamp) on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
 return v;
end $$;

create function public.rms_save_preparation(p_meeting jsonb,p_questions jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_question jsonb; v_meeting public.rms_records;
begin
 perform public.rms_assert_session(); if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions)>100 then raise exception '질문 목록을 확인해 주세요.' using errcode='22023'; end if;
 select * into v_meeting from public.rms_records where id=(p_meeting->>'id')::uuid and kind='meetings' for update;
 if v_meeting.id is null or not public.rms_owns_research(v_meeting.research_id) or p_meeting->>'researchId' is distinct from v_meeting.research_id::text then raise exception '이 미팅을 변경할 수 없습니다.' using errcode='42501'; end if;
 if p_meeting->>'updatedAt' is distinct from v_meeting.data->>'updatedAt' then
  if (p_meeting-'createdAt'-'updatedAt'-'memoRevision')=(v_meeting.data-'createdAt'-'updatedAt'-'memoRevision') and not exists(
   select 1 from jsonb_array_elements(p_questions) q left join public.rms_records r on r.id=(q->>'id')::uuid and r.kind='questions' and r.research_id=v_meeting.research_id
   where r.id is null or (q-'createdAt'-'updatedAt') is distinct from (r.data-'createdAt'-'updatedAt')
  ) then return v_meeting.data; end if;
  raise exception '미팅이 변경되었습니다. 작성 내용을 유지하고 다시 불러와 주세요.' using errcode='40001';
 end if;
 for v_question in select jsonb_array_elements(p_questions) loop
  if v_question->>'researchId' is distinct from v_meeting.research_id::text then raise exception '다른 연구의 질문을 연결할 수 없습니다.' using errcode='42501'; end if;
  perform public.rms_save_record('questions',v_question);
 end loop;
 return public.rms_save_record('meetings',p_meeting);
end $$;

create function public.rms_delete_record(p_kind text,p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v public.rms_records;
begin
 perform public.rms_assert_session(); select * into v from public.rms_records where id=p_id and kind=p_kind for update;
 if not found or not public.rms_owns_research(v.research_id) then raise exception '이 기록을 변경할 수 없습니다.' using errcode='42501'; end if;
 if exists(select 1 from public.rms_review_items where result_id=p_id) or exists(select 1 from public.rms_review_rounds where snapshot->>'versionId'=p_id::text) then raise exception '검토 이력에 사용한 기록은 삭제할 수 없습니다.' using errcode='22023'; end if;
 if exists(select 1 from public.rms_records r where r.id<>p_id and r.research_id=v.research_id and (r.data->>'meetingId'=p_id::text or r.data->>'feedbackId'=p_id::text or r.data->>'planId'=p_id::text or r.data->>'materialId'=p_id::text or r.data->>'versionId'=p_id::text or coalesce(r.data->'taskIds','[]'::jsonb) ? p_id::text or coalesce(r.data->'questionIds','[]'::jsonb) ? p_id::text or coalesce(r.data->'versionIds','[]'::jsonb) ? p_id::text or coalesce(r.data->'feedbackIds','[]'::jsonb) ? p_id::text)) or exists(select 1 from public.rms_researches where data->>'nextMeetingId'=p_id::text) then raise exception '다른 기록에 연결되어 있습니다. 연결을 먼저 정리해 주세요.' using errcode='22023'; end if;
 delete from public.rms_records where id=p_id;
end $$;

create function public.rms_request_json(p_row public.rms_review_requests) returns jsonb language sql immutable as $$ select jsonb_build_object('id',p_row.id,'researchId',p_row.research_id,'title',p_row.title,'professorEmail',p_row.professor_email,'professorId',p_row.professor_id,'status',p_row.status,'createdAt',p_row.created_at,'updatedAt',p_row.updated_at) $$;

create function public.rms_response_json(p_row public.rms_review_responses) returns jsonb language sql immutable as $$ select jsonb_build_object('id',p_row.id,'roundId',p_row.round_id,'userId',p_row.user_id,'result',p_row.result,'comment',p_row.comment,'createdAt',p_row.created_at,'updatedAt',p_row.updated_at) $$;

create function public.rms_build_snapshot(p_result_id uuid,p_research_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth,storage as $$
declare v_result jsonb; v_version jsonb; v_excerpt text; v_stamp timestamptz:=clock_timestamp();
begin
 v_result:=public.rms_require_record(p_result_id,p_research_id,'results');
 perform public.rms_required_text(v_result,'description',20000);
 if v_result->>'kind'='document' then
  if nullif(v_result->>'versionId','') is null or nullif(btrim(v_result->>'location'),'') is null then raise exception '문서 수정 항목에는 보존 파일과 확인 위치가 필요합니다.' using errcode='22023'; end if;
 end if;
 if nullif(v_result->>'versionId','') is not null then
  v_version:=public.rms_require_record((v_result->>'versionId')::uuid,p_research_id,'versions');
  if not exists(select 1 from storage.objects where bucket_id='research-files' and name=v_version->>'storagePath') then raise exception '근거 파일을 찾을 수 없습니다. 파일을 확인해 주세요.' using errcode='22023'; end if;
 end if;
 select string_agg((r.data->>'title')||E'\n'||(r.data->>'body'),E'\n\n' order by r.created_at) into v_excerpt from public.rms_records r where r.research_id=p_research_id and r.kind='feedback' and v_result->'feedbackIds' ? r.id::text;
 -- Only deliberate public fields: never private feedback notes, meeting memo, or AI candidates.
 return jsonb_strip_nulls(jsonb_build_object('title',v_result->>'title','description',v_result->>'description','feedbackExcerpt',coalesce(v_excerpt,''),'versionId',v_version->>'id','fileName',v_version->>'fileName','storagePath',v_version->>'storagePath','location',coalesce(v_result->>'location',''),'version',v_version));
end $$;

create function public.rms_idempotency_read(p_operation text,p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_key uuid; v public.rms_mutation_receipts;
begin
 if nullif(p_input->>'requestKey','') is null then return null; end if;
 v_key:=(p_input->>'requestKey')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||v_key::text,0));
 select * into v from public.rms_mutation_receipts where user_id=auth.uid() and request_key=v_key;
 if found then
  if v.operation<>p_operation or v.payload_hash<>md5((p_input-'requestKey')::text) then raise exception '같은 요청 번호를 다른 입력에 사용할 수 없습니다.' using errcode='22023'; end if;
  return v.response;
 end if;
 return null;
end $$;

create function public.rms_idempotency_write(p_operation text,p_input jsonb,p_response jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
 if nullif(p_input->>'requestKey','') is not null then insert into public.rms_mutation_receipts(user_id,request_key,operation,payload_hash,response) values(auth.uid(),(p_input->>'requestKey')::uuid,p_operation,md5((p_input-'requestKey')::text),p_response); end if;
end $$;

create function public.rms_create_review(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_uid uuid:=public.rms_assert_session(); v_research uuid:=(p_input->>'researchId')::uuid; v_prof uuid; v_request public.rms_review_requests; v_id text; v_result jsonb; v_item uuid; v_snapshot jsonb; v_cached jsonb;
begin
 v_cached:=public.rms_idempotency_read('create_review',p_input); if v_cached is not null then return v_cached; end if;
 if not public.rms_owns_research(v_research) then raise exception '이 연구를 공유할 수 없습니다.' using errcode='42501'; end if;
 perform public.rms_required_text(p_input,'title',200); v_prof:=public.rms_professor_id(public.rms_required_text(p_input,'professorEmail',320));
 if jsonb_typeof(p_input->'resultIds') is distinct from 'array' or jsonb_array_length(p_input->'resultIds') not between 1 and 30 then raise exception '검토할 수정 결과를 선택해 주세요.' using errcode='22023'; end if;
 if (select count(*) from jsonb_array_elements_text(p_input->'resultIds'))<>(select count(distinct x) from jsonb_array_elements_text(p_input->'resultIds') x) then raise exception '같은 수정 결과를 중복 선택할 수 없습니다.' using errcode='22023'; end if;
 insert into public.rms_review_requests(research_id,owner_id,professor_id,professor_email,title) values(v_research,v_uid,v_prof,lower(btrim(p_input->>'professorEmail')),btrim(p_input->>'title')) returning * into v_request;
 for v_id in select jsonb_array_elements_text(p_input->'resultIds') loop
  v_result:=public.rms_require_record(v_id::uuid,v_research,'results'); v_snapshot:=public.rms_build_snapshot(v_id::uuid,v_research);
  insert into public.rms_review_items(request_id,result_id,title) values(v_request.id,v_id::uuid,v_result->>'title') returning id into v_item;
  insert into public.rms_review_rounds(request_id,item_id,number,snapshot) values(v_request.id,v_item,1,v_snapshot);
 end loop;
 perform public.rms_idempotency_write('create_review',p_input,public.rms_request_json(v_request));
 return public.rms_request_json(v_request);
end $$;

create function public.rms_recheck(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_request public.rms_review_requests; v_item public.rms_review_items; v_result uuid:=(p_input->>'resultId')::uuid; v_number integer; v_round public.rms_review_rounds; v_cached jsonb; v_response jsonb;
begin
 perform public.rms_assert_session(); v_cached:=public.rms_idempotency_read('recheck',p_input); if v_cached is not null then return v_cached; end if; select * into v_request from public.rms_review_requests where id=(p_input->>'requestId')::uuid for update;
 if v_request.id is null or v_request.owner_id<>auth.uid() then raise exception '이 검토를 변경할 수 없습니다.' using errcode='42501'; end if;
 if v_request.status<>'shared' then raise exception '공유 중인 검토에서 재확인을 요청해 주세요.' using errcode='22023'; end if;
 select * into v_item from public.rms_review_items where id=(p_input->>'itemId')::uuid and request_id=v_request.id for update;
 if v_item.id is null or v_item.result_id is distinct from v_result then raise exception '같은 항목의 수정 결과를 선택해 주세요.' using errcode='22023'; end if;
 select coalesce(max(number),0)+1 into v_number from public.rms_review_rounds where item_id=v_item.id;
 insert into public.rms_review_rounds(request_id,item_id,number,snapshot) values(v_request.id,v_item.id,v_number,public.rms_build_snapshot(v_result,v_request.research_id)) returning * into v_round;
 update public.rms_review_requests set updated_at=clock_timestamp() where id=v_request.id;
 v_response:=(v_round.snapshot-'version')||jsonb_build_object('id',v_round.id,'requestId',v_round.request_id,'itemId',v_round.item_id,'number',v_round.number,'createdAt',v_round.created_at);
 perform public.rms_idempotency_write('recheck',p_input,v_response);
 return v_response;
end $$;

create function public.rms_respond(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_round public.rms_review_rounds; v_request public.rms_review_requests; v_old public.rms_review_responses; v_response public.rms_review_responses; v_comment text;
begin
 perform public.rms_assert_session(); select * into v_round from public.rms_review_rounds where id=(p_input->>'roundId')::uuid;
 if v_round.id is null then raise exception '이 검토에 응답할 수 없습니다.' using errcode='42501'; end if;
 select * into v_request from public.rms_review_requests where id=v_round.request_id for update;
 if v_request.status<>'shared' or v_request.professor_id<>auth.uid() then raise exception '지정된 교수 계정만 응답할 수 있습니다.' using errcode='42501'; end if;
 if v_round.number<>(select max(number) from public.rms_review_rounds where item_id=v_round.item_id) then raise exception '새 검토 차수가 있습니다. 최신 차수에서 응답해 주세요.' using errcode='40001'; end if;
 if p_input->>'result' not in ('confirmed','changes_requested') or p_input->>'result' is null then raise exception '검토 결과를 선택해 주세요.' using errcode='22023'; end if;
 v_comment:=btrim(public.rms_optional_text(p_input,'comment',10000));
 if p_input->>'result'='changes_requested' and v_comment='' then raise exception '추가로 수정할 내용을 댓글로 적어 주세요.' using errcode='22023'; end if;
 select * into v_old from public.rms_review_responses where round_id=v_round.id for update;
 if found then
  if v_old.user_id=auth.uid() and v_old.result=p_input->>'result' and v_old.comment=v_comment then return public.rms_response_json(v_old); end if;
  insert into public.rms_response_history(response_id,round_id,data) values(v_old.id,v_round.id,public.rms_response_json(v_old));
  update public.rms_review_responses set result=p_input->>'result',comment=v_comment,user_id=auth.uid(),created_at=case when user_id=auth.uid() then created_at else clock_timestamp() end,updated_at=clock_timestamp() where id=v_old.id returning * into v_response;
 else
  insert into public.rms_review_responses(round_id,user_id,result,comment) values(v_round.id,auth.uid(),p_input->>'result',v_comment) returning * into v_response;
 end if;
 return public.rms_response_json(v_response);
end $$;

create function public.rms_comment(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_round uuid:=(p_input->>'roundId')::uuid; v_parent uuid:=nullif(p_input->>'parentId','')::uuid; v_row public.rms_review_comments; v_name text;
begin
 perform public.rms_assert_session(); if not public.rms_can_read_round(v_round) then raise exception '이 대화에 접근할 수 없습니다.' using errcode='42501'; end if;
 if v_parent is not null and not exists(select 1 from public.rms_review_comments where id=v_parent and round_id=v_round) then raise exception '같은 검토 항목의 댓글에 답글을 남겨 주세요.' using errcode='22023'; end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),split_part(email,'@',1),'사용자'),80) into v_name from auth.users where id=auth.uid();
 insert into public.rms_review_comments(round_id,user_id,author_name,body,parent_id) values(v_round,auth.uid(),v_name,public.rms_required_text(p_input,'body',10000),v_parent) returning * into v_row;
 return jsonb_strip_nulls(jsonb_build_object('id',v_row.id,'roundId',v_row.round_id,'userId',v_row.user_id,'authorName',v_row.author_name,'body',v_row.body,'parentId',v_row.parent_id,'resolved',v_row.resolved,'createdAt',v_row.created_at));
end $$;

create function public.rms_resolve_comment(p_id uuid,p_resolved boolean) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_round uuid;
begin
 perform public.rms_assert_session(); select round_id into v_round from public.rms_review_comments where id=p_id;
 if not public.rms_can_read_round(v_round) then raise exception '이 대화를 변경할 수 없습니다.' using errcode='42501'; end if;
 update public.rms_review_comments set resolved=p_resolved where id=p_id;
end $$;

create function public.rms_set_sharing(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v public.rms_review_requests; v_prof uuid;
begin
 perform public.rms_assert_session(); select * into v from public.rms_review_requests where id=(p_input->>'requestId')::uuid for update;
 if v.id is null or v.owner_id<>auth.uid() then raise exception '공유 설정을 변경할 수 없습니다.' using errcode='42501'; end if;
 if p_input->>'status' not in ('shared','stopped') or p_input->>'status' is null then raise exception '공유 상태를 확인해 주세요.' using errcode='22023'; end if;
 v_prof:=v.professor_id;
 if nullif(btrim(p_input->>'professorEmail'),'') is not null and lower(btrim(p_input->>'professorEmail'))<>v.professor_email then v_prof:=public.rms_professor_id(p_input->>'professorEmail'); end if;
 update public.rms_review_requests set status=p_input->>'status',professor_id=v_prof,professor_email=case when v_prof<>v.professor_id then lower(btrim(p_input->>'professorEmail')) else v.professor_email end,updated_at=clock_timestamp() where id=v.id returning * into v;
 return public.rms_request_json(v);
end $$;

create function public.rms_mark_read(p_round_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ begin perform public.rms_assert_session(); if not public.rms_can_read_round(p_round_id) then raise exception '이 검토에 접근할 수 없습니다.' using errcode='42501'; end if; insert into public.rms_review_reads(round_id,user_id,last_seen_at) values(p_round_id,auth.uid(),clock_timestamp()) on conflict(round_id,user_id) do update set last_seen_at=excluded.last_seen_at; end $$;

create function public.rms_response_history(p_round_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ begin perform public.rms_assert_session(); if not public.rms_can_read_round(p_round_id) then raise exception '이 검토에 접근할 수 없습니다.' using errcode='42501'; end if; return (select coalesce(jsonb_agg(data order by replaced_at),'[]'::jsonb) from public.rms_response_history where round_id=p_round_id); end $$;

create function public.rms_bootstrap() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
declare v jsonb; v_kind text;
begin
 perform public.rms_assert_session();
 v:=jsonb_build_object('researches',(select coalesce(jsonb_agg(data order by updated_at desc),'[]'::jsonb) from public.rms_researches where owner_id=auth.uid()));
 foreach v_kind in array array['meetings','feedback','plans','tasks','questions','decisions','materials','versions','results'] loop
  v:=v||jsonb_build_object(v_kind,(select coalesce(jsonb_agg(r.data order by r.created_at),'[]'::jsonb) from public.rms_records r where r.kind=v_kind and public.rms_owns_research(r.research_id)));
 end loop;
 -- A professor only receives version metadata for files deliberately attached to shared snapshots.
 v:=jsonb_set(v,'{versions}',(v->'versions')||(select coalesce(jsonb_agg(distinct rr.snapshot->'version'),'[]'::jsonb) from public.rms_review_rounds rr join public.rms_review_requests r on r.id=rr.request_id where r.professor_id=auth.uid() and r.status='shared' and rr.snapshot->'version' is not null));
 return v||jsonb_build_object(
  'reviews',(select coalesce(jsonb_agg(public.rms_request_json(r) order by r.updated_at desc),'[]'::jsonb) from public.rms_review_requests r where public.rms_can_read_request(r.id)),
  'reviewItems',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'requestId',i.request_id,'resultId',i.result_id,'title',i.title) order by i.id),'[]'::jsonb) from public.rms_review_items i where public.rms_can_read_request(i.request_id)),
  'rounds',(select coalesce(jsonb_agg((rr.snapshot-'version')||jsonb_build_object('id',rr.id,'requestId',rr.request_id,'itemId',rr.item_id,'number',rr.number,'createdAt',rr.created_at) order by rr.number),'[]'::jsonb) from public.rms_review_rounds rr where public.rms_can_read_request(rr.request_id)),
  'responses',(select coalesce(jsonb_agg(public.rms_response_json(r)),'[]'::jsonb) from public.rms_review_responses r where public.rms_can_read_round(r.round_id)),
  'comments',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',c.id,'roundId',c.round_id,'userId',c.user_id,'authorName',c.author_name,'body',c.body,'parentId',c.parent_id,'resolved',c.resolved,'createdAt',c.created_at)) order by c.created_at),'[]'::jsonb) from public.rms_review_comments c where public.rms_can_read_round(c.round_id)),
  'reads',(select coalesce(jsonb_agg(jsonb_build_object('roundId',r.round_id,'userId',r.user_id,'lastSeenAt',r.last_seen_at)),'[]'::jsonb) from public.rms_review_reads r where r.user_id=auth.uid() and public.rms_can_read_round(r.round_id))
 );
end $$;

-- Rate admission is service-role only and is called only after Edge JWT validation.
create function public.rms_ai_begin(p_user_id uuid,p_research_id uuid,p_input_hash text) returns uuid language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.rms_demo_accounts where user_id=p_user_id and active) or not exists(select 1 from public.rms_researches where id=p_research_id and owner_id=p_user_id) then raise exception 'AI 실행 권한이 없습니다.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 if (select count(*) from public.rms_ai_runs where user_id=p_user_id and created_at>clock_timestamp()-interval '1 minute')>=6 or (select count(*) from public.rms_ai_runs where user_id=p_user_id and created_at>clock_timestamp()-interval '24 hours')>=100 then raise exception 'AI 사용 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.' using errcode='P0001'; end if;
 if exists(select 1 from public.rms_ai_runs where user_id=p_user_id and input_hash=p_input_hash and status='running' and created_at>clock_timestamp()-interval '100 seconds') then raise exception '같은 내용의 AI 처리가 진행 중입니다.' using errcode='55000'; end if;
 insert into public.rms_ai_runs(user_id,research_id,input_hash) values(p_user_id,p_research_id,left(p_input_hash,128)) returning id into v_id;
 return v_id;
end $$;

create function public.rms_ai_finish(p_run_id uuid,p_status text) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ begin if p_status not in ('complete','failed') then raise exception '잘못된 AI 상태'; end if; update public.rms_ai_runs set status=p_status,completed_at=clock_timestamp() where id=p_run_id and status='running'; end $$;

-- Private bucket: authenticated reads re-check permission, no reusable public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('research-files','research-files',false,20971520,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy rms_files_upload on storage.objects for insert to authenticated with check(bucket_id='research-files' and public.rms_is_allowed() and split_part(name,'/',1)=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and public.rms_owns_research(split_part(name,'/',2)::uuid));

create policy rms_files_read on storage.objects for select to authenticated using(bucket_id='research-files' and public.rms_can_read_file(name));

-- No UPDATE policy: an uploaded object can never overwrite a preserved version.
create policy rms_orphan_files_delete on storage.objects for delete to authenticated using(bucket_id='research-files' and public.rms_is_allowed() and split_part(name,'/',1)=auth.uid()::text and not exists(select 1 from public.rms_records r where r.kind='versions' and r.data->>'storagePath'=name) and not exists(select 1 from public.rms_review_rounds rr where rr.snapshot->>'storagePath'=name));

-- PUBLIC execution is revoked for every RMS function, including private helpers.
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rms_%' loop execute format('revoke all on function %s from public, anon, authenticated',f.signature); execute format('grant execute on function %s to service_role',f.signature); end loop; end $$;

grant execute on function public.rms_is_allowed(),public.rms_owns_research(uuid),public.rms_can_read_request(uuid),public.rms_can_read_round(uuid),public.rms_can_read_file(text) to authenticated;

grant execute on function public.rms_bootstrap(),public.rms_save_research(jsonb),public.rms_save_record(text,jsonb),public.rms_delete_record(text,uuid),public.rms_save_preparation(jsonb,jsonb),public.rms_create_review(jsonb),public.rms_recheck(jsonb),public.rms_respond(jsonb),public.rms_comment(jsonb),public.rms_resolve_comment(uuid,boolean),public.rms_set_sharing(jsonb),public.rms_mark_read(uuid),public.rms_response_history(uuid) to authenticated;

grant all on public.rms_demo_accounts,public.rms_researches,public.rms_records,public.rms_review_requests,public.rms_review_items,public.rms_review_rounds,public.rms_review_responses,public.rms_response_history,public.rms_review_comments,public.rms_review_reads,public.rms_ai_runs to service_role;
