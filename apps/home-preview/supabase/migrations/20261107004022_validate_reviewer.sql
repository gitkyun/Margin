-- Validate the recipient at preview time using the same rules as publication.
create function public.rms_validate_reviewer(p_research_id uuid, p_email text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
  perform public.rms_assert_session();
  if not public.rms_can_edit_research(p_research_id) then
    raise exception '이 연구의 검토 요청을 준비할 수 없습니다.' using errcode='42501';
  end if;
  perform public.rms_professor_id(p_email);
  return true;
end $$;
revoke all on function public.rms_validate_reviewer(uuid,text) from public,anon;
grant execute on function public.rms_validate_reviewer(uuid,text) to authenticated;
