-- Private editorial operations reuse cms_articles, commerce_audit and Resend.
create table public.seo_engine_config (
  id boolean primary key default true check(id), revision integer not null default 1,
  settings jsonb not null default '{"paused":true,"mailPaused":true,"scheduleEnabled":false,"monthlyBudgetCents":0,"maxTokens":10000,"maxOutputTokens":3000,"dailyGenerations":2,"weeklyDrafts":2,"weeklyImprovements":3,"monthlyCollaborators":5,"retentionDays":90}',
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.seo_engine_config(id) values(true);
create table public.seo_opportunities (
  id uuid primary key default gen_random_uuid(), fingerprint text not null unique,
  data jsonb not null, status text not null default 'proposed' check(status in ('proposed','approved','researching','generating','validating','needs_sources','pending_review','needs_changes','rejected','generation_failed','published','archived')),
  revision integer not null default 1, created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.seo_records (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('source','collaboration','observation','audit','metrics','report')),
  fingerprint text not null, data jsonb not null, revision integer not null default 1,
  created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(kind,fingerprint)
);
create table public.seo_reviews (
  id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.seo_opportunities(id),
  article_id uuid not null references public.cms_articles(id), article_revision integer not null,
  snapshot jsonb not null, verification jsonb not null, source_snapshot jsonb not null,
  status text not null default 'pending_review' check(status in ('pending_review','needs_changes','rejected','approved','published')),
  reviewed_by uuid references auth.users(id), reviewer_name text, decision_note text, reviewed_at timestamptz,
  created_at timestamptz not null default now(), unique(article_id,article_revision)
);
create table public.seo_jobs (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('generate','notify','daily','weekly','monthly')),
  job_key text not null unique, opportunity_id uuid references public.seo_opportunities(id), review_id uuid references public.seo_reviews(id),
  payload jsonb not null default '{}', status text not null default 'pending' check(status in ('pending','processing','succeeded','failed','needs_review')),
  actor_id uuid not null references auth.users(id), claim_id uuid, claimed_at timestamptz, first_attempt_at timestamptz,
  attempts integer not null default 0, due_at timestamptz not null default now(),
  reserved_cents integer not null default 0 check(reserved_cents>=0), actual_cents integer check(actual_cents>=0),
  input_tokens integer, output_tokens integer, provider_id text, delivery_status text, provider_checked_at timestamptz,
  result jsonb, error text, created_at timestamptz not null default now(), finished_at timestamptz
);
create index seo_jobs_due_idx on public.seo_jobs(due_at) where status in ('pending','processing');
create index seo_reviews_article_idx on public.seo_reviews(article_id,article_revision desc);
do $$ declare t text; begin
  foreach t in array array['seo_engine_config','seo_opportunities','seo_records','seo_reviews','seo_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
end $$;

create function public.seo_assert_actor(p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_actor not in ('24f42701-98e0-4716-810c-363ae1cc8fa2'::uuid,'596ce13f-3a34-467e-a5b3-65251a5cf446'::uuid)
    or not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<now())) then raise exception 'FORBIDDEN'; end if;
end $$;

create function public.seo_save(p_actor uuid,p_kind text,p_id uuid,p_revision integer,p_data jsonb,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; current_revision integer;
begin
  perform public.seo_assert_actor(p_actor);
  if jsonb_typeof(p_data)<>'object' or p_revision<0 or length(p_fingerprint)>300 then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('seo-save:'||p_kind||':'||p_id,0));
  if p_kind='settings' then
    select revision into current_revision from public.seo_engine_config where id for update;
    if current_revision<>p_revision then raise exception 'REQUEST_CONFLICT'; end if;
    update public.seo_engine_config set settings=p_data,revision=revision+1,updated_by=p_actor,updated_at=now() where id returning to_jsonb(seo_engine_config) into item;
  elsif p_kind='opportunity' then
    select revision into current_revision from public.seo_opportunities where id=p_id for update;
    if coalesce(current_revision,0)<>p_revision then raise exception 'REQUEST_CONFLICT'; end if;
    if exists(select 1 from public.seo_opportunities where id=p_id and status not in ('proposed','needs_sources','needs_changes','generation_failed')) then raise exception 'INVALID_STATE'; end if;
    insert into public.seo_opportunities(id,fingerprint,data,created_by,updated_by) values(p_id,p_fingerprint,p_data,p_actor,p_actor)
      on conflict(id) do update set data=excluded.data,fingerprint=excluded.fingerprint,status='proposed',revision=seo_opportunities.revision+1,updated_by=p_actor,updated_at=now()
      returning to_jsonb(seo_opportunities) into item;
  elsif p_kind in ('source','collaboration','observation','audit','metrics','report') then
    select revision into current_revision from public.seo_records where id=p_id and kind=p_kind for update;
    if coalesce(current_revision,0)<>p_revision then raise exception 'REQUEST_CONFLICT'; end if;
    if p_kind='collaboration' and p_revision=0 and (select count(*) from public.seo_records where kind='collaboration' and created_at>=date_trunc('month',now())) >= (select (settings->>'monthlyCollaborators')::integer from public.seo_engine_config where id) then raise exception 'SEO_MONTHLY_LIMIT'; end if;
    insert into public.seo_records(id,kind,fingerprint,data,created_by,updated_by) values(p_id,p_kind,p_fingerprint,p_data,p_actor,p_actor)
      on conflict(id) do update set data=excluded.data,revision=seo_records.revision+1,updated_by=p_actor,updated_at=now()
      returning to_jsonb(seo_records) into item;
  else raise exception 'INVALID_INPUT'; end if;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'seo',upper(p_kind)||'_SAVED');
  return item;
