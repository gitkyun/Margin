-- 연구 초대 메일: 아직 가입하지 않은 사람도 이메일로 연구에 초대합니다.
-- 초대 링크의 토큰은 서버 함수(project-invite)가 만들고, DB에는 SHA-256 해시만 둡니다.
-- 수락은 (1) 토큰을 가진 사람이 (2) 초대받은 이메일로 로그인했을 때만 됩니다.
-- 역할: editor = 공동연구자(연구 멤버십을 만듦), advisor = 지도교수(계정만 허용. 연구 멤버가 되지 않고
-- 기존처럼 검토 요청으로 지정된 항목만 봄).
-- 메일 발송 상태(email_status)는 초대 상태(status)와 따로 둡니다. 'sent'는 메일 서비스가 발송 요청을
-- 받았다는 뜻일 뿐, 받은편지함 도착이나 초대 수락을 뜻하지 않습니다.
create table public.rms_project_invites(
 id uuid primary key default gen_random_uuid(),
 research_id uuid not null references public.rms_researches(id) on delete cascade,
 email text not null check(email=lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email)<=254),
 role text not null check(role in ('editor','advisor')),
 invited_by uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz,
 email_status text not null default 'queued' check(email_status in ('queued','sent','failed')),
 email_id text,
 email_error text,
 last_sent_at timestamptz not null default now(),
 send_count integer not null default 1 check(send_count>0)
);

-- 같은 연구에 같은 이메일로 열려 있는 초대는 하나만 둡니다.
create unique index rms_project_invites_open on public.rms_project_invites(research_id,email) where status='pending';

create index rms_project_invites_research on public.rms_project_invites(research_id,created_at desc);

create index rms_project_invites_sender on public.rms_project_invites(invited_by,last_sent_at desc);

create index rms_project_invites_accepted_by on public.rms_project_invites(accepted_by) where accepted_by is not null;

alter table public.rms_project_invites enable row level security;

revoke all on public.rms_project_invites from public,anon,authenticated;

grant all on public.rms_project_invites to service_role;

create function public.rms_project_invite_hash(p_token text) returns text language sql immutable set search_path=pg_catalog as $$ select encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex') $$;

revoke all on function public.rms_project_invite_hash(text) from public,anon,authenticated;

-- 이 역할로 초대할 수 있는지. 공동연구자는 소유자만(기존 참여자 관리와 같음),
-- 지도교수는 소유자와 활성 참여자(기존 지도교수 목록 편집과 같음)가 초대합니다.
create function public.rms_project_invite_allowed(p_research uuid,p_user uuid,p_role text) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$
 select public.rms_member_access(p_research,p_user) and (p_role='advisor' or exists(select 1 from public.rms_researches r where r.id=p_research and r.owner_id=p_user)) $$;

revoke all on function public.rms_project_invite_allowed(uuid,uuid,text) from public,anon,authenticated;

create function public.rms_project_invite_json(v public.rms_project_invites) returns jsonb language sql stable security definer set search_path=pg_catalog,public,auth as $$
 select jsonb_build_object('id',v.id,'researchId',v.research_id,'email',v.email,'role',v.role,
  'status',case when v.status='pending' and v.expires_at<=now() then 'expired' else v.status end,
  'createdAt',v.created_at,'expiresAt',v.expires_at,'acceptedAt',v.accepted_at,'revokedAt',v.revoked_at,
  'emailStatus',v.email_status,'lastSentAt',v.last_sent_at,'sendCount',v.send_count,'invitedBy',v.invited_by,
  'invitedByName',(select coalesce(nullif(u.raw_user_meta_data->>'name',''),split_part(u.email,'@',1)) from auth.users u where u.id=v.invited_by),
  'researchName',(select r.data->>'name' from public.rms_researches r where r.id=v.research_id)) $$;

revoke all on function public.rms_project_invite_json(public.rms_project_invites) from public,anon,authenticated;

-- 보내는 사람 한 명이 하루에 보낼 수 있는 초대 메일 수(재발송 포함).
create function public.rms_project_invite_quota(p_user uuid) returns void language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
begin
 if (select coalesce(sum(least(i.send_count,5)),0) from public.rms_project_invites i where i.invited_by=p_user and i.last_sent_at>now()-interval '1 day')>=20 then
  raise exception '오늘 보낼 수 있는 초대 메일을 모두 보냈습니다. 내일 다시 시도해 주세요.' using errcode='53400';
 end if;
