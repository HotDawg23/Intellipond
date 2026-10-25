create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.password_reset_rate_limits (
  scope text not null check (scope in ('email', 'ip')),
  subject_digest text not null check (subject_digest ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count smallint not null check (request_count > 0),
  primary key (scope, subject_digest)
);

create index password_reset_rate_limits_window_started_at_idx
  on private.password_reset_rate_limits (window_started_at);

alter table private.password_reset_rate_limits enable row level security;

revoke all on table private.password_reset_rate_limits from public, anon, authenticated, service_role;

comment on table private.password_reset_rate_limits is
  'Stores keyed digests and fixed-window counters for password reset requests; no email addresses or IPs are stored.';

create or replace function public.consume_password_reset_rate_limit(
  p_email_digest text,
  p_ip_digest text
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_email_count smallint;
  v_email_window_started_at timestamptz;
  v_ip_count smallint := 0;
  v_ip_window_started_at timestamptz;
  v_retry_after_seconds integer;
begin
  if p_email_digest is null or p_email_digest !~ '^[0-9a-f]{64}$'
    or p_ip_digest is null or p_ip_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid password reset rate limit digest';
  end if;

  -- Periodically remove expired fingerprints in bounded batches.
  if pg_catalog.pg_try_advisory_xact_lock(20261025, 1) then
    delete from private.password_reset_rate_limits
    where ctid in (
      select ctid
      from private.password_reset_rate_limits
      where window_started_at < v_now - interval '1 day'
      order by window_started_at
      limit 500
    );
  end if;

  -- Allow at most 20 requests per IP digest in each 15-minute window.
  insert into private.password_reset_rate_limits as rate_limit (
    scope, subject_digest, window_started_at, request_count
  ) values (
    'ip', p_ip_digest, v_now, 1
  )
  on conflict (scope, subject_digest) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= v_now - interval '15 minutes' then v_now
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at <= v_now - interval '15 minutes' then 1
      else least(rate_limit.request_count + 1, 21)::smallint
    end
  returning request_count, window_started_at
  into v_ip_count, v_ip_window_started_at;

  -- Stop abusive IPs before allocating email-digest rows for arbitrary input.
  if v_ip_count > 20 then
    v_retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (v_ip_window_started_at + interval '15 minutes' - v_now)))::integer
    );
    return query select false, v_retry_after_seconds;
    return;
  end if;

  -- Allow at most 3 reset emails per email digest in each 1-hour window.
  insert into private.password_reset_rate_limits as rate_limit (
    scope, subject_digest, window_started_at, request_count
  ) values (
    'email', p_email_digest, v_now, 1
  )
  on conflict (scope, subject_digest) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= v_now - interval '1 hour' then v_now
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at <= v_now - interval '1 hour' then 1
      else least(rate_limit.request_count + 1, 4)::smallint
    end
  returning request_count, window_started_at
  into v_email_count, v_email_window_started_at;

  v_retry_after_seconds := case when v_email_count > 3 then
    ceil(extract(epoch from (v_email_window_started_at + interval '1 hour' - v_now)))::integer
  else 0 end;

  return query
  select
    v_email_count <= 3,
    v_retry_after_seconds;
end;
$$;

revoke all on function public.consume_password_reset_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_password_reset_rate_limit(text, text) to service_role;
