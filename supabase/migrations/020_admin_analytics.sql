-- Anonymous interaction totals only: no IP, cookies, email or session identifiers.
create table public.site_interactions (
  hour timestamptz not null,
  page text not null check (length(page) <= 200),
  target text not null check (length(target) <= 120),
  event text not null check (event in ('page_view','click','scroll_50','scroll_90')),
  count bigint not null default 1 check (count > 0),
  primary key (hour,page,target,event)
);
alter table public.site_interactions enable row level security;
revoke all on public.site_interactions from anon, authenticated;
grant all on public.site_interactions to service_role;

create function public.record_site_interaction(p_page text,p_target text,p_event text)
returns void language sql security definer set search_path = '' as $$
  insert into public.site_interactions(hour,page,target,event)
  values(date_trunc('hour',now()),p_page,p_target,p_event)
  on conflict(hour,page,target,event) do update set count=public.site_interactions.count+1;
$$;
revoke all on function public.record_site_interaction(text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_interaction(text,text,text) to service_role;

create function public.admin_analytics_summary(p_days integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  with consent_history as (
    select *, lag(accepted) over(partition by coalesce(user_id::text,anonymous_id::text),consent_type order by created_at,id) as previous
    from public.legal_consents where source in ('cookie_banner','cookie_settings')
      and consent_type in ('cookies_analytics','cookies_marketing','cookies_preferences')
  ), period as (
    select * from consent_history where created_at >= now()-make_interval(days=>greatest(1,least(p_days,365)))
  )
  select jsonb_build_object(
    'interactions',coalesce((select jsonb_agg(x) from (
      select page,target,event,sum(count) as count from public.site_interactions
      where hour>=now()-make_interval(days=>greatest(1,least(p_days,365)))
      group by page,target,event order by sum(count) desc limit 500
    )x),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(x) from (
      select hour::date as day,event,sum(count) as count from public.site_interactions
      where hour>=now()-make_interval(days=>greatest(1,least(p_days,365)))
      group by hour::date,event order by hour::date
    )x),'[]'::jsonb),
    'consents',coalesce((select jsonb_agg(x) from (
      select consent_type,count(*) as decisions,
        count(*) filter(where accepted) as accepted,
        count(*) filter(where not accepted) as rejected,
        count(*) filter(where not accepted and previous=true) as withdrawals,
        count(distinct coalesce(user_id::text,anonymous_id::text)) as identities
      from period group by consent_type
    )x),'[]'::jsonb)
  );
$$;
revoke all on function public.admin_analytics_summary(integer) from public,anon,authenticated;
grant execute on function public.admin_analytics_summary(integer) to service_role;
