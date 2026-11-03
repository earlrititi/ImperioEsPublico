-- Run only after promoting the verified release. The Vault secret is never returned.
insert into public.seo_jobs(kind,job_key,actor_id)
values('monthly','release-verification-20261103','24f42701-98e0-4716-810c-363ae1cc8fa2')
on conflict(job_key) do nothing;
select net.http_post(
  url:='https://imperioes.com/api/seo-maintenance',
  headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='imperio_commerce_job_secret'),'Content-Type','application/json'),
  body:='{}'::jsonb,timeout_milliseconds:=180000
) as request_id;
