-- Counts only the signed-in allowlisted user's own runs. No prompts or other users' usage.
create function public.rms_ai_usage() returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,auth
as $$
declare v_uid uuid := public.rms_assert_session(); v_result jsonb;
begin
 select jsonb_build_object('total',count(*),'complete',count(*) filter(where status='complete'),'failed',count(*) filter(where status='failed'),'running',count(*) filter(where status='running'),'limit',100,'windowHours',24)
 into v_result from public.rms_ai_runs where user_id=v_uid and created_at>now()-interval '24 hours';
 return v_result;
end $$;
revoke all on function public.rms_ai_usage() from public,anon;
grant execute on function public.rms_ai_usage() to authenticated;
