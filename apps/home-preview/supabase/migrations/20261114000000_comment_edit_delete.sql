-- 검토 댓글 편집·삭제(감사 F6). 추가만 합니다: 열 두 개와 함수 두 개, rms_bootstrap 재정의.
-- 삭제는 줄을 지우지 않습니다. 답글이 달려 있을 수 있어 자리와 대화 순서는 남기고,
-- 본문만 비운 뒤 deleted_at을 남깁니다(화면은 '삭제한 댓글'로 보여 줍니다).
-- 교수의 '추가 수정 필요' 이유는 rms_review_responses에 따로 있어 영향을 받지 않습니다.
alter table public.rms_review_comments
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create or replace function public.rms_update_comment(p_id uuid,p_body text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_row public.rms_review_comments; v_body text:=btrim(coalesce(p_body,''));
begin
 perform public.rms_assert_session();
 select * into v_row from public.rms_review_comments where id=p_id for update;
 if v_row.id is null or v_row.user_id<>auth.uid() or not public.rms_can_read_round(v_row.round_id) then raise exception '내가 쓴 댓글만 고칠 수 있습니다.' using errcode='42501'; end if;
 if v_row.deleted_at is not null then raise exception '삭제한 댓글은 고칠 수 없습니다.' using errcode='22023'; end if;
 if length(v_body) not between 1 and 10000 then raise exception '댓글 내용을 입력해 주세요.' using errcode='22023'; end if;
 update public.rms_review_comments set body=v_body,edited_at=now() where id=p_id returning * into v_row;
 return jsonb_strip_nulls(jsonb_build_object('id',v_row.id,'roundId',v_row.round_id,'userId',v_row.user_id,'authorName',v_row.author_name,'body',v_row.body,'parentId',v_row.parent_id,'resolved',v_row.resolved,'createdAt',v_row.created_at,'editedAt',v_row.edited_at));
end $$;

create or replace function public.rms_delete_comment(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_row public.rms_review_comments;
begin
 perform public.rms_assert_session();
 select * into v_row from public.rms_review_comments where id=p_id for update;
 if v_row.id is null or v_row.user_id<>auth.uid() or not public.rms_can_read_round(v_row.round_id) then raise exception '내가 쓴 댓글만 삭제할 수 있습니다.' using errcode='42501'; end if;
 if v_row.deleted_at is not null then return; end if;
 -- body는 1자 이상이어야 해서(check) 자리 표시 글자를 남깁니다. 화면은 deleted_at으로 판단합니다.
 update public.rms_review_comments set body='(삭제한 댓글)',deleted_at=now() where id=p_id;
end $$;

revoke all on function public.rms_update_comment(uuid,text),public.rms_delete_comment(uuid) from public,anon;
grant execute on function public.rms_update_comment(uuid,text),public.rms_delete_comment(uuid) to authenticated,service_role;

-- 댓글에 editedAt·deletedAt을 함께 내려 줍니다. 나머지는 20261105011214 정의와 같습니다.
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
 'rounds',(select coalesce(jsonb_agg((rr.snapshot-'version')||jsonb_build_object('id',rr.id,'requestId',rr.request_id,'itemId',rr.item_id,'number',rr.number,'createdAt',rr.created_at,'createdBy',rr.created_by,'createdByName',(select coalesce(u.raw_user_meta_data->>'name',split_part(u.email,'@',1)) from auth.users u where u.id=rr.created_by)) order by rr.number),'[]') from public.rms_review_rounds rr where public.rms_can_read_request(rr.request_id)),
 'responses',(select coalesce(jsonb_agg(public.rms_response_json(r)),'[]') from public.rms_review_responses r where public.rms_can_read_round(r.round_id)),
 'comments',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',c.id,'roundId',c.round_id,'userId',c.user_id,'authorName',c.author_name,'body',c.body,'parentId',c.parent_id,'resolved',c.resolved,'createdAt',c.created_at,'editedAt',c.edited_at,'deletedAt',c.deleted_at)) order by c.created_at),'[]') from public.rms_review_comments c where public.rms_can_read_round(c.round_id)),
 'reads',(select coalesce(jsonb_agg(jsonb_build_object('roundId',r.round_id,'userId',r.user_id,'lastSeenAt',r.last_seen_at)),'[]') from public.rms_review_reads r where r.user_id=auth.uid() and public.rms_can_read_round(r.round_id)));
end $$;
