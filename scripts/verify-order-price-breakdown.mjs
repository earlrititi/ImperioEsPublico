import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';

const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(env.SUPABASE_TEST_PROJECT_REF, 'joicpkgvggfxzrdazisx');
const cli = join(process.env.LOCALAPPDATA, 'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file = join(mkdtempSync(join(tmpdir(), 'imperio-price-breakdown-')), 'test.sql');
const migration = readFileSync('supabase/migrations/039_order_price_breakdown.sql', 'utf8');
writeFileSync(file, `begin;
${migration}
do $$
declare rid uuid; aid uuid; oid uuid; variant text; units integer; percent integer;
  discount integer; paid_total integer; original_orders text; current_orders text;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'')) into original_orders from public.commerce_orders o;
  update public.commerce_campaign set purchase_activated=true, purchase_open_at=now()-interval '1 minute', max_reservation_quantity=null where id='shirt-first-edition';
  select sku into variant from public.product_variants where active order by sku limit 1;
  update public.product_variants set physical_stock=reserved_stock+sold_stock+30 where sku=variant;
  if has_table_privilege('anon','public.product_variants','SELECT') or has_table_privilege('authenticated','public.product_variants','SELECT') then raise exception 'PUBLIC_STOCK_ACCESS'; end if;
  foreach units in array array[1,3] loop
    foreach percent in array array[0,15,20] loop
      discount := round(2699*units*percent/100.0);
      paid_total := 2999*units-discount;
      rid := public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,
        '{"name":"Price Test","email":"price-test@example.invalid"}',
        '{"name":"Price Test","line1":"Calle Test 1","postalCode":"28001","city":"Madrid","province":"28","country":"ES"}',
        jsonb_build_array(jsonb_build_object('sku',variant,'quantity',units)),'test','test',0,false,false);
      aid := public.begin_shirt_payment(rid,
        '{"name":"Price Test","line1":"Calle Test 1","postalCode":"28001","city":"Madrid","province":"28","country":"ES"}', 'test');
      update public.reservation_payment_attempts set expected_total=paid_total, discount_amount=discount where id=aid;
      oid := public.complete_shirt_payment(aid,'cs_test_'||aid,'pi_test_'||aid,paid_total,'eur',round(paid_total*21/121.0)::integer,0,discount);
      if not exists(select 1 from public.commerce_orders where id=oid and product_subtotal=2699*units and shipping_amount=300*units and commerce_orders.total=paid_total and discount_amount=discount) then raise exception 'WRONG_ORDER_BREAKDOWN'; end if;
      if oid <> public.complete_shirt_payment(aid,'cs_test_'||aid,'pi_test_'||aid,paid_total,'eur',round(paid_total*21/121.0)::integer,0,discount) then raise exception 'PAYMENT_NOT_IDEMPOTENT'; end if;
    end loop;
  end loop;
  select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'')) into current_orders from public.commerce_orders o where customer_email <> 'price-test@example.invalid';
  if current_orders <> original_orders then raise exception 'HISTORICAL_ORDERS_CHANGED'; end if;
end $$;
rollback;
select true as passed, 'Six paid-order fixtures, separate postage, discounts, idempotency and private stock. All rolled back.' as checks;`);
const args = [cli, 'db', 'query', '--linked', '--project-ref', env.SUPABASE_TEST_PROJECT_REF, '--file', file, '--output', 'json'];
if (process.env.SUPABASE_TEST_WORKDIR) args.push('--workdir', process.env.SUPABASE_TEST_WORKDIR);
try {
  const output = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  console.log(output);
} catch {
  throw new Error('Test database price assertions failed; private diagnostics omitted. SQL file: ' + file);
}
