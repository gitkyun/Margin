-- 할 일 ↔ 글쓰기 문서 연결(tasks.data.documentId)을 서버에서 확인합니다.
-- 저장 함수(rms_save_record)는 그대로 두고, 할 일 기록이 쓰일 때만 도는 트리거를 추가합니다.
-- 규칙
--  * documentId가 있으면 같은 연구의 문서 기록이어야 합니다.
--  * 연결을 새로 걸거나 바꿀 때는 저장하는 사람이 그 문서를 읽을 수 있어야 하고, 보관된 문서는 고를 수 없습니다.
--  * 이미 걸린 연결을 그대로 둔 채 다른 칸만 고치는 저장은 막지 않습니다(문서가 나중에 보관돼도 할 일은 계속 고칠 수 있음).
-- 문서는 지우지 않고 보관만 하므로(rms_delete_record), 연결이 가리키는 기록은 사라지지 않습니다.
create function public.rms_check_task_document() returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_doc_text text:=nullif(new.data->>'documentId',''); v_doc public.rms_records; v_changed boolean;
begin
 if new.kind<>'tasks' or v_doc_text is null then return new; end if;
 if v_doc_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception '연결할 문서를 확인해 주세요.' using errcode='22023'; end if;
 select * into v_doc from public.rms_records where id=v_doc_text::uuid and kind='documents';
 if v_doc.id is null or v_doc.research_id<>new.research_id then raise exception '연결할 문서를 확인해 주세요.' using errcode='22023'; end if;
 -- 저장 함수는 insert … on conflict로 쓰므로 BEFORE INSERT도 기존 할 일에서 불립니다. 저장된 값과 비교합니다.
 if tg_op='UPDATE' then v_changed:=(old.data->>'documentId') is distinct from (new.data->>'documentId');
 else v_changed:=not exists(select 1 from public.rms_records r where r.id=new.id and r.data->>'documentId' is not distinct from new.data->>'documentId'); end if;
 if v_changed then
  if auth.uid() is null or not public.rms_record_access(v_doc.id,auth.uid()) then raise exception '연결할 문서를 볼 수 없습니다.' using errcode='42501'; end if;
  if nullif(v_doc.data->>'archivedAt','') is not null then raise exception '보관된 문서는 연결할 수 없습니다.' using errcode='22023'; end if;
 end if;
 return new;
end $$;
revoke all on function public.rms_check_task_document() from public,anon,authenticated;
create trigger rms_task_document_link before insert or update of data on public.rms_records for each row execute function public.rms_check_task_document();