exception when unique_violation then raise exception 'SEO_DUPLICATE';
end $$;

create function public.seo_opportunity_action(p_actor uuid,p_id uuid,p_revision integer,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.seo_opportunities;
begin
  perform public.seo_assert_actor(p_actor);
  select * into o from public.seo_opportunities where id=p_id for update;
  if o.id is null or o.revision<>p_revision then raise exception 'REQUEST_CONFLICT'; end if;
  if p_action not in ('approved','rejected','archived') or o.status in ('generating','validating','published') then raise exception 'INVALID_STATE'; end if;
  update public.seo_opportunities set status=p_action,revision=revision+1,updated_by=p_actor,updated_at=now() where id=p_id returning * into o;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'seo','OPPORTUNITY_'||upper(p_action));
  return to_jsonb(o);
end $$;

create function public.seo_queue_generation(p_actor uuid,p_id uuid,p_revision integer,p_reserve integer,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare cfg jsonb; o public.seo_opportunities; target uuid; spent integer;
begin
  perform public.seo_assert_actor(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('seo-budget',0));
  select settings into cfg from public.seo_engine_config where id;
  if (cfg->>'paused')::boolean then raise exception 'SEO_PAUSED'; end if;
  select * into o from public.seo_opportunities where id=p_id for update;
  if o.id is null or o.revision<>p_revision or o.status<>'approved' then raise exception 'REQUEST_CONFLICT'; end if;
  if p_reserve<1 or p_payload->>'model' is null then raise exception 'INVALID_INPUT'; end if;
  select coalesce(sum(coalesce(actual_cents,reserved_cents)),0) into spent from public.seo_jobs where kind='generate' and created_at>=date_trunc('month',now());
  if spent+p_reserve>(cfg->>'monthlyBudgetCents')::integer then raise exception 'SEO_BUDGET_EXCEEDED'; end if;
  if (select count(*) from public.seo_jobs where kind='generate' and created_at>=date_trunc('day',now())) >= (cfg->>'dailyGenerations')::integer
    or (select count(*) from public.seo_jobs where kind='generate' and created_at>=date_trunc('week',now())) >= (cfg->>'weeklyDrafts')::integer then raise exception 'SEO_GENERATION_LIMIT'; end if;
  if exists(select 1 from public.seo_reviews where opportunity_id=p_id and status in ('pending_review','approved')) then raise exception 'INVALID_STATE'; end if;
  if exists(select 1 from public.seo_jobs where opportunity_id=p_id and kind='generate' and status in ('pending','processing','needs_review')) then raise exception 'SEO_GENERATION_REVIEW_REQUIRED'; end if;
  insert into public.seo_jobs(kind,job_key,opportunity_id,actor_id,reserved_cents,payload)
    values('generate','generation:'||p_id||':'||p_revision,p_id,p_actor,p_reserve,p_payload) returning id into target;
  update public.seo_opportunities set status='researching',revision=revision+1,updated_at=now() where id=p_id;
  return target;
end $$;

create function public.seo_claim_job(p_kind text) returns setof public.seo_jobs
language plpgsql security definer set search_path='' as $$
declare target uuid; cfg jsonb;
begin
  select settings into cfg from public.seo_engine_config where id;
  if p_kind='generate' and (cfg->>'paused')::boolean or p_kind='notify' and (cfg->>'mailPaused')::boolean then return; end if;
  if p_kind in ('daily','weekly','monthly') and not (cfg->>'scheduleEnabled')::boolean then return; end if;
  update public.seo_jobs set status='needs_review',error='LEASE_EXPIRED_REVIEW_REQUIRED'
    where kind='generate' and status='processing' and claimed_at<now()-interval '10 minutes';
  update public.seo_jobs set status='needs_review',error='MAIL_RETRY_WINDOW_EXCEEDED'
    where kind='notify' and status in ('pending','processing','failed') and (first_attempt_at<now()-interval '23 hours' or attempts>=5);
  -- A global lease keeps generation concurrency at one across overlapping cron requests.
  perform pg_advisory_xact_lock(hashtextextended('seo-claim:'||p_kind,0));
  if p_kind='generate' and exists(select 1 from public.seo_jobs where kind=p_kind and status='processing') then return; end if;
  select id into target from public.seo_jobs where kind=p_kind and due_at<=now() and
    (status='pending' or (p_kind='notify' and (status='failed' or status='processing' and claimed_at<now()-interval '5 minutes')))
    order by due_at for update skip locked limit 1;
  if target is null then return; end if;
  return query update public.seo_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=target returning *;
end $$;

create function public.seo_complete_generation(p_job uuid,p_claim uuid,p_draft jsonb,p_verification jsonb,p_sources jsonb,p_usage jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.seo_jobs; o public.seo_opportunities; article public.cms_articles; target_review_id uuid;
begin
  select * into j from public.seo_jobs where id=p_job for update;
  if j.id is null then raise exception 'INVALID_INPUT'; end if;
  if j.status='succeeded' then return (j.result->>'reviewId')::uuid; end if;
  if j.status<>'processing' or j.claim_id is distinct from p_claim then raise exception 'REQUEST_CONFLICT'; end if;
  perform public.seo_assert_actor(j.actor_id);
  select * into o from public.seo_opportunities where id=j.opportunity_id for update;
  if o.status not in ('researching','generating','validating') then raise exception 'INVALID_STATE'; end if;
  if o.data->>'targetSlug' is not null then raise exception 'SEO_UPDATE_REQUIRES_MANUAL_IMPORT'; end if;
  article:=public.save_article_draft(gen_random_uuid(),j.actor_id,0,p_draft);
  insert into public.seo_reviews(opportunity_id,article_id,article_revision,snapshot,verification,source_snapshot)
    values(o.id,article.id,article.revision,p_draft,p_verification,p_sources) returning id into target_review_id;
  insert into public.seo_jobs(kind,job_key,opportunity_id,review_id,actor_id,payload)
    values('notify','review:'||target_review_id,o.id,target_review_id,j.actor_id,jsonb_build_object('event','review')) on conflict do nothing;
  update public.seo_opportunities set status='pending_review',revision=revision+1,updated_at=now() where id=o.id;
  update public.seo_jobs set status='succeeded',result=jsonb_build_object('reviewId',target_review_id),input_tokens=(p_usage->>'inputTokens')::integer,
    output_tokens=(p_usage->>'outputTokens')::integer,actual_cents=coalesce((p_usage->>'costCents')::integer,reserved_cents),finished_at=now() where id=j.id;
  return target_review_id;
end $$;

-- Guard every CMS publication path, including the existing editor API.
create function public.seo_guard_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare approved public.seo_reviews;
begin
  if new.status='published' and (old.status is distinct from new.status or old.published_body is distinct from new.published_body or old.published_meta is distinct from new.published_meta)
    and exists(select 1 from public.seo_reviews where article_id=new.id) then
    select * into approved from public.seo_reviews where article_id=new.id and article_revision=old.revision and status='approved' and reviewed_by is not null and snapshot=old.draft;
    if approved.id is null then raise exception 'SEO_REVIEW_REQUIRED'; end if;
    new.published_meta:=new.published_meta||jsonb_build_object('editorialReview',jsonb_build_object('reviewer',approved.reviewer_name,'reviewedAt',approved.reviewed_at,'method','Elaboracion asistida por IA y revision editorial humana'));
  end if;
  return new;
end $$;
create trigger seo_publication_guard before update on public.cms_articles for each row execute function public.seo_guard_publication();

create function public.seo_review_action(p_actor uuid,p_id uuid,p_revision integer,p_action text,p_name text,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.seo_reviews; a public.cms_articles;
begin
  perform public.seo_assert_actor(p_actor);
  select * into r from public.seo_reviews where id=p_id for update;
  if r.id is null then raise exception 'INVALID_INPUT'; end if;
  select * into a from public.cms_articles where id=r.article_id for update;
  if p_action='publish' and r.status='published' and r.article_revision=p_revision then return to_jsonb(r); end if;
  if r.status<>'pending_review' or r.article_revision is distinct from p_revision or a.revision is distinct from p_revision or a.draft is distinct from r.snapshot then raise exception 'REQUEST_CONFLICT'; end if;
  if p_action not in ('publish','reject','changes') or length(trim(p_note))<5 then raise exception 'INVALID_INPUT'; end if;
  if p_action='publish' then
    if length(trim(p_name))<3 or jsonb_array_length(coalesce(r.verification->'blockers','[]'))>0 then raise exception 'SEO_REVIEW_BLOCKED'; end if;
    update public.seo_reviews set status='approved',reviewed_by=p_actor,reviewer_name=p_name,decision_note=p_note,reviewed_at=now() where id=p_id;
    perform public.transition_article(a.id,p_actor,p_revision,'publish');
    update public.seo_reviews set status='published' where id=p_id;
    update public.seo_opportunities set status='published',revision=revision+1,updated_at=now() where id=r.opportunity_id;
    insert into public.seo_jobs(kind,job_key,opportunity_id,review_id,actor_id,payload)
      values('notify','publication:'||r.id,r.opportunity_id,r.id,p_actor,'{"event":"published"}') on conflict do nothing;
  else
    update public.seo_reviews set status=case when p_action='reject' then 'rejected' else 'needs_changes' end,reviewed_by=p_actor,reviewer_name=p_name,decision_note=p_note,reviewed_at=now() where id=p_id;
    update public.seo_opportunities set status=case when p_action='reject' then 'rejected' else 'needs_changes' end,revision=revision+1,updated_at=now() where id=r.opportunity_id;
  end if;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'seo','REVIEW_'||upper(p_action)||':'||p_revision);
  select * into r from public.seo_reviews where id=p_id; return to_jsonb(r);
end $$;

create function public.seo_resubmit_review(p_actor uuid,p_id uuid,p_revision integer,p_verification jsonb,p_sources jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_review public.seo_reviews; a public.cms_articles; target uuid;
begin
  perform public.seo_assert_actor(p_actor);
  select * into a from public.cms_articles where id=p_id for update;
  if a.id is null or a.revision<>p_revision or a.status='deleted' then raise exception 'REQUEST_CONFLICT'; end if;
  select * into old_review from public.seo_reviews where article_id=p_id order by article_revision desc limit 1 for update;
  if old_review.id is null then raise exception 'INVALID_INPUT'; end if;
  if old_review.status='published' then raise exception 'INVALID_STATE'; end if;
  if old_review.article_revision=p_revision then
    a:=public.save_article_draft(p_id,p_actor,p_revision,a.draft);
  end if;
  update public.seo_reviews set status='needs_changes' where article_id=p_id and status='pending_review';
  insert into public.seo_reviews(opportunity_id,article_id,article_revision,snapshot,verification,source_snapshot)
    values(old_review.opportunity_id,p_id,a.revision,a.draft,p_verification,p_sources) returning id into target;
  update public.seo_opportunities set status='pending_review',revision=revision+1,updated_at=now() where id=old_review.opportunity_id;
  insert into public.seo_jobs(kind,job_key,opportunity_id,review_id,actor_id,payload)
    values('notify','review:'||target,old_review.opportunity_id,target,p_actor,'{"event":"review"}') on conflict do nothing;
  return target;
end $$;

create function public.seo_schedule(p_actor uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  perform public.seo_assert_actor(p_actor);
  if not exists(select 1 from public.seo_engine_config where (settings->>'scheduleEnabled')::boolean) then return 0; end if;
  insert into public.seo_jobs(kind,job_key,actor_id)
    values('daily','daily:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),p_actor),
      ('weekly','weekly:'||to_char(now() at time zone 'UTC','IYYY-IW'),p_actor),
      ('monthly','monthly:'||to_char(now() at time zone 'UTC','YYYY-MM'),p_actor) on conflict do nothing;
  get diagnostics n=row_count; return n;
end $$;

create function public.seo_retention() returns integer language plpgsql security definer set search_path='' as $$
declare days integer; n integer;
begin
  select (settings->>'retentionDays')::integer into days from public.seo_engine_config where id;
  update public.seo_records set data=(data-'response')||jsonb_build_object('responsePurgedAt',now())
    where kind='observation' and data ? 'response' and created_at<now()-make_interval(days=>days);
  get diagnostics n=row_count;
  update public.seo_jobs set payload=payload-'context'-'sources'
    where kind='generate' and status in ('succeeded','needs_review','failed') and created_at<now()-make_interval(days=>days);
  return n;
end $$;

do $$ declare fn record; begin
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'seo_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end $$;
