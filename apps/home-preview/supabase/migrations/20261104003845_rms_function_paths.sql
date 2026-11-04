-- Helpers use fixed resolution; authorization remains inside each RMS RPC.
alter function public.rms_optional_text(jsonb,text,integer) set search_path=pg_catalog,public;
alter function public.rms_required_text(jsonb,text,integer) set search_path=pg_catalog,public;
alter function public.rms_request_json(public.rms_review_requests) set search_path=pg_catalog,public;
alter function public.rms_response_json(public.rms_review_responses) set search_path=pg_catalog,public;
alter function public.rms_utf16_length(text) set search_path=pg_catalog,public;
-- Supabase creates this event-trigger helper on hosted projects; it is not an RPC.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
