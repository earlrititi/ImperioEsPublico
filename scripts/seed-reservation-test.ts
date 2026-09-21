import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { PRODUCTS } from "../src/config/products";

const file = ".env.reservation-test.local";
const env = parseEnv(readFileSync(file,"utf8"));
if (env.PUBLIC_SUPABASE_URL !== "https://joicpkgvggfxzrdazisx.supabase.co") throw new Error("Not ImperioE Test");
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Test server key");
const db = createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const shirt = PRODUCTS["camiseta-imperial"];
const check = (error: unknown) => { if (error) throw new Error("Test seed failed"); };
let { data: product,error } = await db.from("products").select("id").eq("slug",shirt.slug).maybeSingle();
check(error);
if (!product) {
  const result = await db.from("products").insert({slug:shirt.slug,name:shirt.name,description:shirt.baseGarmentModel,sku:shirt.sku,currency:shirt.currency,
    stock:null,manufacturer_name:shirt.manufacturer,manufacturer_email:shirt.manufacturerEmail,manufacturer_address:shirt.manufacturerAddress,
    shipping_information:shirt.shippingInformation,legal_status:shirt.legalStatus,status:"draft"}).select("id").single();
  check(result.error); product = result.data;
}
if (!product) throw new Error("Missing test product");
for (const v of shirt.variantDetails) {
  const sku = `${shirt.sku}-${v.size}`;
  const { data: existing,error } = await db.from("product_variants").select("id").eq("sku",sku).maybeSingle(); check(error);
  if (!existing) check((await db.from("product_variants").insert({product_id:product.id,name:v.size,sku,physical_stock:v.stock,color:shirt.color})).error);
}
const {data: prices,error: pricesError} = await db.from("product_prices").select("id").eq("product_id",product.id).is("ends_at",null); check(pricesError);
if (!prices?.length) check((await db.from("product_prices").insert({product_id:product.id,amount:shirt.expectedUnitAmount,currency:"eur",starts_at:new Date().toISOString()})).error);
env.PUBLIC_SITE_URL = "http://127.0.0.1:4323";
env.RESERVATION_MODE = "true";
env.COMMERCE_EMAIL_MODE = "disabled";
env.STRIPE_LIVE_CHECKOUT_ENABLED = "false";
env.SHIRT_SALES_APPROVED = "false";
env.STRIPE_SECRET_KEY ||= "sk_test_not_configured";
env.STRIPE_WEBHOOK_SECRET ||= "whsec_not_configured";
env.STRIPE_ES_VAT_RATE_ID ||= "";
env.STRIPE_PRICE_CAMISETA_IMPERIAL ||= "";
writeFileSync(file,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join("\n")+"\n",{mode:0o600});
console.log("Test catalogue seeded without overwriting existing stock. Additional customer shipping: 0.");
