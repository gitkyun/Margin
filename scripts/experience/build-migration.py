from pathlib import Path
root=Path('apps/home-preview/supabase/migrations')
base=(root/'202611030001_rms.sql').read_text()
latest=(root/'20261104010000_version_retry_lock.sql').read_text()
parts=[]
parts.append(r'''
-- Additive RMS experience expansion. Existing reviews and immutable files are retained.
create table public.rms_members(research_id uuid not null references public.rms_researches(id),user_id uuid not null references auth.users(id),role text not null check(role in ('owner','editor')),status text not null check(status in ('pending','active','revoked')),invited_by uuid references auth.users(id),created_at timestamptz not null default now(),primary key(research_id,user_id));
insert into public.rms_members(research_id,user_id,role,status) select id,owner_id,'owner','active' from public.rms_researches on conflict do nothing;
create table public.rms_events(id uuid primary key default gen_random_uuid(),research_id uuid not null references public.rms_researches(id),recipient_id uuid not null references auth.users(id),actor_id uuid not null references auth.users(id),record_id uuid,title text not null,message text not null default '',href text not null,kind text not null,created_at timestamptz not null default now(),read_at timestamptz);
create index rms_events_recipient on public.rms_events(recipient_id,created_at desc);
create table public.rms_polls(id uuid primary key default gen_random_uuid(),research_id uuid not null references public.rms_researches(id),organizer_id uuid not null references auth.users(id),data jsonb not null,status text not null default 'open' check(status in ('open','confirmed','cancelled')),meeting_id uuid references public.rms_records(id),updated_at timestamptz not null default now());
create table public.rms_poll_participants(poll_id uuid references public.rms_polls(id),user_id uuid references auth.users(id),available jsonb not null default '[]',primary key(poll_id,user_id));
alter table public.rms_ai_runs add column mode text not null default 'ask_research', add column model text, add column thinking text, add column output jsonb, add column error text;
alter table public.rms_ai_runs drop constraint rms_ai_runs_status_check;
alter table public.rms_ai_runs add constraint rms_ai_runs_status_check check(status in ('running','complete','failed','cancelled'));
alter table public.rms_records drop constraint rms_records_kind_check;
alter table public.rms_records add constraint rms_records_kind_check check(kind in ('meetings','feedback','plans','tasks','questions','decisions','materials','versions','results','documents','documentVersions','folders','phases','milestones','recordings','conversations','attachments','aiCandidates','privateNotes'));
update public.rms_records rec set data=rec.data||jsonb_build_object('createdBy',r.owner_id,'updatedBy',r.owner_id,'visibility',case when rec.kind in ('meetings','plans') then 'private' else 'shared' end) from public.rms_researches r where r.id=rec.research_id;
-- Feedback scratch notes are kept outside shared rows, even for direct API queries.
insert into public.rms_records(id,research_id,kind,data) select md5(r.owner_id::text||rec.id::text)::uuid,rec.research_id,'privateNotes',jsonb_build_object('id',md5(r.owner_id::text||rec.id::text)::uuid,'researchId',rec.research_id,'recordId',rec.id,'body',rec.data->>'notes','createdBy',r.owner_id,'updatedBy',r.owner_id,'visibility','private','createdAt',rec.created_at,'updatedAt',rec.updated_at) from public.rms_records rec join public.rms_researches r on r.id=rec.research_id where rec.kind='feedback' and coalesce(rec.data->>'notes','')<>'';
update public.rms_records set data=jsonb_set(data,'{notes}','""') where kind='feedback';
create or replace function public.rms_member_access(p_id uuid,p_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select exists(select 1 from public.rms_demo_accounts a where a.user_id=p_user and a.active) and exists(select 1 from public.rms_researches r where r.id=p_id and nullif(r.data->>'deletedAt','') is null and (r.owner_id=p_user or exists(select 1 from public.rms_members m where m.research_id=r.id and m.user_id=p_user and m.status='active'))) $$;
create or replace function public.rms_can_edit_research(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_member_access(p_id,auth.uid()) $$;
create or replace function public.rms_record_access(p_id uuid,p_user uuid) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
declare r public.rms_records;
begin
 select * into r from public.rms_records where id=p_id;
 if r.id is null or not public.rms_member_access(r.research_id,p_user) then return false; end if;
 if r.kind='versions' then return public.rms_record_access((r.data->>'materialId')::uuid,p_user); end if;
 if r.kind='documentVersions' then return public.rms_record_access((r.data->>'documentId')::uuid,p_user); end if;
 return r.data->>'createdBy'=p_user::text or (r.kind not in ('conversations','aiCandidates','attachments','privateNotes') and r.data->>'visibility'='shared');
end $$;
create or replace function public.rms_can_read_record(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_record_access(p_id,auth.uid()) $$;
create or replace function public.rms_can_read_request(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_is_allowed() and exists(select 1 from public.rms_review_requests q join public.rms_researches r on r.id=q.research_id where q.id=p_id and nullif(r.data->>'deletedAt','') is null and (public.rms_can_edit_research(q.research_id) or(q.professor_id=auth.uid() and q.status='shared'))) $$;
create or replace function public.rms_can_read_file(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_is_allowed() and (exists(select 1 from public.rms_records r where r.data->>'storagePath'=p_path and public.rms_can_read_record(r.id)) or exists(select 1 from public.rms_review_rounds rr join public.rms_review_requests q on q.id=rr.request_id where rr.snapshot->>'storagePath'=p_path and q.professor_id=auth.uid() and q.status='shared' and public.rms_can_read_request(q.id))) $$;
create or replace function public.rms_require_record(p_id uuid,p_research_id uuid,p_kind text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$ declare v jsonb; begin select data into v from public.rms_records where id=p_id and research_id=p_research_id and kind=p_kind; if v is null or not public.rms_can_read_record(p_id) then raise exception '연결할 기록을 찾을 수 없습니다.' using errcode='22023'; end if; return v; end $$;
create function public.rms_emit(p_research uuid,p_record uuid,p_title text,p_message text,p_href text,p_kind text) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ begin insert into public.rms_events(research_id,recipient_id,actor_id,record_id,title,message,href,kind) select p_research,m.user_id,auth.uid(),p_record,left(p_title,300),left(p_message,1000),p_href,p_kind from public.rms_members m where m.research_id=p_research and m.status='active' and m.user_id<>auth.uid() and (p_record is null or public.rms_record_access(p_record,m.user_id)); end $$;
''')
# Preserve the old validated implementation while extending permissions and record kinds.
s=latest[latest.index('create or replace function'):]
s=s.replace("'versions','results')", "'versions','results','documents','documentVersions','folders','phases','milestones','recordings','conversations','attachments','aiCandidates','privateNotes')",1)
s=s.replace('public.rms_owns_research(v_research)','public.rms_can_edit_research(v_research)')
s=s.replace('v_position integer;','v_position integer; v_author uuid; v_visibility text; v_note text; v_parent jsonb;')
s=s.replace("if p_kind='versions' then\n   if", "if p_kind in ('versions','documentVersions') then\n   if",1)
s=s.replace('  if v_old.research_id<>v_research', "  if not public.rms_can_read_record(v_id) then raise exception '이 기록에 접근할 수 없습니다.' using errcode='42501'; end if;\n  if v_old.research_id<>v_research",1)
s=s.replace(" v:=p_value-'createdAt'-'updatedAt';",r"""
 v_author:=coalesce((v_old.data->>'createdBy')::uuid,v_uid);
 v_visibility:=coalesce(p_value->>'visibility',v_old.data->>'visibility',case when p_kind in ('meetings','plans','documents','recordings','conversations','attachments','aiCandidates','privateNotes') then 'private' else 'shared' end);
 if v_visibility not in ('private','shared') then raise exception '공개 범위를 확인해 주세요.' using errcode='22023'; end if;
 if p_kind in ('conversations','attachments','aiCandidates','privateNotes') then v_visibility:='private'; end if;
 if v_old.id is not null and v_author<>v_uid and v_visibility is distinct from v_old.data->>'visibility' then raise exception '작성자만 공개 범위를 변경할 수 있습니다.' using errcode='42501'; end if;
 v:=(p_value-'createdAt'-'updatedAt'-'createdBy'-'updatedBy')||jsonb_build_object('createdBy',v_author,'updatedBy',v_uid,'visibility',v_visibility);
 if p_kind='feedback' then v_note:=public.rms_optional_text(v,'notes',20000); v:=jsonb_set(v,'{notes}','""'); end if;
 if p_kind='tasks' and nullif(v->>'assigneeId','') is not null and not public.rms_member_access(v_research,(v->>'assigneeId')::uuid) then raise exception '참여 중인 연구자를 담당자로 선택해 주세요.' using errcode='22023'; end if;
 if p_kind='materials' and nullif(v->>'folderId','') is not null then perform public.rms_require_record((v->>'folderId')::uuid,v_research,'folders'); end if;
""",1)
# Remove premature equality return, which could suppress a personal note change.
s=s.replace("  if (p_value-'createdAt'-'updatedAt'-'memoRevision'-'sourceStart'-'sourceEnd')=(v_old.data-'createdAt'-'updatedAt'-'memoRevision'-'sourceStart'-'sourceEnd') then return v_old.data; end if;", "  if p_kind<>'feedback' and (p_value-'createdAt'-'updatedAt'-'memoRevision'-'sourceStart'-'sourceEnd')=(v_old.data-'createdAt'-'updatedAt'-'memoRevision'-'sourceStart'-'sourceEnd') then return v_old.data; end if;")
s=s.replace("-'number')", "-'number'-'createdBy'-'updatedBy'-'visibility')")
s=s.replace("metadata->>'size')::bigint=(v->>'size')::bigint)", "metadata->>'size')::bigint=(v->>'size')::bigint and metadata->>'mimetype'=v->>'mimeType')")
# New records receive revision checks and immutable snapshots through the same RPC.
newcases=r'''
 when 'documents' then
  perform public.rms_required_text(v,'title',300); perform public.rms_optional_text(v,'text',150000);
  if v->>'type' not in ('plan','manuscript','note') or jsonb_typeof(v->'content') is distinct from 'object' then raise exception '문서 형식을 확인해 주세요.' using errcode='22023'; end if;
  v:=v||jsonb_build_object('revision',coalesce((v_old.data->>'revision')::integer,0)+1);
 when 'documentVersions' then
  v_parent:=public.rms_require_record((v->>'documentId')::uuid,v_research,'documents');
  perform pg_advisory_xact_lock(hashtextextended(v_research::text||':doc:'||(v->>'documentId'),0));
  perform public.rms_required_text(v,'title',300);
  if v->'content' is distinct from v_parent->'content' or v->>'text' is distinct from v_parent->>'text' then raise exception '저장한 현재 문서로 버전을 만들어 주세요.' using errcode='40001'; end if;
  v:=v||jsonb_build_object('number',(select coalesce(max((data->>'number')::integer),0)+1 from public.rms_records where kind='documentVersions' and data->>'documentId'=v->>'documentId'));
 when 'folders' then
  perform public.rms_required_text(v,'title',120);
  if nullif(v->>'parentId','') is not null then
   if v->>'parentId'=v_id::text then raise exception '자기 안으로 이동할 수 없습니다.' using errcode='22023'; end if;
   perform public.rms_require_record((v->>'parentId')::uuid,v_research,'folders');
   if exists(with recursive ancestors as(select id,data->>'parentId' parent from public.rms_records where id=(v->>'parentId')::uuid union all select r.id,r.data->>'parentId' from public.rms_records r join ancestors a on r.id::text=a.parent where r.kind='folders') select 1 from ancestors where id=v_id) then raise exception '폴더 연결에 순환이 생깁니다.' using errcode='22023'; end if;
  end if;
 when 'phases' then
  perform public.rms_required_text(v,'title',200);
  if v->>'status' not in ('planned','active','done') or (v->>'order')::integer is null then raise exception '단계 상태·순서를 확인해 주세요.' using errcode='22023'; end if;
  perform public.rms_validate_refs(v,'dependsOn',v_research,'phases');
  if v->'dependsOn' ? v_id::text then raise exception '자기 단계에 연결할 수 없습니다.' using errcode='22023'; end if;
 when 'milestones' then
  perform public.rms_required_text(v,'title',200); perform public.rms_validate_refs(v,'taskIds',v_research,'tasks'); perform public.rms_validate_refs(v,'documentIds',v_research,'documents');
  if v->>'status' not in ('planned','done') then raise exception '목표 상태를 확인해 주세요.' using errcode='22023'; end if;
 when 'recordings' then
  perform public.rms_require_record((v->>'meetingId')::uuid,v_research,'meetings'); perform public.rms_required_text(v,'title',300);
  if (v->>'duration')::numeric not between 0 and 7200 or nullif(v->>'consentAt','') is null then raise exception '녹음 시간과 동의를 확인해 주세요.' using errcode='22023'; end if;
  if v->>'mimeType' not in ('audio/webm','audio/mp4','audio/ogg') then raise exception '지원하는 음성 형식을 사용해 주세요.' using errcode='22023'; end if;
 when 'conversations' then
  perform public.rms_required_text(v,'title',200);
  if jsonb_typeof(v->'messages') is distinct from 'array' or jsonb_array_length(v->'messages')>100 or jsonb_typeof(v->'contexts') is distinct from 'array' then raise exception '대화 형식을 확인해 주세요.' using errcode='22023'; end if;
 when 'attachments' then
  perform public.rms_required_text(v,'title',300); perform public.rms_optional_text(v,'text',80000);
  if v->>'mimeType' not in ('application/pdf','text/plain','text/markdown') then raise exception 'PDF·TXT·MD를 첨부해 주세요.' using errcode='22023'; end if;
 when 'aiCandidates' then
  perform public.rms_required_text(v,'title',300);
  if v->>'status' not in ('pending','adopted','dismissed') or not exists(select 1 from public.rms_ai_runs where id=(v->>'runId')::uuid and user_id=v_uid and research_id=v_research) then raise exception 'AI 실행 출처를 확인해 주세요.' using errcode='22023'; end if;
 when 'privateNotes' then perform public.rms_optional_text(v,'body',20000);
'''
s=s.replace(' end case;',newcases+' end case;')
s=s.replace(" if octet_length(v::text)>262144",r"""
 if p_kind in ('recordings','attachments') then
  if split_part(v->>'storagePath','/',1)<>v_uid::text or split_part(v->>'storagePath','/',2)<>v_research::text or split_part(split_part(v->>'storagePath','/',3),'.',1)<>v_id::text or (v->>'size')::bigint not between 1 and 52428800 then raise exception '업로드 경로·용량을 확인해 주세요.' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='research-private' and name=v->>'storagePath' and (metadata->>'size')::bigint=(v->>'size')::bigint) then raise exception '파일 저장을 먼저 완료해 주세요.' using errcode='22023'; end if;
 end if;
 if p_kind='tasks' and nullif(v->>'phaseId','') is not null then perform public.rms_require_record((v->>'phaseId')::uuid,v_research,'phases'); end if;
 if p_kind='milestones' and nullif(v->>'phaseId','') is not null then perform public.rms_require_record((v->>'phaseId')::uuid,v_research,'phases'); end if;
 if octet_length(v::text)>1048576""")