end $$;

revoke all on function public.rms_project_invite_quota(uuid) from public,anon,authenticated;

-- 초대를 만듭니다. 서버 함수가 사용자 권한으로 부르고, 돌려받은 정보로 메일을 보냅니다.
create function public.rms_project_invite_create(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=public.rms_assert_session(); rid uuid:=(p_input->>'researchId')::uuid; v_role text:=p_input->>'role';
 v_email text:=lower(btrim(coalesce(p_input->>'email',''))); v_hash text:=p_input->>'tokenHash'; target uuid; v public.rms_project_invites;
begin
 if v_role is null or v_role not in ('editor','advisor') then raise exception '초대할 역할을 확인해 주세요.' using errcode='22023'; end if;
 if v_hash is null or v_hash !~ '^[0-9a-f]{64}$' then raise exception '초대를 만들지 못했습니다. 다시 시도해 주세요.' using errcode='22023'; end if;
 if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email)>254 then raise exception '이메일 주소를 확인해 주세요.' using errcode='22023'; end if;
 if rid is null or not exists(select 1 from public.rms_researches r where r.id=rid and nullif(r.data->>'deletedAt','') is null) or not public.rms_project_invite_allowed(rid,me,v_role) then
  raise exception '이 연구에 초대할 권한이 없습니다.' using errcode='42501';
 end if;
 if v_email=(select lower(u.email) from auth.users u where u.id=me) then raise exception '내 이메일로는 초대할 수 없습니다.' using errcode='22023'; end if;
 select u.id into target from auth.users u join public.rms_demo_accounts a on a.user_id=u.id and a.active where lower(u.email)=v_email limit 1;
 if v_role='editor' and target is not null and (exists(select 1 from public.rms_researches r where r.id=rid and r.owner_id=target) or exists(select 1 from public.rms_members m where m.research_id=rid and m.user_id=target and m.status='active')) then
  raise exception '이미 이 연구에 참여하고 있는 사람입니다.' using errcode='22023';
 end if;
 if v_role='advisor' and target is not null then raise exception '이미 마진을 쓰고 있는 이메일입니다. 검토 요청을 바로 보낼 수 있습니다.' using errcode='22023'; end if;
 perform public.rms_project_invite_quota(me);
 select i.* into v from public.rms_project_invites i where i.research_id=rid and i.email=v_email and i.status='pending' for update;
 if found then
  if v.expires_at>now() then raise exception '이미 초대한 이메일입니다. 초대 목록에서 다시 보낼 수 있습니다.' using errcode='22023'; end if;
  -- 만료된 초대는 닫고 새로 만듭니다. 이전 링크는 계속 쓸 수 없습니다.
  update public.rms_project_invites set status='revoked',revoked_at=now() where id=v.id;
 end if;
 insert into public.rms_project_invites(research_id,email,role,invited_by,token_hash,expires_at) values(rid,v_email,v_role,me,v_hash,now()+interval '7 days') returning * into v;
 return public.rms_project_invite_json(v);
end $$;

revoke all on function public.rms_project_invite_create(jsonb) from public,anon;

grant execute on function public.rms_project_invite_create(jsonb) to authenticated;

