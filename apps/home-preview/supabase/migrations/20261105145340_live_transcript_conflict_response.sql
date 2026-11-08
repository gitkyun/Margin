-- Return a direct HTTP 409 for user editing conflicts, not a retryable transaction failure.
create or replace function public.rms_save_live_transcript(p_recording_id uuid,p_segments jsonb,p_text text,p_consent_at timestamptz,p_warnings jsonb,p_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare who uuid:=public.rms_assert_session(); r public.rms_records; t public.rms_live_transcripts; part jsonb; chars integer:=0;
begin
 -- One source lock serializes first-save retries without changing its audio.
 select * into r from public.rms_records where id=p_recording_id for update;
 if r.id is null or r.kind<>'recordings' or r.data->>'createdBy'<>who::text or not public.rms_can_read_record(r.id) or nullif(r.data->>'archivedAt','') is not null then
  raise exception '내 녹음에만 전사문을 저장할 수 있습니다.' using errcode='42501'; end if;
 if p_text is null or length(p_text)>100000 or jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments)>4000 or p_consent_at is null or p_consent_at>clock_timestamp()+interval '5 minutes' or jsonb_typeof(p_warnings) is distinct from 'array' or jsonb_array_length(p_warnings)>12 then
  raise exception '전사문 입력을 확인해 주세요.' using errcode='22023'; end if;
 for part in select value from jsonb_array_elements(p_segments) loop
  if jsonb_typeof(part) is distinct from 'object' or jsonb_typeof(part->'text') is distinct from 'string' or jsonb_typeof(part->'final') is distinct from 'boolean' or (part-'text'-'final')<>'{}'::jsonb then raise exception '음성 인식 원문 형식을 확인해 주세요.' using errcode='22023';end if;
  chars:=chars+length(part->>'text');
 end loop;
 if chars>100000 then raise exception '전사문이 너무 깁니다.' using errcode='22023'; end if;
 for part in select value from jsonb_array_elements(p_warnings) loop
  if jsonb_typeof(part) is distinct from 'string' or length(part#>>'{}')>500 then raise exception '인식 안내 형식을 확인해 주세요.' using errcode='22023'; end if;
 end loop;
 select * into t from public.rms_live_transcripts where recording_id=r.id and user_id=who for update;
 if t.id is null then
  if p_revision is distinct from 0 then raise exception '전사문을 다시 불러와 주세요.' using errcode='PT409';end if;
  insert into public.rms_live_transcripts(recording_id,research_id,user_id,raw_segments,edited_text,consent_at,warnings)
   values(r.id,r.research_id,who,p_segments,p_text,p_consent_at,p_warnings) returning * into t;
 else
  if t.raw_segments is distinct from p_segments or t.consent_at is distinct from p_consent_at or t.warnings is distinct from p_warnings then raise exception '처음 인식한 원문과 동의 기록은 변경할 수 없습니다.' using errcode='22023';end if;
  -- A lost response can be retried, but a different stale edit must conflict.
  if t.edited_text is distinct from p_text then
   if t.revision is distinct from p_revision then raise exception '다른 창에서 전사문을 수정했습니다. 작성한 글을 보관한 뒤 최신본과 비교해 주세요.' using errcode='PT409';end if;
   update public.rms_live_transcripts set edited_text=p_text,revision=revision+1,updated_at=clock_timestamp() where id=t.id returning * into t;
  end if;
 end if;
 return to_jsonb(t);
end $$;