s=s.replace(' return v;\nend $$;',r'''
 if p_kind='feedback' then
  insert into public.rms_records(id,research_id,kind,data) values(md5(v_uid::text||v_id::text)::uuid,v_research,'privateNotes',jsonb_build_object('id',md5(v_uid::text||v_id::text)::uuid,'researchId',v_research,'recordId',v_id,'body',coalesce(v_note,''),'createdBy',v_uid,'updatedBy',v_uid,'visibility','private','createdAt',v_stamp,'updatedAt',v_stamp)) on conflict(id) do update set data=excluded.data;
  v:=jsonb_set(v,'{notes}',to_jsonb(coalesce(v_note,'')));
 end if;
 if p_kind not in ('privateNotes','conversations','attachments','aiCandidates') then perform public.rms_emit(v_research,v_id,case when v_old.id is null then '새 기록이 추가되었습니다' else '연구 기록이 변경되었습니다' end,coalesce(v->>'title',v->>'text',''),'/r/'||v_research::text||'/'||case when p_kind='documents' then 'writing' when p_kind in ('phases','milestones') then 'planning' when p_kind='versions' then 'materials' else p_kind end||case when p_kind not in ('phases','milestones') then '/'||case when p_kind='versions' then v->>'materialId' else v_id::text end else '' end,'record'); end if;
 return v;
end $$;''')
parts.append(s)
# Research metadata: editors may edit basics, lifecycle remains owner-only.
parts.append(r'''
create or replace function public.rms_save_research(p_value jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_uid uuid:=public.rms_assert_session(); v_id uuid:=(p_value->>'id')::uuid; old public.rms_researches; v jsonb; stamp timestamptz:=clock_timestamp();
begin
 perform public.rms_required_text(p_value,'name',120); perform public.rms_optional_text(p_value,'description',3000);
 select * into old from public.rms_researches where id=v_id for update;
 if found then
  if old.owner_id<>v_uid and not public.rms_can_edit_research(v_id) then raise exception '연구 접근 권한이 없습니다.' using errcode='42501'; end if;
  if old.owner_id<>v_uid and ((p_value->>'archivedAt') is distinct from old.data->>'archivedAt' or (p_value->>'deletedAt') is distinct from old.data->>'deletedAt') then raise exception '소유자만 연구를 보관·삭제·복원할 수 있습니다.' using errcode='42501'; end if;
  if p_value->>'updatedAt' is distinct from old.data->>'updatedAt' then raise exception '연구가 변경되었습니다. 최신 내용을 확인해 주세요.' using errcode='40001'; end if;
 end if;
 if nullif(p_value->>'nextMeetingId','') is not null then perform public.rms_require_record((p_value->>'nextMeetingId')::uuid,v_id,'meetings'); end if;
 if nullif(p_value->>'currentPhaseId','') is not null then perform public.rms_require_record((p_value->>'currentPhaseId')::uuid,v_id,'phases'); end if;
 v:=(p_value-'ownerId'-'createdAt'-'updatedAt')||jsonb_build_object('id',v_id,'ownerId',coalesce(old.owner_id,v_uid),'createdAt',coalesce(old.created_at,stamp),'updatedAt',stamp);
 insert into public.rms_researches(id,owner_id,data) values(v_id,coalesce(old.owner_id,v_uid),v) on conflict(id) do update set data=excluded.data,updated_at=stamp;
 insert into public.rms_members(research_id,user_id,role,status) values(v_id,coalesce(old.owner_id,v_uid),'owner','active') on conflict do nothing;
 if nullif(v->>'deletedAt','') is not null then update public.rms_review_requests set status='stopped',updated_at=stamp where research_id=v_id and status<>'stopped'; end if;
 return v;
end $$;
create or replace function public.rms_delete_record(p_kind text,p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ declare v public.rms_records; begin perform public.rms_assert_session(); select * into v from public.rms_records where id=p_id and kind=p_kind; if not public.rms_can_read_record(p_id) then raise exception '접근할 수 없습니다.' using errcode='42501'; end if; if p_kind in ('versions','documentVersions') then raise exception '보존 버전은 삭제할 수 없습니다.' using errcode='22023'; end if; perform public.rms_save_record(p_kind,v.data||jsonb_build_object('archivedAt',clock_timestamp())); end $$;
''')
# Existing validated review/preparation functions are preserved; only collaborator access is expanded.
for name in ['rms_save_preparation','rms_create_review','rms_recheck','rms_set_sharing','rms_respond']:
 start=base.index('create function public.'+name+'(');end=base.index('end $$;',start)+len('end $$;');f=base[start:end].replace('create function','create or replace function',1)
 f=f.replace('public.rms_owns_research(', 'public.rms_can_edit_research(')
 f=f.replace('v_request.owner_id<>auth.uid()', 'not public.rms_can_edit_research(v_request.research_id)').replace('v.owner_id<>auth.uid()', 'not public.rms_can_edit_research(v.research_id)')
 if name=='rms_respond': f=f.replace("if v_request.status<>'shared'", "if not public.rms_can_read_request(v_request.id) or v_request.status<>'shared'")
 parts.append(f)
