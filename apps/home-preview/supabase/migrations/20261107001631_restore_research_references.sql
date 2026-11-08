-- Validate preserved links for the owner while the research is still in trash.
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
 if nullif(p_value->>'nextMeetingId','') is not null then if old.owner_id=v_uid and nullif(old.data->>'deletedAt','') is not null then
   if not exists(select 1 from public.rms_records where id=(p_value->>'nextMeetingId')::uuid and research_id=v_id and kind='meetings') then raise exception '연결할 기록을 찾을 수 없습니다.' using errcode='22023'; end if;
  else perform public.rms_require_record((p_value->>'nextMeetingId')::uuid,v_id,'meetings'); end if; end if;
 if nullif(p_value->>'currentPhaseId','') is not null then if old.owner_id=v_uid and nullif(old.data->>'deletedAt','') is not null then
   if not exists(select 1 from public.rms_records where id=(p_value->>'currentPhaseId')::uuid and research_id=v_id and kind='phases') then raise exception '연결할 기록을 찾을 수 없습니다.' using errcode='22023'; end if;
  else perform public.rms_require_record((p_value->>'currentPhaseId')::uuid,v_id,'phases'); end if; end if;
 v:=(p_value-'ownerId'-'createdAt'-'updatedAt')||jsonb_build_object('id',v_id,'ownerId',coalesce(old.owner_id,v_uid),'createdAt',coalesce(old.created_at,stamp),'updatedAt',stamp);
 insert into public.rms_researches(id,owner_id,data) values(v_id,coalesce(old.owner_id,v_uid),v) on conflict(id) do update set data=excluded.data,updated_at=stamp;
 insert into public.rms_members(research_id,user_id,role,status) values(v_id,coalesce(old.owner_id,v_uid),'owner','active') on conflict do nothing;
 if nullif(v->>'deletedAt','') is not null then update public.rms_review_requests set status='stopped',updated_at=stamp where research_id=v_id and status<>'stopped'; end if;
 return v;
end $$;
