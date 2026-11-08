-- Assign preserved-file version numbers on the server, under a per-material lock.
create or replace function public.rms_save_record(p_kind text,p_value jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,storage as $$
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
   if (p_value-'createdAt'-'updatedAt'-'number')=(v_old.data-'createdAt'-'updatedAt'-'number') then return v_old.data; end if;
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
  -- Serialize per material, so stale clients cannot reuse the same version label.
  perform pg_advisory_xact_lock(hashtextextended(v_research::text||':'||(v->>'materialId'),0));
  v:=v||jsonb_build_object('number',(select coalesce(max((r.data->>'number')::integer),0)+1 from public.rms_records r where r.kind='versions' and r.research_id=v_research and r.data->>'materialId'=v->>'materialId'));
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
