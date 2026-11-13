-- 누구나 가입: 이메일을 확인한 계정은 초대 없이도 허용 목록(rms_demo_accounts)에 들어갑니다.
-- 초대 링크(rms_redeem_invite)는 그대로 두고, 중지된 계정은 여기서도 되살리지 않습니다.
create function public.rms_join() returns boolean language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare me uuid:=auth.uid(); state boolean;
begin
  if me is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  select a.active into state from public.rms_demo_accounts a where a.user_id=me;
  if found then
    if state then return true; end if;
    raise exception '사용이 중지된 계정입니다.' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users u where u.id=me and u.email_confirmed_at is not null) then raise exception '이메일 확인을 먼저 마쳐 주세요.' using errcode='42501'; end if;
  insert into public.rms_demo_accounts(user_id) values(me) on conflict(user_id) do nothing;
  return true;
end $$;

revoke all on function public.rms_join() from public,anon;

grant execute on function public.rms_join() to authenticated;
