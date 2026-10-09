import {execFileSync} from 'node:child_process';import {join} from 'node:path';import {tmpdir} from 'node:os';import {mkdtempSync,writeFileSync} from 'node:fs';
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file=join(mkdtempSync(join(tmpdir(),'imperio-live-shirt-test-')),'test.sql');
writeFileSync(file,`begin;do $$ declare rid uuid; req uuid:=gen_random_uuid(); item record; initial_reserved integer; begin
  update public.commerce_campaign set purchase_activated=true,purchase_open_at=now()-interval '1 minute',max_reservation_quantity=null where id='shirt-first-edition';
  select sku,reserved_stock into item from public.product_variants where available_stock>=1 and active order by sku limit 1;
  if item.sku is null then raise exception 'Test stock needed';end if;
  initial_reserved:=item.reserved_stock;
  rid:=public.create_shirt_reservation(req,repeat('a',64),repeat('b',64),null,'{"name":"Test buyer","email":"live-shirt@example.invalid"}',
    '{"name":"Test","line1":"Calle Test 1","postalCode":"28001","city":"Madrid","province":"28","country":"ES"}',
    jsonb_build_array(jsonb_build_object('sku',item.sku,'quantity',1)),'test','test',0,false,false);
  if (select status from public.reservations where id=rid)<>'PURCHASE_AVAILABLE' then raise exception 'New order cannot pay';end if;
  if (select expires_at from public.reservations where id=rid) is null then raise exception 'No stock hold expiry';end if;
  if (select reserved_stock from public.product_variants where sku=item.sku)<>initial_reserved+1 then raise exception 'Stock not held';end if;
  if not exists(select 1 from public.commerce_outbox where reservation_id=rid and kind='PURCHASE_AVAILABLE') then raise exception 'No purchase invitation';end if;
  if public.create_shirt_reservation(req,repeat('a',64),repeat('b',64),null,'{}','{}','[]','test','test',0,false,false)<>rid then raise exception 'Idempotency failed';end if;
end $$;rollback;select true as verified;`);
try{execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','joicpkgvggfxzrdazisx','--file',file,'--output','json','--workdir',process.env.SUPABASE_TEST_WORKDIR],{stdio:['ignore','pipe','pipe'],windowsHide:true});}catch{throw Error('Test shirt ordering assertions failed (private output omitted)');}
console.log('New payable shirt orders, stock holds, expiry, invitation and idempotency passed. Test transaction rolled back.');