# Keep service-only AI admission while supporting active collaborators and deleted-research revocation.
start=base.index('create function public.rms_ai_begin(');end=base.index('end $$;',start)+len('end $$;');f=base[start:end].replace('create function','create or replace function',1).replace("not exists(select 1 from public.rms_researches where id=p_research_id and owner_id=p_user_id)","not public.rms_member_access(p_research_id,p_user_id)");parts.append(f)
parts.append(r'''
create function public.rms_member_action(p_input jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare who uuid:=public.rms_assert_session(); rid uuid:=(p_input->>'researchId')::uuid; target uuid; action text:=p_input->>'action'; own uuid;
begin
 select owner_id into own from public.rms_researches where id=rid;
 if action='accept' then
  if not exists(select 1 from public.rms_members where research_id=rid and user_id=who and status='pending') or exists(select 1 from public.rms_researches where id=rid and nullif(data->>'deletedAt','') is not null) then raise exception '유효한 초대를 찾을 수 없습니다.' using errcode='42501'; end if;
  update public.rms_members set status='active' where research_id=rid and user_id=who; perform public.rms_emit(rid,null,'공동연구에 참여했습니다','','/r/'||rid::text||'/settings?tab=members','member'); return;
 end if;
 if own is distinct from who or not public.rms_can_edit_research(rid) then raise exception '연구 소유자만 참여자를 관리할 수 있습니다.' using errcode='42501'; end if;
 if action='invite' then
  select u.id into target from auth.users u join public.rms_demo_accounts a on a.user_id=u.id and a.active where lower(u.email)=lower(btrim(p_input->>'email')) and u.email_confirmed_at is not null;
  if target is null then raise exception '접근이 허용된 계정의 이메일을 입력해 주세요.' using errcode='22023'; end if;
  if target=own then raise exception '이미 연구 소유자입니다.' using errcode='22023'; end if;
  if exists(select 1 from public.rms_members where research_id=rid and user_id=target and status in ('active','pending')) then raise exception '이미 초대했거나 참여 중인 계정입니다.' using errcode='22023'; end if;
  insert into public.rms_members(research_id,user_id,role,status,invited_by) values(rid,target,'editor','pending',who) on conflict(research_id,user_id) do update set status='pending',invited_by=who;
  insert into public.rms_events(research_id,recipient_id,actor_id,title,message,href,kind) values(rid,target,who,'공동연구 초대',(select data->>'name' from public.rms_researches where id=rid),'/r?view=invitations','invite');
 elsif action='remove' then
  target:=(p_input->>'userId')::uuid; if target=own then raise exception '소유자는 해제할 수 없습니다.' using errcode='22023'; end if;
  update public.rms_members set status='revoked' where research_id=rid and user_id=target;
 else raise exception '참여자 동작을 확인해 주세요.' using errcode='22023'; end if;
end $$;
create function public.rms_mark_event(p_id uuid default null) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ begin perform public.rms_assert_session(); update public.rms_events set read_at=clock_timestamp() where recipient_id=auth.uid() and (p_id is null or id=p_id); end $$;
create function public.rms_poll_json(p_id uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public,auth as $$ select p.data||jsonb_build_object('id',p.id,'researchId',p.research_id,'organizerId',p.organizer_id,'researchName',r.data->>'name','status',p.status,'meetingId',p.meeting_id,'updatedAt',p.updated_at,'participants',(select coalesce(jsonb_agg(jsonb_build_object('userId',u.id,'name',coalesce(u.raw_user_meta_data->>'name',split_part(u.email,'@',1)),'email',u.email,'available',v.available)),'[]') from public.rms_poll_participants v join auth.users u on u.id=v.user_id where v.poll_id=p.id)) from public.rms_polls p join public.rms_researches r on r.id=p.research_id where p.id=p_id $$;
create function public.rms_poll_action(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare who uuid:=public.rms_assert_session(); action text:=p_input->>'action'; rid uuid; pid uuid; p public.rms_polls; opt jsonb; target uuid; candidate_email text; meeting jsonb; option_ids jsonb;
begin
 if action='create' then
  rid:=(p_input->>'researchId')::uuid; if not public.rms_can_edit_research(rid) then raise exception '접근할 수 없습니다.' using errcode='42501'; end if;
  perform public.rms_required_text(p_input,'title',200);
  if jsonb_typeof(p_input->'options') is distinct from 'array' or jsonb_array_length(p_input->'options') not between 1 and 12 or jsonb_typeof(p_input->'emails') is distinct from 'array' or jsonb_array_length(p_input->'emails') not between 1 and 20 then raise exception '후보 시간과 참여자를 확인해 주세요.' using errcode='22023'; end if;
  for opt in select jsonb_array_elements(p_input->'options') loop
   perform (opt->>'id')::uuid;
   if (opt->>'start')::timestamptz >= (opt->>'end')::timestamptz or (opt->>'end')::timestamptz-(opt->>'start')::timestamptz>interval '12 hours' then raise exception '후보 시작·종료 시각을 확인해 주세요.' using errcode='22023'; end if;
  end loop;
  insert into public.rms_polls(research_id,organizer_id,data) values(rid,who,jsonb_build_object('title',p_input->>'title','options',p_input->'options')) returning id into pid;
  insert into public.rms_poll_participants(poll_id,user_id) values(pid,who);
  for candidate_email in select jsonb_array_elements_text(p_input->'emails') loop
   select u.id into target from auth.users u join public.rms_demo_accounts a on a.user_id=u.id and a.active where lower(u.email)=lower(btrim(candidate_email));
   if target is null then raise exception '등록된 참여자 계정을 입력해 주세요.' using errcode='22023'; end if;
   insert into public.rms_poll_participants(poll_id,user_id) values(pid,target) on conflict do nothing;
   if target<>who then insert into public.rms_events(research_id,recipient_id,actor_id,title,message,href,kind) values(rid,target,who,'미팅 시간을 골라 주세요',p_input->>'title','/schedule/'||pid::text,'schedule'); end if;
  end loop;
 else
  pid:=coalesce(p_input->>'id',p_input->>'pollId')::uuid; select * into p from public.rms_polls where id=pid for update; rid:=p.research_id;
  if p.id is null or exists(select 1 from public.rms_researches where id=rid and nullif(data->>'deletedAt','') is not null) then raise exception '일정에 접근할 수 없습니다.' using errcode='42501'; end if;
  if action='respond' then
   if p.status<>'open' or not exists(select 1 from public.rms_poll_participants where poll_id=pid and user_id=who) then raise exception '시간 응답 권한이 없습니다.' using errcode='42501'; end if;
   if jsonb_typeof(p_input->'available') is distinct from 'array' then raise exception '가능한 시간을 선택해 주세요.' using errcode='22023'; end if;
   select jsonb_agg(x->>'id') into option_ids from jsonb_array_elements(p.data->'options') x;
   if not option_ids @> (p_input->'available') then raise exception '제안된 시간만 선택해 주세요.' using errcode='22023'; end if;
   update public.rms_poll_participants set available=p_input->'available' where poll_id=pid and user_id=who;
  elsif action in ('confirm','cancel') then
   if not public.rms_can_edit_research(rid) or (p.organizer_id<>who and not public.rms_owns_research(rid)) then raise exception '생성자 또는 연구 소유자만 확정할 수 있습니다.' using errcode='42501'; end if;
   if p.status='confirmed' and action='confirm' then return public.rms_poll_json(pid); end if;
   if action='cancel' then update public.rms_polls set status='cancelled',updated_at=clock_timestamp() where id=pid;
   else
    if p.status<>'open' then raise exception '조율 중인 일정에서 확정해 주세요.' using errcode='22023'; end if;
    select x into opt from jsonb_array_elements(p.data->'options') x where x->>'id'=p_input->>'optionId'; if opt is null then raise exception '후보 시간을 선택해 주세요.' using errcode='22023'; end if;
    meeting:=public.rms_save_record('meetings',jsonb_build_object('id',gen_random_uuid(),'researchId',rid,'title',p.data->>'title','date',to_char((opt->>'start')::timestamptz at time zone 'Asia/Seoul','YYYY-MM-DD'),'time',to_char((opt->>'start')::timestamptz at time zone 'Asia/Seoul','HH24:MI'),'status','preparing','memo','','goal','','visibility','shared','taskIds','[]'::jsonb,'versionIds','[]'::jsonb,'questionIds','[]'::jsonb));
    update public.rms_polls set status='confirmed',meeting_id=(meeting->>'id')::uuid,data=data||jsonb_build_object('selectedOptionId',opt->>'id'),updated_at=clock_timestamp() where id=pid;
   end if;
   insert into public.rms_events(research_id,recipient_id,actor_id,title,message,href,kind) select rid,user_id,who,case when action='confirm' then '미팅 시간이 확정되었습니다' else '시간 조율이 취소되었습니다' end,p.data->>'title','/schedule/'||pid::text,'schedule' from public.rms_poll_participants where poll_id=pid and user_id<>who;
  else raise exception '일정 동작을 확인해 주세요.' using errcode='22023'; end if;
 end if;
 return public.rms_poll_json(pid);
end $$;
create function public.rms_cancel_ai(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$ begin perform public.rms_assert_session(); update public.rms_ai_runs set status='cancelled',completed_at=clock_timestamp() where id=p_id and user_id=auth.uid() and status='running'; end $$;
''')
# Bootstrap never broadens private records to collaborators.
parts.append(r'''
create or replace function public.rms_bootstrap() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
declare v jsonb; k text;
begin
 perform public.rms_assert_session();
 v:=jsonb_build_object('researches',(select coalesce(jsonb_agg(data order by updated_at desc),'[]') from public.rms_researches where owner_id=auth.uid() or public.rms_can_edit_research(id)));
 foreach k in array array['meetings','feedback','plans','tasks','questions','decisions','materials','versions','results','documents','documentVersions','folders','phases','milestones','recordings','conversations','attachments','aiCandidates'] loop
  v:=v||jsonb_build_object(k,(select coalesce(jsonb_agg(case when k='feedback' then r.data||jsonb_build_object('notes',coalesce((select n.data->>'body' from public.rms_records n where n.kind='privateNotes' and n.data->>'recordId'=r.id::text and n.data->>'createdBy'=auth.uid()::text),'')) else r.data end order by r.created_at),'[]') from public.rms_records r where r.kind=k and public.rms_can_read_record(r.id)));
 end loop;
 v:=jsonb_set(v,'{versions}',(v->'versions')||(select coalesce(jsonb_agg(distinct rr.snapshot->'version'),'[]') from public.rms_review_rounds rr join public.rms_review_requests q on q.id=rr.request_id where q.professor_id=auth.uid() and q.status='shared' and public.rms_can_read_request(q.id) and rr.snapshot->'version' is not null));
 return v||jsonb_build_object(
 'members',(select coalesce(jsonb_agg(jsonb_build_object('researchId',m.research_id,'userId',m.user_id,'role',m.role,'status',m.status,'name',coalesce(u.raw_user_meta_data->>'name',split_part(u.email,'@',1)),'email',u.email,'invitedBy',m.invited_by)),'[]') from public.rms_members m join auth.users u on u.id=m.user_id where m.status<>'revoked' and (m.user_id=auth.uid() or public.rms_can_edit_research(m.research_id))),
 'polls',(select coalesce(jsonb_agg(public.rms_poll_json(p.id)),'[]') from public.rms_polls p where not exists(select 1 from public.rms_researches r where r.id=p.research_id and nullif(r.data->>'deletedAt','') is not null) and (public.rms_can_edit_research(p.research_id) or exists(select 1 from public.rms_poll_participants pp where pp.poll_id=p.id and pp.user_id=auth.uid()))),
 'events',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',e.id,'researchId',e.research_id,'actorId',e.actor_id,'actorName',coalesce(u.raw_user_meta_data->>'name',split_part(u.email,'@',1)),'title',e.title,'message',e.message,'href',e.href,'kind',e.kind,'createdAt',e.created_at,'readAt',e.read_at)) order by e.created_at desc),'[]') from public.rms_events e join auth.users u on u.id=e.actor_id where e.recipient_id=auth.uid() and (public.rms_can_edit_research(e.research_id) or (e.kind='invite' and exists(select 1 from public.rms_members m where m.research_id=e.research_id and m.user_id=auth.uid() and m.status='pending')) or(e.kind='schedule' and exists(select 1 from public.rms_polls p join public.rms_poll_participants pp on pp.poll_id=p.id join public.rms_researches r on r.id=p.research_id where p.research_id=e.research_id and pp.user_id=auth.uid() and nullif(r.data->>'deletedAt','') is null))) and (e.record_id is null or public.rms_can_read_record(e.record_id))),
 'aiRuns',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'researchId',research_id,'userId',user_id,'mode',mode,'model',model,'thinking',thinking,'status',status,'createdAt',created_at,'completedAt',completed_at,'error',error)) order by created_at desc),'[]') from public.rms_ai_runs where user_id=auth.uid() and public.rms_can_edit_research(research_id)),
 'reviews',(select coalesce(jsonb_agg(public.rms_request_json(r) order by r.updated_at desc),'[]') from public.rms_review_requests r where public.rms_can_read_request(r.id)),
 'reviewItems',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'requestId',i.request_id,'resultId',i.result_id,'title',i.title)),'[]') from public.rms_review_items i where public.rms_can_read_request(i.request_id)),
 'rounds',(select coalesce(jsonb_agg((rr.snapshot-'version')||jsonb_build_object('id',rr.id,'requestId',rr.request_id,'itemId',rr.item_id,'number',rr.number,'createdAt',rr.created_at) order by rr.number),'[]') from public.rms_review_rounds rr where public.rms_can_read_request(rr.request_id)),
 'responses',(select coalesce(jsonb_agg(public.rms_response_json(r)),'[]') from public.rms_review_responses r where public.rms_can_read_round(r.round_id)),
 'comments',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',c.id,'roundId',c.round_id,'userId',c.user_id,'authorName',c.author_name,'body',c.body,'parentId',c.parent_id,'resolved',c.resolved,'createdAt',c.created_at)) order by c.created_at),'[]') from public.rms_review_comments c where public.rms_can_read_round(c.round_id)),
 'reads',(select coalesce(jsonb_agg(jsonb_build_object('roundId',r.round_id,'userId',r.user_id,'lastSeenAt',r.last_seen_at)),'[]') from public.rms_review_reads r where r.user_id=auth.uid() and public.rms_can_read_round(r.round_id)));
end $$;
-- RLS remains read-only for the browser; all writes go through validated RPCs.
drop policy records_owner_read on public.rms_records;
create policy records_allowed_read on public.rms_records for select to authenticated using(public.rms_can_read_record(id));
drop policy researches_owner_read on public.rms_researches;
create policy researches_allowed_read on public.rms_researches for select to authenticated using(public.rms_owns_research(id) or public.rms_can_edit_research(id));
alter table public.rms_members enable row level security;
alter table public.rms_events enable row level security;
alter table public.rms_polls enable row level security;
alter table public.rms_poll_participants enable row level security;
revoke all on public.rms_members,public.rms_events,public.rms_polls,public.rms_poll_participants from public,anon,authenticated;
grant all on public.rms_members,public.rms_events,public.rms_polls,public.rms_poll_participants to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('research-private','research-private',false,52428800,array['audio/webm','audio/mp4','audio/ogg','application/pdf','text/plain','text/markdown']) on conflict(id) do nothing;
drop policy rms_files_upload on storage.objects;
create policy rms_files_upload on storage.objects for insert to authenticated with check(bucket_id='research-files' and public.rms_is_allowed() and split_part(name,'/',1)=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and public.rms_can_edit_research(split_part(name,'/',2)::uuid));
create policy rms_private_upload on storage.objects for insert to authenticated with check(bucket_id='research-private' and public.rms_is_allowed() and split_part(name,'/',1)=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|mp4|ogg|pdf|txt|md)$' and public.rms_can_edit_research(split_part(name,'/',2)::uuid));
create policy rms_private_read on storage.objects for select to authenticated using(bucket_id='research-private' and public.rms_can_read_file(name));
create policy rms_private_orphan_delete on storage.objects for delete to authenticated using(bucket_id='research-private' and public.rms_is_allowed() and split_part(name,'/',1)=auth.uid()::text and not exists(select 1 from public.rms_records r where r.data->>'storagePath'=name));
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rms_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature); execute format('grant execute on function %s to service_role',f.signature); end loop; end $$;
grant execute on function public.rms_is_allowed(),public.rms_owns_research(uuid),public.rms_can_edit_research(uuid),public.rms_can_read_record(uuid),public.rms_can_read_request(uuid),public.rms_can_read_round(uuid),public.rms_can_read_file(text) to authenticated;
grant execute on function public.rms_bootstrap(),public.rms_save_research(jsonb),public.rms_save_record(text,jsonb),public.rms_delete_record(text,uuid),public.rms_save_preparation(jsonb,jsonb),public.rms_create_review(jsonb),public.rms_recheck(jsonb),public.rms_respond(jsonb),public.rms_comment(jsonb),public.rms_resolve_comment(uuid,boolean),public.rms_set_sharing(jsonb),public.rms_mark_read(uuid),public.rms_response_history(uuid),public.rms_member_action(jsonb),public.rms_mark_event(uuid),public.rms_poll_action(jsonb),public.rms_cancel_ai(uuid) to authenticated;
grant execute on function public.rms_ai_usage() to authenticated;
''')
(root/'20261104120000_experience_expansion.sql').write_text('\n\n'.join(parts))
print('Additive migration generated')