-- 다시 보내기: 새 토큰으로 바꾸고 유효 기간을 다시 7일로 잡습니다. 이전 링크는 쓸 수 없게 됩니다.
create function public.rms_project_invite_resend(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=public.rms_assert_session(); v_hash text:=p_input->>'tokenHash'; v public.rms_project_invites;
begin
 if v_hash is null or v_hash !~ '^[0-9a-f]{64}$' then raise exception '초대를 다시 보내지 못했습니다. 다시 시도해 주세요.' using errcode='22023'; end if;
 select i.* into v from public.rms_project_invites i where i.id=(p_input->>'id')::uuid for update;
 if not found or not public.rms_project_invite_allowed(v.research_id,me,v.role) or (v.invited_by<>me and not exists(select 1 from public.rms_researches r where r.id=v.research_id and r.owner_id=me))
  or exists(select 1 from public.rms_researches r where r.id=v.research_id and nullif(r.data->>'deletedAt','') is not null) then
  raise exception '이 초대를 관리할 권한이 없습니다.' using errcode='42501';
 end if;
 if v.status<>'pending' then raise exception '이미 수락했거나 취소한 초대입니다.' using errcode='22023'; end if;
 if v.last_sent_at>now()-interval '1 minute' then raise exception '방금 보냈습니다. 1분 뒤에 다시 보낼 수 있습니다.' using errcode='53400'; end if;
 if v.send_count>=5 then raise exception '이 초대는 더 보낼 수 없습니다. 취소한 뒤 새로 초대해 주세요.' using errcode='53400'; end if;
 perform public.rms_project_invite_quota(me);
 update public.rms_project_invites set token_hash=v_hash,expires_at=now()+interval '7 days',email_status='queued',email_id=null,email_error=null,last_sent_at=now(),send_count=send_count+1 where id=v.id returning * into v;
 return public.rms_project_invite_json(v);
end $$;

revoke all on function public.rms_project_invite_resend(jsonb) from public,anon;

grant execute on function public.rms_project_invite_resend(jsonb) to authenticated;

-- 취소: 초대한 사람이나 연구 소유자가 합니다. 이미 수락한 초대는 참여자 목록에서 접근을 해제합니다.
create function public.rms_project_invite_revoke(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=public.rms_assert_session(); v public.rms_project_invites;
begin
 select i.* into v from public.rms_project_invites i where i.id=p_id for update;
 if not found or not public.rms_member_access(v.research_id,me) or (v.invited_by<>me and not exists(select 1 from public.rms_researches r where r.id=v.research_id and r.owner_id=me)) then
  raise exception '이 초대를 관리할 권한이 없습니다.' using errcode='42501';
 end if;
 if v.status='accepted' then raise exception '이미 수락한 초대입니다. 참여자 목록에서 접근을 해제해 주세요.' using errcode='22023'; end if;
 if v.status='pending' then update public.rms_project_invites set status='revoked',revoked_at=now() where id=v.id returning * into v; end if;
 return public.rms_project_invite_json(v);
end $$;

revoke all on function public.rms_project_invite_revoke(uuid) from public,anon;

grant execute on function public.rms_project_invite_revoke(uuid) to authenticated;

-- 연구의 초대 목록. 연구를 편집할 수 있는 사람(소유자·활성 참여자)이 봅니다.
create function public.rms_project_invite_list(p_research uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=public.rms_assert_session(); own boolean;
begin
 if not public.rms_member_access(p_research,me) then raise exception '이 연구의 초대를 볼 권한이 없습니다.' using errcode='42501'; end if;
 own:=exists(select 1 from public.rms_researches r where r.id=p_research and r.owner_id=me);
 return (select coalesce(jsonb_agg(public.rms_project_invite_json(i)||jsonb_build_object('canManage',own or i.invited_by=me) order by i.created_at desc),'[]'::jsonb)
  from public.rms_project_invites i where i.research_id=p_research and (i.status<>'revoked' or i.revoked_at>now()-interval '30 days'));
end $$;

revoke all on function public.rms_project_invite_list(uuid) from public,anon;

grant execute on function public.rms_project_invite_list(uuid) to authenticated;

-- 초대 링크를 연 사람에게 보여 줄 내용. 로그인 전에도 부르므로 anon에게 엽니다.
-- 토큰을 모르면 아무것도 돌려주지 않습니다.
create function public.rms_project_invite_preview(p_token text) returns jsonb language sql stable security definer set search_path=pg_catalog,public,auth as $$
 select jsonb_build_object('email',i.email,'role',i.role,'expiresAt',i.expires_at,
  'status',case when i.status='pending' and (nullif(r.data->>'deletedAt','') is not null or not public.rms_project_invite_allowed(i.research_id,i.invited_by,i.role)) then 'closed'
   when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
  'researchName',r.data->>'name',
  'invitedByName',(select coalesce(nullif(u.raw_user_meta_data->>'name',''),split_part(u.email,'@',1)) from auth.users u where u.id=i.invited_by))
 from public.rms_project_invites i join public.rms_researches r on r.id=i.research_id
 where length(coalesce(p_token,'')) between 32 and 128 and i.token_hash=public.rms_project_invite_hash(p_token) $$;

revoke all on function public.rms_project_invite_preview(text) from public;

grant execute on function public.rms_project_invite_preview(text) to anon,authenticated;

-- 초대 수락. 초대 상태 변경, 계정 허용, 연구 멤버십 생성을 한 트랜잭션에서 합니다.
-- 같은 계정이 여러 번 불러도 결과가 같습니다(행 잠금 + 이미 수락한 본인은 그대로 성공).
create function public.rms_project_invite_accept(p_token text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=auth.uid(); v public.rms_project_invites; v_email text; v_confirmed boolean; v_active boolean;
begin
 if me is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
 if length(coalesce(p_token,'')) not between 32 and 128 then raise exception '초대 링크가 올바르지 않습니다.' using errcode='22023'; end if;
 select i.* into v from public.rms_project_invites i where i.token_hash=public.rms_project_invite_hash(p_token) for update;
 if not found then raise exception '초대 링크가 올바르지 않습니다.' using errcode='22023'; end if;
 select lower(u.email),u.email_confirmed_at is not null into v_email,v_confirmed from auth.users u where u.id=me;
 if v_email is distinct from v.email then raise exception '초대받은 이메일로 로그인해 주세요.' using errcode='42501'; end if;
 if not coalesce(v_confirmed,false) then raise exception '이메일 확인을 먼저 마쳐 주세요.' using errcode='42501'; end if;
 select a.active into v_active from public.rms_demo_accounts a where a.user_id=me;
 if found and not v_active then raise exception '사용이 중지된 계정입니다.' using errcode='42501'; end if;
 if v.status='accepted' then
  if v.accepted_by is distinct from me then raise exception '이미 사용한 초대 링크입니다.' using errcode='22023'; end if;
  return jsonb_build_object('researchId',v.research_id,'role',v.role,'already',true);
 end if;
 if v.status='revoked' then raise exception '취소된 초대입니다. 초대한 사람에게 다시 요청해 주세요.' using errcode='22023'; end if;
 if v.expires_at<=now() then raise exception '초대 링크가 만료됐습니다. 초대한 사람에게 다시 요청해 주세요.' using errcode='22023'; end if;
 -- 초대한 사람이 그 사이 연구에서 빠졌거나 연구가 휴지통에 있으면 초대도 닫힙니다.
 if exists(select 1 from public.rms_researches r where r.id=v.research_id and nullif(r.data->>'deletedAt','') is not null) or not public.rms_project_invite_allowed(v.research_id,v.invited_by,v.role) then
  raise exception '지금은 수락할 수 없는 초대입니다. 초대한 사람에게 다시 요청해 주세요.' using errcode='22023';
 end if;
 insert into public.rms_demo_accounts(user_id) values(me) on conflict(user_id) do nothing;
 if v.role='editor' and not exists(select 1 from public.rms_researches r where r.id=v.research_id and r.owner_id=me) then
  insert into public.rms_members(research_id,user_id,role,status,invited_by) values(v.research_id,me,'editor','active',v.invited_by)
   on conflict(research_id,user_id) do update set status='active',invited_by=excluded.invited_by where public.rms_members.role<>'owner';
  perform public.rms_emit(v.research_id,null,'공동연구에 참여했습니다','','/r/'||v.research_id::text||'/settings?tab=members','member');
 end if;
 update public.rms_project_invites set status='accepted',accepted_at=now(),accepted_by=me where id=v.id;
 return jsonb_build_object('researchId',v.research_id,'role',v.role,'already',false);
end $$;

revoke all on function public.rms_project_invite_accept(text) from public,anon;

grant execute on function public.rms_project_invite_accept(text) to authenticated;

-- 메일 발송 결과 기록. 서버 함수만 service_role로 부릅니다.
-- 보낸 뒤에 토큰이 바뀌었으면(그 사이 다시 보냄) 옛 결과로 덮어쓰지 않습니다.
create function public.rms_project_invite_email_result(p_id uuid,p_token_hash text,p_status text,p_email_id text,p_error text) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
 if p_status not in ('sent','failed') then raise exception '발송 상태를 확인해 주세요.' using errcode='22023'; end if;
 update public.rms_project_invites set email_status=p_status,email_id=left(p_email_id,200),email_error=left(p_error,200) where id=p_id and token_hash=p_token_hash;
end $$;

revoke all on function public.rms_project_invite_email_result(uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.rms_project_invite_email_result(uuid,text,text,text,text) to service_role;
