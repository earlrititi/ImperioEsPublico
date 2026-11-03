do $$
declare actor uuid:='24f42701-98e0-4716-810c-363ae1cc8fa2'; opp uuid:=gen_random_uuid(); job uuid; claimed public.seo_jobs;
  rid uuid; review public.seo_reviews; article public.cms_articles; n integer;
  draft jsonb:=jsonb_build_object('title','Synthetic SQL review - rollback','slug','sql-seo-'||gen_random_uuid(),'lead','Synthetic test','category','Test','author','Imperio E','publishedAt','2026-11-03','body','<p>Synthetic private body</p>','seoTitle','Synthetic test','description','Synthetic test','imageSrc','','imageAlt','','imageCaption','');
begin
  if has_table_privilege('anon','public.seo_reviews','SELECT') or has_table_privilege('authenticated','public.seo_records','SELECT')
    or has_function_privilege('authenticated','public.seo_review_action(uuid,uuid,integer,text,text,text)','EXECUTE') then raise exception 'Private SEO privileges leaked'; end if;
  begin perform public.seo_assert_actor(gen_random_uuid()); raise exception 'Untrusted actor accepted'; exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
  update public.seo_engine_config set settings=settings||'{"paused":false,"mailPaused":true,"monthlyBudgetCents":10,"dailyGenerations":2,"weeklyDrafts":2}'::jsonb;
  insert into public.seo_opportunities(id,fingerprint,data,status,created_by,updated_by) values(opp,opp::text,'{"title":"Synthetic test","targetSlug":null}','approved',actor,actor);
  job:=public.seo_queue_generation(actor,opp,1,5,'{"model":"fixture"}');
  begin perform public.seo_queue_generation(actor,opp,1,5,'{"model":"fixture"}'); raise exception 'Duplicate generation accepted'; exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise; end if; end;
  select * into claimed from public.seo_claim_job('generate');
  if claimed.id<>job then raise exception 'Claim missing'; end if;
  if exists(select 1 from public.seo_claim_job('generate')) then raise exception 'Concurrent generation'; end if;
  perform public.seo_generation_stage(job,claimed.claim_id,'generating');
  perform public.seo_generation_stage(job,claimed.claim_id,'validating');
  rid:=public.seo_complete_generation(job,claimed.claim_id,draft,'{"blockers":[],"warnings":[],"claims":[],"contribution":"Synthetic SQL test"}','[]','{"inputTokens":100,"outputTokens":50,"costCents":1}');
  select * into review from public.seo_reviews where id=rid;
  select * into article from public.cms_articles where id=review.article_id;
  if article.status<>'draft' or article.published_meta is not null then raise exception 'Generation published'; end if;
  if public.seo_complete_generation(job,claimed.claim_id,draft,'{}','[]','{}')<>rid then raise exception 'Completion not idempotent'; end if;
  select count(*) into n from public.seo_jobs where review_id=rid and kind='notify'; if n<>1 then raise exception 'Review notification duplicate'; end if;
  begin perform public.transition_article(article.id,actor,article.revision,'publish'); raise exception 'Editor bypassed review'; exception when others then if sqlerrm<>'SEO_REVIEW_REQUIRED' then raise; end if; end;
  begin perform public.seo_review_action(actor,rid,999,'publish','Reviewer','Checked sources'); raise exception 'Stale revision accepted'; exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise; end if; end;
  perform public.seo_review_action(actor,rid,article.revision,'publish','SQL test reviewer','Synthetic SQL approval only - rollback');
  perform public.seo_review_action(actor,rid,article.revision,'publish','SQL test reviewer','Idempotent repeat');
  select * into article from public.cms_articles where id=article.id;
  if article.status<>'published' or article.published_meta->'editorialReview'->>'reviewer'<>'SQL test reviewer' then raise exception 'Publication missing reviewer'; end if;
  select count(*) into n from public.seo_jobs where review_id=rid and kind='notify'; if n<>2 then raise exception 'Publication notification duplicate'; end if;
  article:=public.save_article_draft(article.id,actor,article.revision,article.draft||'{"lead":"Changed after publication"}'::jsonb);
  begin perform public.transition_article(article.id,actor,article.revision,'publish'); raise exception 'Changed version bypassed review'; exception when others then if sqlerrm<>'SEO_REVIEW_REQUIRED' then raise; end if; end;
