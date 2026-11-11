-- 초대 링크로만 가입: 초대 코드를 쓴 계정만 허용 목록(rms_demo_accounts)에 들어갑니다.
-- 호스팅에서 공개 가입을 켜도, 초대 코드를 쓰지 않은 계정은 rms_is_allowed()를 통과하지 못합니다.
create table public.rms_invites(code text primary key check(code ~ '^[0-9a-f]{32}$'),created_by uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz);

create index rms_invites_owner on public.rms_invites(created_by,created_at desc);

create table public.rms_invite_uses(user_id uuid primary key references auth.users(id) on delete cascade,code text not null references public.rms_invites(code) on delete cascade,used_at timestamptz not null default now());

create index rms_invite_uses_code on public.rms_invite_uses(code);

alter table public.rms_invites enable row level security;

alter table public.rms_invite_uses enable row level security;

revoke all on public.rms_invites,public.rms_invite_uses from public,anon,authenticated;

grant all on public.rms_invites,public.rms_invite_uses to service_role;

-- 초대 하나로 가입할 수 있는 사람 수와 유효 기간. 연구실 안에서 돌려 쓰는 링크를 기준으로 잡았습니다.
-- 초대를 만든 계정이 중지되면 그 계정의 초대도 함께 닫힙니다.
create function public.rms_invite_open(p_code text) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select exists(select 1 from public.rms_invites i where i.code=btrim(coalesce(p_code,'')) and i.revoked_at is null and i.expires_at>now() and exists(select 1 from public.rms_demo_accounts a where a.user_id=i.created_by and a.active) and (select count(*) from public.rms_invite_uses u where u.code=i.code)<30) $$;

revoke all on function public.rms_invite_open(text) from public,anon,authenticated;

-- 가입 화면이 폼을 보여 주기 전에 초대가 유효한지 묻습니다. 로그인 전에 부르므로 anon에게도 엽니다.
create function public.rms_check_invite(p_code text) returns boolean language sql stable security definer set search_path=pg_catalog,public,auth as $$ select public.rms_invite_open(p_code) $$;

revoke all on function public.rms_check_invite(text) from public;

grant execute on function public.rms_check_invite(text) to anon,authenticated;

-- 허용된 계정이 초대 링크를 만듭니다. 아직 쓸 수 있는 내 초대가 있으면 그것을 다시 줍니다.
create function public.rms_create_invite() returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=public.rms_assert_session(); v public.rms_invites;
begin
  select i.* into v from public.rms_invites i where i.created_by=me and i.expires_at>now()+interval '1 day' and public.rms_invite_open(i.code) order by i.created_at desc limit 1;
  if not found then
    insert into public.rms_invites(code,created_by,expires_at) values(replace(gen_random_uuid()::text,'-',''),me,now()+interval '14 days') returning * into v;
  end if;
  return jsonb_build_object('code',v.code,'expiresAt',v.expires_at);
end $$;

revoke all on function public.rms_create_invite() from public,anon;

grant execute on function public.rms_create_invite() to authenticated;

-- 가입한 계정이 초대 코드를 써서 허용 목록에 들어갑니다. 중지된 계정은 초대로 되살리지 않습니다.
create function public.rms_redeem_invite(p_code text) returns boolean language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=auth.uid(); state boolean; v public.rms_invites;
begin
  if me is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  select a.active into state from public.rms_demo_accounts a where a.user_id=me;
  if found then
    if state then return true; end if;
    raise exception '사용이 중지된 계정입니다.' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users u where u.id=me and u.email_confirmed_at is not null) then raise exception '이메일 확인을 먼저 마쳐 주세요.' using errcode='42501'; end if;
  select i.* into v from public.rms_invites i where i.code=btrim(coalesce(p_code,'')) for update;
  if not found or not public.rms_invite_open(v.code) then raise exception '초대 링크가 만료됐거나 올바르지 않습니다.' using errcode='22023'; end if;
  -- 같은 계정이 두 탭에서 동시에 부른 경우: 잠금을 기다리는 사이 이미 들어갔으면 그대로 끝냅니다.
  if exists(select 1 from public.rms_demo_accounts a where a.user_id=me and a.active) then return true; end if;
  insert into public.rms_invite_uses(user_id,code) values(me,v.code) on conflict(user_id) do nothing;
  insert into public.rms_demo_accounts(user_id) values(me) on conflict(user_id) do nothing;
  return true;
end $$;

revoke all on function public.rms_redeem_invite(text) from public,anon;

grant execute on function public.rms_redeem_invite(text) to authenticated;
