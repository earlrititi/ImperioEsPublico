begin;
-- Private, optimistic cursor update + batch writes share a transaction. No public
-- webhook or arbitrary-URL fetch endpoint is created by this migration.
create function public.commit_mailbox_read_batch(p_batch jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare box public.communication_mailboxes; msg jsonb; cutoff timestamptz;incoming_uidvalidity bigint;incoming_last_uid bigint;
begin
 if pg_column_size(p_batch)>3000000 or jsonb_array_length(p_batch->'messages')>100 or jsonb_array_length(p_batch->'deleted_uids')>100 then raise exception 'MAILBOX_INVALID_PAGE';end if;
 select * into box from public.communication_mailboxes where id=(p_batch->>'mailbox_id')::uuid for update;
 if not found or not box.enabled or box.authorised_at is null or box.authorised_by is null then raise exception 'MAILBOX_NOT_AUTHORISED';end if;
 if box.uidvalidity is distinct from (p_batch->>'expected_uidvalidity')::bigint or box.last_uid<>(p_batch->>'expected_last_uid')::bigint then raise exception 'MAILBOX_CURSOR_CONFLICT';end if;
 incoming_uidvalidity:=(p_batch->>'uidvalidity')::bigint;incoming_last_uid:=(p_batch->>'last_uid')::bigint;
 if incoming_uidvalidity<=0 or incoming_last_uid<box.last_uid then raise exception 'MAILBOX_INVALID_PAGE';end if;
 if box.uidvalidity is not null and box.uidvalidity<>incoming_uidvalidity then raise exception 'MAILBOX_RESET_REQUIRED';end if;
 cutoff:=greatest(box.import_since,now()-make_interval(days=>box.retention_days));
 for msg in select value from jsonb_array_elements(p_batch->'messages') loop
  if (msg->>'uid')::bigint<1 or (msg->>'uid')::bigint>incoming_last_uid or (msg->>'occurred_at')::timestamptz<cutoff then raise exception 'MAILBOX_INVALID_MESSAGE';end if;
  if msg->>'internet_message_id' is not null and exists(select 1 from public.communication_inbound_messages where mailbox_id=box.id and internet_message_id=msg->>'internet_message_id') then
   update public.communication_inbound_messages set uidvalidity=incoming_uidvalidity,uid=(msg->>'uid')::bigint,seen=(msg->>'seen')::boolean,synced_at=now()
    where mailbox_id=box.id and internet_message_id=msg->>'internet_message_id';
   continue;
  end if;
  insert into public.communication_inbound_messages(mailbox_id,uidvalidity,uid,internet_message_id,in_reply_to,references_ids,sender,recipients,subject,safe_html,safe_text,occurred_at,seen,attachments)
  values(box.id,incoming_uidvalidity,(msg->>'uid')::bigint,msg->>'internet_message_id',msg->>'in_reply_to',array(select jsonb_array_elements_text(msg->'references_ids')),
   msg->>'sender',array(select jsonb_array_elements_text(msg->'recipients')),msg->>'subject',msg->>'safe_html',msg->>'safe_text',(msg->>'occurred_at')::timestamptz,(msg->>'seen')::boolean,msg->'attachments')
  on conflict(mailbox_id,uidvalidity,uid) do update set seen=excluded.seen,synced_at=now();
 end loop;
 delete from public.communication_inbound_messages where mailbox_id=box.id and uidvalidity=incoming_uidvalidity and uid in(select value::bigint from jsonb_array_elements_text(p_batch->'deleted_uids'));
 delete from public.communication_inbound_messages where mailbox_id=box.id and occurred_at<cutoff;
 update public.communication_mailboxes set uidvalidity=incoming_uidvalidity,last_uid=incoming_last_uid,last_sync_at=now(),state='ready' where id=box.id;
end $$;
revoke all on function public.commit_mailbox_read_batch(jsonb) from public,anon,authenticated;
grant execute on function public.commit_mailbox_read_batch(jsonb) to service_role;
create function public.prune_communications_data() returns integer
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 delete from public.communication_inbound_messages m using public.communication_mailboxes b
 where m.mailbox_id=b.id and m.occurred_at<greatest(b.import_since,now()-make_interval(days=>b.retention_days));
 get diagnostics removed=row_count;
 delete from public.commerce_audit where entity in ('communications','audience')
  and action in ('ADMIN_PRIVATE_READ','ADMIN_LIMITED_EXPORT_MAX_50') and created_at<now()-interval '180 days';
 return removed;
end $$;
revoke all on function public.prune_communications_data() from public,anon,authenticated;
grant execute on function public.prune_communications_data() to service_role;
commit;