end $$;

do $$
declare actor uuid:='24f42701-98e0-4716-810c-363ae1cc8fa2'; opp uuid:=gen_random_uuid(); job uuid; claimed public.seo_jobs;
  rid uuid; rid2 uuid; r public.seo_reviews; a public.cms_articles;
  draft jsonb:=jsonb_build_object('title','Synthetic regeneration rollback','slug','sql-seo-regen-'||gen_random_uuid(),'lead','Synthetic','category','Test','author','Imperio E','publishedAt','2026-11-03','body','<p>Original synthetic version</p>','seoTitle','Test','description','Test','imageSrc','','imageAlt','','imageCaption','');
begin
  update public.seo_engine_config set settings=settings||'{"dailyGenerations":5,"weeklyDrafts":4,"monthlyBudgetCents":10}'::jsonb;
  insert into public.seo_opportunities(id,fingerprint,data,status,created_by,updated_by) values(opp,opp::text,'{"title":"Synthetic regeneration","targetSlug":null}','approved',actor,actor);
  perform public.seo_reopen_opportunity(actor,opp,1);
  if (select status from public.seo_opportunities where id=opp)<>'proposed' then raise exception 'Opportunity cannot reopen'; end if;
  perform public.seo_opportunity_action(actor,opp,2,'approved');
  begin perform public.seo_queue_generation(actor,opp,3,11,'{"model":"fixture"}'); raise exception 'Exceeded budget accepted'; exception when others then if sqlerrm<>'SEO_BUDGET_EXCEEDED' then raise; end if; end;
  job:=public.seo_queue_generation(actor,opp,3,1,'{"model":"fixture"}');
  select * into claimed from public.seo_claim_job('generate');
  perform public.seo_generation_stage(job,claimed.claim_id,'generating'); perform public.seo_generation_stage(job,claimed.claim_id,'validating');
  rid:=public.seo_complete_generation(job,claimed.claim_id,draft,'{"blockers":[],"warnings":[]}','[]','{"costCents":1}');
  select * into r from public.seo_reviews where id=rid;
  perform public.seo_review_action(actor,rid,r.article_revision,'changes','SQL reviewer','Request a revised version');
  perform public.seo_opportunity_action(actor,opp,(select revision from public.seo_opportunities where id=opp),'approved');
  job:=public.seo_queue_generation(actor,opp,(select revision from public.seo_opportunities where id=opp),1,'{"model":"fixture"}');
  select * into claimed from public.seo_claim_job('generate');
  perform public.seo_generation_stage(job,claimed.claim_id,'generating'); perform public.seo_generation_stage(job,claimed.claim_id,'validating');
  rid2:=public.seo_complete_generation(job,claimed.claim_id,draft||'{"body":"<p>Second synthetic version</p>"}'::jsonb,'{"blockers":[],"warnings":[]}','[]','{"costCents":1}');
  select * into a from public.cms_articles where id=r.article_id;
  if a.revision<>2 or a.status<>'draft' or a.published_body is not null then raise exception 'Regeneration created or published wrong version'; end if;
  if not exists(select 1 from public.seo_reviews where id=rid2 and article_id=a.id and article_revision=2) then raise exception 'Regeneration review not versioned'; end if;
  if (select snapshot->>'body' from public.seo_reviews where id=rid)<>'<p>Original synthetic version</p>' then raise exception 'Original review overwritten'; end if;
  perform public.seo_review_action(actor,rid2,2,'reject','SQL reviewer','Synthetic rejection test');
  begin perform public.seo_review_action(actor,rid2,2,'publish','SQL reviewer','Must not publish rejected version'); raise exception 'Rejected revision published'; exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise; end if; end;
end $$;
