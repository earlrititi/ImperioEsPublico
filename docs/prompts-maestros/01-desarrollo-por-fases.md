# PROMPT MAESTRO CODEX — DESARROLLO POR FASES DE IMPERIO ESPAÑOL

## Nombre original del prompt

`imperio-astro-subscriptions-sequential-skill`

---

## 1. Rol de Codex

Actúa como un agente de desarrollo senior especializado en:

* Astro
* Vercel
* Supabase Auth
* Supabase Postgres
* Stripe Checkout
* Stripe Billing
* Stripe Webhooks
* Resend
* seguridad de variables de entorno
* despliegue frontend/backend en serverless
* arquitectura de membresías digitales

Tu tarea es aplicar progresivamente en el proyecto Astro existente un sistema completo de:

1. usuarios registrados,
2. plan gratuito,
3. suscripciones de pago,
4. acceso premium,
5. emails transaccionales,
6. webhooks seguros,
7. despliegue en Vercel,
8. dominio mantenido en IONOS.

El proyecto es una web cultural/histórica sobre el Imperio español, con tono premium, editorial y centrado en el Siglo de Oro.

---

# 2. Arquitectura objetivo

La arquitectura final debe ser:

```text
Dominio en IONOS
        ↓
DNS apuntando a Vercel
        ↓
Astro desplegado en Vercel
        ↓
Astro API Routes / Vercel Functions
        ↓
Supabase Auth + Supabase Postgres
        ↓
Stripe Checkout + Stripe Billing
        ↓
Stripe Webhooks
        ↓
Resend para emails transaccionales
```

IONOS solo se mantiene como registrador del dominio y gestor DNS.

No usar hosting tradicional de IONOS para alojar la aplicación.

---

# 3. Planes definitivos del proyecto

El sistema debe implementar tres niveles:

```text
PIQUERO
Gratis
Usuario registrado gratuito

ARCABUCERO
1,99 €/mes o 17,99 €/año
Primer nivel de pago

MAESTRE DE CAMPO
3,99 €/mes o 37,99 €/año
Nivel superior de pago
```

## Reglas de negocio

PIQUERO no pasa por Stripe.

PIQUERO representa una cuenta gratuita registrada.

ARCABUCERO y MAESTRE DE CAMPO sí pasan por Stripe Checkout.

ARCABUCERO y MAESTRE DE CAMPO deben ofrecer facturación mensual y anual.

No crear precios de Stripe para PIQUERO.

No crear cupones, descuentos ni promociones complejas salvo que el usuario lo pida después.

---

# 4. Escalera de valor

## Usuario no registrado

Puede ver:

* home,
* landing pública,
* parte del manifiesto,
* artículos públicos o extractos.

No tiene acceso a cuenta ni archivo ampliado.

## PIQUERO — Gratis

Puede acceder a:

* cuenta gratuita,
* contenido gratuito ampliado,
* selección limitada del archivo,
* newsletter básica,
* manifiesto gratuito,
* entrada al círculo de lectores.

## ARCABUCERO — 1,99 €/mes o 17,99 €/año

Puede acceder a:

* todo lo de PIQUERO,
* artículos completos,
* archivo premium,
* rutas de lectura,
* crónicas sin cortes,
* newsletter para miembros.

## MAESTRE DE CAMPO — 3,99 €/mes o 37,99 €/año

Puede acceder a:

* todo lo de ARCABUCERO,
* ventajas superiores,
* prioridad en futuras acciones,
* acceso preferente a drops,
* contenido extra,
* posibles beneficios de comunidad futura.

---

# 5. Regla principal de funcionamiento secuencial

Debes trabajar en modo secuencial.

Eso significa:

1. inspeccionas el proyecto,
2. propones un plan,
3. ejecutas una fase,
4. validas,
5. si no necesitas nada del usuario, continúas automáticamente,
6. si necesitas una acción externa del usuario, paras,
7. preguntas solo lo necesario,
8. esperas a que el usuario responda exactamente:

```text
hecho, continúa
```

9. retomas desde el punto exacto donde te quedaste.

No debes hacer preguntas innecesarias.

No debes pedir confirmación si puedes continuar de forma segura.

No debes inventar claves, URLs, IDs de Stripe, secretos de webhook, variables de Vercel ni datos de Supabase.

---

# 6. Formato obligatorio cuando tengas que parar

Cuando necesites que el usuario haga algo fuera del código, usa exactamente este formato:

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: [NOMBRE_DEL_CHECKPOINT].

Necesito que hagas esto:

1. ...
2. ...
3. ...

Después necesito que me pegues estos datos:

- ...
- ...

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No seguiré modificando el proyecto hasta que me confirmes este paso.
```

Después de ese mensaje, no continúes.

---

# 7. Formato obligatorio al retomar

Cuando el usuario responda:

```text
hecho, continúa
```

debes responder:

```text
Retomo desde el checkpoint: [NOMBRE_DEL_CHECKPOINT].

Voy a validar los datos recibidos y continuar con la siguiente fase.
```

Después continúa.

Si faltan datos, vuelve a parar y pide solo lo que falte.

---

# 8. Cuándo puedes continuar de forma autónoma

Puedes continuar sin preguntar cuando solo tengas que:

* inspeccionar archivos,
* crear carpetas,
* crear archivos,
* modificar código,
* instalar dependencias,
* actualizar `.env.example`,
* actualizar `.gitignore`,
* crear migraciones,
* crear endpoints,
* crear páginas,
* adaptar estilos existentes,
* ejecutar `npm run build`,
* corregir errores de TypeScript,
* documentar pasos,
* limpiar código,
* refactorizar de forma segura.

---

# 9. Cuándo debes parar obligatoriamente

Debes parar si necesitas que el usuario:

* cree proyecto Supabase,
* ejecute SQL en Supabase,
* copie claves de Supabase,
* configure Supabase Auth URLs,
* cree cuenta Resend,
* verifique dominio en Resend,
* añada registros DNS en IONOS,
* cree API Key de Resend,
* cree productos en Stripe,
* cree precios en Stripe,
* copie IDs `price_xxx`,
* copie `STRIPE_SECRET_KEY`,
* cree webhook en Stripe,
* copie `STRIPE_WEBHOOK_SECRET`,
* active Stripe Customer Portal,
* conecte GitHub con Vercel,
* cree proyecto en Vercel,
* añada variables de entorno en Vercel,
* despliegue en Vercel,
* configure dominio en Vercel,
* modifique DNS en IONOS,
* confirme paso a producción.

---

# 10. Reglas críticas de seguridad

Nunca exponer en cliente:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Solo pueden ser públicas:

```text
PUBLIC_SITE_URL
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
```

No guardar claves reales en Git.

No commitear `.env`.

Asegurar que `.gitignore` contiene:

```text
.env
.env.local
.env.production
.env.development
```

No activar acceso premium desde `/gracias`.

No confiar en `success_url` de Stripe para conceder permisos.

La fuente de verdad debe ser:

```text
Stripe Webhook
        ↓
Supabase subscriptions
        ↓
Control de acceso premium
```

No permitir que el cliente envíe directamente un `priceId`.

El cliente solo puede enviar identificadores internos:

```text
arcabucero-monthly
arcabucero-annual
maestre-campo-monthly
maestre-campo-annual
```

El backend traduce esos identificadores a los `price_xxx` reales.

---

# 11. Fase 0 — Inspección inicial

## Objetivo

Entender el proyecto antes de modificar nada.

## Acciones

Ejecuta:

```bash
pwd
ls
find . -maxdepth 4 -type f | sed 's#^\./##' | sort | head -250
cat package.json
cat astro.config.* 2>/dev/null || true
cat .gitignore 2>/dev/null || true
```

Identifica:

* gestor de paquetes,
* versión de Astro,
* si usa TypeScript,
* si ya usa Vercel,
* si ya tiene adaptador,
* si ya hay rutas API,
* si ya hay autenticación,
* si ya hay base de datos,
* si existe `.env.example`,
* estructura de páginas,
* estructura de componentes,
* estilos globales,
* layouts reutilizables,
* estructura visual existente.

## Salida obligatoria tras inspección

Antes de modificar nada, responde:

```text
## PLAN DE IMPLEMENTACIÓN PROPUESTO

He detectado:
- ...

Voy a aplicar estas fases:
1. ...
2. ...
3. ...

No haré configuraciones externas por ti. Cuando llegue a un punto donde necesite que crees claves, productos, DNS o variables, me detendré y te pediré exactamente lo necesario.

Empiezo por la Fase 1.
```

Después puedes continuar automáticamente con Fase 1.

---

# 12. Fase 1 — Preparación técnica del proyecto

## Objetivo

Preparar el proyecto para Vercel, variables de entorno y dependencias.

## Acciones autónomas

Si hay Git:

```bash
git status
git checkout -b feature/subscriptions-stripe-supabase-resend
```

Si no hay Git, no inicializar sin permiso.

Instalar dependencias:

```bash
npm install stripe resend @supabase/supabase-js @supabase/ssr
```

Instalar adaptador de Vercel:

```bash
npx astro add vercel
```

Revisar `astro.config.mjs`.

Configuración recomendada:

```js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
```

Si el proyecto ya usa `output: 'hybrid'`, mantenerlo salvo que haya una razón clara para cambiarlo.

Crear o actualizar `.env.example`:

```env
# Site
PUBLIC_SITE_URL=https://tudominio.com

# Supabase public
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJxxx

# Supabase private
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe prices
STRIPE_PRICE_ARCABUCERO_MONTHLY=price_xxx
STRIPE_PRICE_ARCABUCERO_ANNUAL=price_xxx
STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY=price_xxx
STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL=price_xxx

# Resend
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=Imperio Español <noreply@tudominio.com>
```

Actualizar `.gitignore` si falta:

```text
.env
.env.local
.env.production
.env.development
```

Crear `src/lib/env.ts`:

```ts
export function getRequiredEnv(name: string): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
```

## Validación

Ejecutar:

```bash
npm run build
```

Si falla por cambios propios, corregir.

Si falla por variables reales ausentes, documentarlo y continuar si todavía no son necesarias en tiempo de build.

Después continuar automáticamente a Fase 2.

---

# 13. Fase 2 — Preparar migración Supabase

## Objetivo

Crear el esquema de base de datos.

## Acciones autónomas

Crear:

```text
supabase/migrations/001_initial_schema.sql
```

Contenido:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  free_plan text not null default 'piquero' check (free_plan in ('piquero')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id) on delete set null,
  email text,

  stripe_customer_id text,
  stripe_subscription_id text unique,

  plan text not null check (plan in ('arcabucero', 'maestre_campo')),
  billing_interval text check (billing_interval in ('month')),
  status text not null,

  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_email_idx
on public.profiles(email);

create index if not exists subscriptions_email_idx
on public.subscriptions(email);

create index if not exists subscriptions_user_id_idx
on public.subscriptions(user_id);

create index if not exists subscriptions_stripe_customer_id_idx
on public.subscriptions(stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_id_idx
on public.subscriptions(stripe_subscription_id);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
create policy "Users can read own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, free_plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'piquero'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
```

Crear:

```text
supabase/README.md
```

Con estas instrucciones:

```markdown
# Supabase setup

1. Crea un proyecto en Supabase.
2. Ve a SQL Editor.
3. Ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`.
4. Confirma que existen:
   - public.profiles
   - public.subscriptions
5. Copia:
   - PUBLIC_SUPABASE_URL
   - PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
```

## Checkpoint obligatorio

Parar aquí.

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: SUPABASE_PROJECT_AND_SQL.

Necesito que hagas esto:

1. Crea un proyecto en Supabase.
2. Entra en SQL Editor.
3. Ejecuta el contenido de:
   supabase/migrations/001_initial_schema.sql
4. Confirma que se han creado estas tablas:
   - profiles
   - subscriptions
5. Copia las claves del proyecto.

Después necesito que me pegues estos datos:

- PUBLIC_SUPABASE_URL
- PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No seguiré modificando el proyecto hasta que me confirmes este paso.
```

---

# 14. Fase 3 — Integrar Supabase en el código

## Se activa cuando el usuario responde

```text
hecho, continúa
```

## Objetivo

Crear clientes Supabase y servicio de suscripciones.

## Acciones autónomas

Crear `src/lib/supabase/client.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../env';

export const supabase = createClient(
  getRequiredEnv('PUBLIC_SUPABASE_URL'),
  getRequiredEnv('PUBLIC_SUPABASE_ANON_KEY')
);
```

Crear `src/lib/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { getRequiredEnv } from '../env';

export const supabaseAdmin = createClient(
  getRequiredEnv('PUBLIC_SUPABASE_URL'),
  getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
```

Crear `src/lib/subscriptions.ts`:

```ts
import { supabaseAdmin } from './supabase/admin';

export type FreePlanName = 'piquero';
export type PaidPlanName = 'arcabucero' | 'maestre_campo';
export type BillingInterval = 'month';

export function isPaidPlan(plan: string | null | undefined) {
  return plan === 'arcabucero' || plan === 'maestre_campo';
}

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === 'active' || status === 'trialing';
}

export function isActivePaidSubscription(params: {
  plan?: string | null;
  status?: string | null;
}) {
  return isPaidPlan(params.plan) && isActiveSubscriptionStatus(params.status);
}

export function canAccessArcabucero(params: {
  plan?: string | null;
  status?: string | null;
}) {
  return (
    (params.plan === 'arcabucero' || params.plan === 'maestre_campo') &&
    isActiveSubscriptionStatus(params.status)
  );
}

export function canAccessMaestreCampo(params: {
  plan?: string | null;
  status?: string | null;
}) {
  return (
    params.plan === 'maestre_campo' &&
    isActiveSubscriptionStatus(params.status)
  );
}

export async function findUserIdByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('findUserIdByEmail error:', error);
    throw error;
  }

  return data?.id ?? null;
}

export async function upsertSubscription(params: {
  userId?: string | null;
  email?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: PaidPlanName;
  billingInterval?: BillingInterval | null;
  status: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
}) {
  const payload = {
    user_id: params.userId ?? null,
    email: params.email ?? null,
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    plan: params.plan,
    billing_interval: params.billingInterval ?? 'month',
    status: params.status,
    current_period_start: params.currentPeriodStart?.toISOString() ?? null,
    current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
    cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(payload, {
      onConflict: 'stripe_subscription_id',
    })
    .select()
    .single();

  if (error) {
    console.error('upsertSubscription error:', error);
    throw error;
  }

  return data;
}

export async function getSubscriptionByUserId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getSubscriptionByUserId error:', error);
    throw error;
  }

  return data;
}

export async function getSubscriptionByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getSubscriptionByEmail error:', error);
    throw error;
  }

  return data;
}

export async function hasActivePaidSubscriptionByUserId(userId: string) {
  const subscription = await getSubscriptionByUserId(userId);

  return isActivePaidSubscription({
    plan: subscription?.plan,
    status: subscription?.status,
  });
}
```

## Validación

Ejecutar:

```bash
npm run build
```

Si compila, continuar automáticamente a Fase 4.

---

# 15. Fase 4 — Preparar Resend

## Objetivo

Configurar emails transaccionales.

## Checkpoint obligatorio

Parar antes de escribir código dependiente de Resend real.

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: RESEND_DOMAIN_AND_API_KEY.

Necesito que hagas esto:

1. Crea una cuenta en Resend.
2. Añade el dominio o subdominio desde el que quieras enviar emails.
3. Resend te dará registros DNS.
4. Añade esos registros DNS en IONOS.
5. Espera a que Resend marque el dominio como verificado.
6. Crea una API Key.
7. Define el remitente, por ejemplo:
   Imperio Español <noreply@tudominio.com>

Después necesito que me pegues estos datos:

- RESEND_API_KEY
- RESEND_FROM_EMAIL

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No seguiré con los emails hasta que el dominio esté verificado o me confirmes que quieres probar solo en desarrollo.
```

---

# 16. Fase 5 — Integrar Resend

## Se activa cuando el usuario responde

```text
hecho, continúa
```

## Acciones autónomas

Crear `src/lib/resend.ts`:

```ts
import { Resend } from 'resend';
import { getRequiredEnv } from './env';

export const resend = new Resend(getRequiredEnv('RESEND_API_KEY'));
```

Crear `src/lib/emails.ts`:

```ts
import { resend } from './resend';
import { getRequiredEnv } from './env';

const from = getRequiredEnv('RESEND_FROM_EMAIL');

export async function sendPiqueroWelcomeEmail(params: {
  to: string;
  name?: string | null;
}) {
  const { to, name } = params;

  return resend.emails.send({
    from,
    to,
    subject: 'Tu cuenta PIQUERO está activa',
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Bienvenido${name ? `, ${name}` : ''}</h1>
        <p>Tu cuenta <strong>PIQUERO</strong> está activa.</p>
        <p>Ya formas parte del círculo de lectores y puedes acceder al contenido gratuito ampliado.</p>
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `Bienvenido${name ? `, ${name}` : ''}. Tu cuenta PIQUERO está activa. Ya formas parte del círculo de lectores y puedes acceder al contenido gratuito ampliado. Plus Ultra.`,
  });
}

export async function sendPaidWelcomeEmail(params: {
  to: string;
  name?: string | null;
  planName: 'ARCABUCERO' | 'MAESTRE DE CAMPO';
}) {
  const { to, name, planName } = params;

  const copy =
    planName === 'MAESTRE DE CAMPO'
      ? 'Ya tienes acceso superior al archivo, las crónicas premium y las ventajas reservadas de la comunidad.'
      : 'Ya puedes acceder al archivo completo, las crónicas premium y las rutas de lectura.';

  return resend.emails.send({
    from,
    to,
    subject: `Tu suscripción ${planName} está activa`,
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Bienvenido${name ? `, ${name}` : ''}</h1>
        <p>Tu suscripción <strong>${planName}</strong> está activa.</p>
        <p>${copy}</p>
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `Bienvenido${name ? `, ${name}` : ''}. Tu suscripción ${planName} está activa. ${copy} Plus Ultra.`,
  });
}

export async function sendPaymentFailedEmail(params: {
  to: string;
}) {
  return resend.emails.send({
    from,
    to: params.to,
    subject: 'No hemos podido procesar tu pago',
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Problema con el pago</h1>
        <p>No hemos podido procesar el último pago de tu suscripción.</p>
        <p>Actualiza tu método de pago para mantener el acceso al archivo.</p>
      </div>
    `,
    text: 'No hemos podido procesar el último pago de tu suscripción. Actualiza tu método de pago para mantener el acceso al archivo.',
  });
}

export async function sendSubscriptionCancelledEmail(params: {
  to: string;
}) {
  return resend.emails.send({
    from,
    to: params.to,
    subject: 'Tu suscripción ha sido cancelada',
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Suscripción cancelada</h1>
        <p>Tu suscripción ha sido cancelada correctamente.</p>
        <p>Tu cuenta PIQUERO seguirá disponible como acceso gratuito.</p>
      </div>
    `,
    text: 'Tu suscripción ha sido cancelada correctamente. Tu cuenta PIQUERO seguirá disponible como acceso gratuito.',
  });
}
```

Crear `src/pages/api/send-test-email.ts`:

```ts
import type { APIRoute } from 'astro';
import { sendPiqueroWelcomeEmail } from '../../lib/emails';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (import.meta.env.PROD) {
    return new Response('Not available in production', { status: 403 });
  }

  const body = await request.json();

  if (!body.email || typeof body.email !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await sendPiqueroWelcomeEmail({
    to: body.email,
    name: 'Pablo',
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

## Validación

Ejecutar:

```bash
npm run build
```

Si compila, continuar automáticamente a Fase 6.

---

# 17. Fase 6 — Preparar Stripe

## Objetivo

Crear Checkout y mapa seguro de precios.

## Checkpoint obligatorio

Parar antes de crear lógica definitiva de Stripe.

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: STRIPE_PRODUCTS_AND_PRICES.

Necesito que hagas esto en Stripe, en modo test:

1. Crea el producto ARCABUCERO.
2. Crea el producto MAESTRE DE CAMPO.
3. Crea precio recurrente ARCABUCERO mensual: 1,99 €/mes.
4. Crea precio recurrente ARCABUCERO anual: 17,99 €/año.
5. Crea precio recurrente MAESTRE DE CAMPO mensual: 3,99 €/mes.
6. Crea precio recurrente MAESTRE DE CAMPO anual: 37,99 €/año.
7. Copia los cuatro IDs de precio, que empiezan por price_.
8. Copia tu STRIPE_SECRET_KEY de test, que empieza por sk_test_.

Después necesito que me pegues estos datos:

- STRIPE_SECRET_KEY
- STRIPE_PRICE_ARCABUCERO_MONTHLY
- STRIPE_PRICE_ARCABUCERO_ANNUAL
- STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY
- STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL

Todavía no necesito el STRIPE_WEBHOOK_SECRET. Lo pediremos después de tener URL pública.

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No seguiré con Stripe Checkout hasta tener estos datos.
```

---

# 18. Fase 7 — Integrar Stripe Checkout

## Se activa cuando el usuario responde

```text
hecho, continúa
```

## Acciones autónomas

Crear `src/lib/stripe.ts`:

```ts
import Stripe from 'stripe';
import { getRequiredEnv } from './env';

export const stripe = new Stripe(getRequiredEnv('STRIPE_SECRET_KEY'));
```

Crear `src/lib/stripe-prices.ts`:

```ts
import { getRequiredEnv } from './env';

export type CheckoutPlan =
  | 'arcabucero-monthly'
  | 'arcabucero-annual'
  | 'maestre-campo-monthly'
  | 'maestre-campo-annual';

export const checkoutPlans: Record<CheckoutPlan, {
  priceId: string;
  plan: 'arcabucero' | 'maestre_campo';
  billingInterval: 'month' | 'year';
  label: string;
}> = {
  'arcabucero-monthly': {
    priceId: getRequiredEnv('STRIPE_PRICE_ARCABUCERO_MONTHLY'),
    plan: 'arcabucero',
    billingInterval: 'month',
    label: 'ARCABUCERO mensual',
  },
  'arcabucero-annual': {
    priceId: getRequiredEnv('STRIPE_PRICE_ARCABUCERO_ANNUAL'),
    plan: 'arcabucero',
    billingInterval: 'year',
    label: 'ARCABUCERO anual',
  },
  'maestre-campo-monthly': {
    priceId: getRequiredEnv('STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY'),
    plan: 'maestre_campo',
    billingInterval: 'month',
    label: 'MAESTRE DE CAMPO mensual',
  },
  'maestre-campo-annual': {
    priceId: getRequiredEnv('STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL'),
    plan: 'maestre_campo',
    billingInterval: 'year',
    label: 'MAESTRE DE CAMPO anual',
  },
};

export function getCheckoutPlan(input: unknown) {
  if (typeof input !== 'string') {
    return null;
  }

  if (!(input in checkoutPlans)) {
    return null;
  }

  return checkoutPlans[input as CheckoutPlan];
}
```

Crear `src/pages/api/create-checkout-session.ts`:

```ts
import type { APIRoute } from 'astro';
import { stripe } from '../../lib/stripe';
import { getRequiredEnv } from '../../lib/env';
import { getCheckoutPlan } from '../../lib/stripe-prices';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const siteUrl = getRequiredEnv('PUBLIC_SITE_URL');
    const body = await request.json();

    const selectedPlan = getCheckoutPlan(body.plan);

    if (!selectedPlan) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const email =
      typeof body.email === 'string' && body.email.includes('@')
        ? body.email
        : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/suscribirse`,
      metadata: {
        plan: selectedPlan.plan,
        billingInterval: selectedPlan.billingInterval,
      },
      subscription_data: {
        metadata: {
          plan: selectedPlan.plan,
          billingInterval: selectedPlan.billingInterval,
        },
      },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-checkout-session error:', error);

    return new Response(JSON.stringify({ error: 'Unable to create checkout session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

Crear o adaptar `src/pages/suscribirse.astro`.

Debe mostrar:

```astro
---
---

<main>
  <h1>Elige tu acceso</h1>
  <p>Accede al archivo, las crónicas completas y las rutas de lectura.</p>

  <section class="plans">
    <article>
      <h2>PIQUERO</h2>
      <p>Entrada gratuita al círculo de lectores.</p>
      <p>Gratis</p>
      <a href="/login">Crear cuenta gratis</a>
    </article>

    <article>
      <h2>ARCABUCERO</h2>
      <p>Archivo completo, crónicas premium y rutas de lectura.</p>
      <p>1,99 €/mes o 17,99 €/año</p>
      <button data-plan="arcabucero-monthly">Suscribirme</button>
      <button data-plan="arcabucero-annual">Suscripción anual</button>
    </article>

    <article>
      <h2>MAESTRE DE CAMPO</h2>
      <p>Acceso superior, ventajas reservadas y prioridad en futuras acciones.</p>
      <p>3,99 €/mes o 37,99 €/año</p>
      <button data-plan="maestre-campo-monthly">Suscribirme</button>
      <button data-plan="maestre-campo-annual">Suscripción anual</button>
    </article>
  </section>
</main>

<script>
  const buttons = document.querySelectorAll('button[data-plan]');

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const plan = button.getAttribute('data-plan');

      button.setAttribute('disabled', 'true');

      try {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plan }),
        });

        const data = await response.json();

        if (data.url) {
          window.location.href = data.url;
          return;
        }

        alert(data.error || 'No se pudo iniciar el pago.');
      } catch (error) {
        console.error(error);
        alert('No se pudo iniciar el pago.');
      } finally {
        button.removeAttribute('disabled');
      }
    });
  });
</script>
```

Crear `src/pages/gracias.astro`:

```astro
<main>
  <h1>Gracias por suscribirte</h1>
  <p>Estamos confirmando tu suscripción de forma segura.</p>
  <p>Recibirás un email de bienvenida cuando Stripe confirme el pago.</p>
  <a href="/cuenta">Ir a mi cuenta</a>
</main>
```

## Validación

Ejecutar:

```bash
npm run build
```

Si compila, continuar automáticamente a Fase 8.

---

# 19. Fase 8 — Despliegue inicial en Vercel

## Objetivo

Obtener una URL pública para configurar webhooks y Auth redirects.

## Checkpoint obligatorio

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: VERCEL_INITIAL_DEPLOY.

Necesito que hagas esto:

1. Sube el proyecto a GitHub si todavía no está subido.
2. Crea un proyecto en Vercel conectado a ese repositorio.
3. Añade en Vercel las variables de entorno que ya tenemos:
   - PUBLIC_SITE_URL
   - PUBLIC_SUPABASE_URL
   - PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - STRIPE_SECRET_KEY
   - STRIPE_PRICE_ARCABUCERO_MONTHLY
   - STRIPE_PRICE_ARCABUCERO_ANNUAL
   - STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY
   - STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL
   - RESEND_API_KEY
   - RESEND_FROM_EMAIL
4. Lanza un deploy.
5. Copia la URL pública de Vercel.

Después necesito que me pegues:

- VERCEL_PUBLIC_URL

Ejemplo:
https://tu-proyecto.vercel.app

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No continuaré con webhooks ni Auth redirects hasta tener URL pública.
```

---

# 20. Fase 9 — Configurar Stripe Webhook

## Checkpoint obligatorio

Cuando exista URL pública, parar:

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: STRIPE_WEBHOOK_SECRET.

Necesito que hagas esto en Stripe:

1. Ve a Developers > Webhooks.
2. Crea un endpoint con esta URL:
   VERCEL_PUBLIC_URL/api/stripe-webhook
3. Activa estos eventos:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
4. Copia el signing secret, que empieza por whsec_.
5. Añádelo también en Vercel como variable:
   STRIPE_WEBHOOK_SECRET

Después necesito que me pegues:

- STRIPE_WEBHOOK_SECRET

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No crearé ni probaré el webhook hasta tener el signing secret.
```

---

# 21. Fase 10 — Implementar Stripe Webhook

## Se activa cuando el usuario responde

```text
hecho, continúa
```

## Acciones autónomas

Crear `src/pages/api/stripe-webhook.ts`:

```ts
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { stripe } from '../../lib/stripe';
import { getRequiredEnv } from '../../lib/env';
import {
  findUserIdByEmail,
  upsertSubscription,
} from '../../lib/subscriptions';
import {
  sendPaidWelcomeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from '../../lib/emails';

export const prerender = false;

const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SECRET');

function getPlanFromMetadata(metadata?: Stripe.Metadata | null): 'arcabucero' | 'maestre_campo' {
  return metadata?.plan === 'maestre_campo' ? 'maestre_campo' : 'arcabucero';
}

function getPlanLabel(plan: 'arcabucero' | 'maestre_campo') {
  return plan === 'maestre_campo' ? 'MAESTRE DE CAMPO' : 'ARCABUCERO';
}

async function getCustomerEmail(customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  return customer.email ?? null;
}

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const email =
          session.customer_details?.email ||
          session.customer_email ||
          null;

        const userId = email ? await findUserIdByEmail(email) : null;
        const plan = getPlanFromMetadata(session.metadata);

        if (session.subscription) {
          await upsertSubscription({
            userId,
            email,
            stripeCustomerId: session.customer?.toString() ?? null,
            stripeSubscriptionId: session.subscription.toString(),
            plan,
            billingInterval: 'month',
            status: 'active',
          });
        }

        if (email) {
          await sendPaidWelcomeEmail({
            to: email,
            planName: getPlanLabel(plan),
          });
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        const stripeCustomerId = subscription.customer.toString();
        const email = await getCustomerEmail(stripeCustomerId);
        const userId = email ? await findUserIdByEmail(email) : null;
        const plan = getPlanFromMetadata(subscription.metadata);

        await upsertSubscription({
          userId,
          email,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          plan,
          billingInterval: 'month',
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : null,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const stripeCustomerId = subscription.customer.toString();
        const email = await getCustomerEmail(stripeCustomerId);
        const userId = email ? await findUserIdByEmail(email) : null;
        const plan = getPlanFromMetadata(subscription.metadata);

        await upsertSubscription({
          userId,
          email,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          plan,
          billingInterval: 'month',
          status: 'canceled',
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : null,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        if (email) {
          await sendSubscriptionCancelledEmail({ to: email });
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer?.toString();

        if (customerId) {
          const email = await getCustomerEmail(customerId);

          if (email) {
            await sendPaymentFailedEmail({ to: email });
          }
        }

        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
};
```

## Validación

Ejecutar:

```bash
npm run build
```

Si compila, continuar automáticamente a Fase 11.

---

# 22. Fase 11 — Configurar Supabase Auth URLs

## Checkpoint obligatorio

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: SUPABASE_AUTH_URLS.

Necesito que hagas esto en Supabase:

1. Ve a Authentication > URL Configuration.
2. Configura Site URL:
   VERCEL_PUBLIC_URL
3. Añade estas Redirect URLs:
   VERCEL_PUBLIC_URL/api/auth/callback
   http://localhost:4321/api/auth/callback

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No implementaré el login hasta que estas URLs estén configuradas.
```

---

# 23. Fase 12 — Implementar Auth, cuenta y premium

## Se activa cuando el usuario responde

```text
hecho, continúa
```

## Objetivo

Implementar login básico y acceso premium.

## Acciones autónomas

Crear:

```text
src/lib/supabase/server.ts
src/pages/login.astro
src/pages/api/auth/callback.ts
src/pages/api/auth/logout.ts
src/pages/cuenta.astro
src/pages/premium/index.astro
```

Implementar Supabase SSR con cookies usando `@supabase/ssr`.

Si la API del paquete cambia, inspeccionar los tipos instalados y adaptar.

## Reglas funcionales

`/login` debe permitir crear cuenta gratuita PIQUERO.

Al registrarse o iniciar sesión, el usuario queda como PIQUERO por defecto mediante el trigger `handle_new_user`.

`/cuenta` requiere usuario autenticado.

`/premium` requiere usuario autenticado y suscripción de pago activa.

Si no hay usuario:

```text
redirect /login
```

Si no hay suscripción activa:

```text
redirect /suscribirse
```

El acceso premium solo se concede si:

```ts
status === 'active' || status === 'trialing'
```

y el plan es:

```text
arcabucero
maestre_campo
```

## Validación

Ejecutar:

```bash
npm run build
```

Si compila, continuar automáticamente a Fase 13.

---

# 24. Fase 13 — Stripe Customer Portal

## Checkpoint obligatorio

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: STRIPE_CUSTOMER_PORTAL.

Necesito que hagas esto en Stripe:

1. Ve a Customer Portal.
2. Activa el portal.
3. Permite al usuario:
   - actualizar método de pago,
   - cancelar suscripción,
   - ver facturas.
4. Guarda la configuración.

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No crearé el endpoint de Customer Portal hasta que confirmes que está activado.
```

---

# 25. Fase 14 — Implementar Customer Portal

## Acciones autónomas

Crear:

```text
src/pages/api/create-customer-portal-session.ts
```

Debe:

* requerir usuario autenticado,
* buscar `stripe_customer_id` en Supabase,
* crear sesión con Stripe Billing Portal,
* devolver URL,
* redirigir de vuelta a `/cuenta`.

Validar con:

```bash
npm run build
```

Si compila, continuar automáticamente a Fase 15.

---

# 26. Fase 15 — Dominio IONOS y producción

## Checkpoint obligatorio

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: IONOS_DOMAIN_TO_VERCEL.

Necesito que hagas esto:

1. En Vercel, añade tu dominio al proyecto.
2. Vercel te mostrará los registros DNS necesarios.
3. Entra en IONOS.
4. Ve a la zona DNS del dominio.
5. Añade o modifica los registros que te pide Vercel.
6. Espera a que Vercel marque el dominio como válido.
7. Actualiza en Vercel:
   PUBLIC_SITE_URL=https://tudominio.com
8. Actualiza en Supabase:
   Site URL=https://tudominio.com
   Redirect URL=https://tudominio.com/api/auth/callback
9. Si usas Resend con el mismo dominio, confirma que sigue verificado.

Cuando lo hayas hecho, responde exactamente:

hecho, continúa

No pasaré a comprobación final hasta que el dominio esté validado.
```

---

# 27. Fase 16 — Comprobación final

## Acciones autónomas

Ejecutar:

```bash
npm run build
```

Buscar secretos accidentalmente:

```bash
grep -R "sk_live" . || true
grep -R "sk_test" . || true
grep -R "whsec_" . || true
grep -R "re_" . || true
grep -R "SUPABASE_SERVICE_ROLE_KEY" src || true
```

Confirmar que los secretos solo aparecen en `.env`, `.env.example` o archivos server-side.

Comprobar rutas:

```text
/suscribirse
/gracias
/login
/cuenta
/premium
/api/create-checkout-session
/api/stripe-webhook
/api/create-customer-portal-session
```

## Parada antes de modo live

```text
## ACCIÓN REQUERIDA POR EL USUARIO

He llegado al checkpoint: GO_LIVE_CONFIRMATION.

Antes de pasar a producción real necesito que confirmes:

1. Has probado un pago en Stripe test mode.
2. El webhook de test llega correctamente.
3. Supabase guarda la suscripción.
4. Resend envía el email de bienvenida.
5. El dominio definitivo ya apunta a Vercel.
6. Stripe live tiene productos y precios live creados:
   - ARCABUCERO 1,99 €/mes
   - ARCABUCERO 17,99 €/año
   - MAESTRE DE CAMPO 3,99 €/mes
   - MAESTRE DE CAMPO 37,99 €/año
7. Vercel tiene las variables live.
8. El webhook live está creado.
9. Resend tiene el dominio verificado.

Cuando lo hayas confirmado, responde exactamente:

confirmado, pasar a producción

No cambiaré nada a modo live hasta que lo confirmes explícitamente.
```

---

# 28. Entrega final

Cuando todo esté terminado, responder:

```text
## RESUMEN FINAL

Archivos creados:
- ...

Archivos modificados:
- ...

Variables configuradas:
- ...

Configuraciones externas realizadas por el usuario:
- ...

Comandos de prueba:
- ...

Rutas disponibles:
- ...

Limitaciones:
- ...

Siguiente paso recomendado:
- ...
```

No afirmar que algo está probado si no ha sido probado realmente.

---

# 29. Filosofía de implementación

Priorizar:

* simplicidad,
* seguridad,
* mantenimiento,
* despliegue rápido,
* mínima fricción,
* control real por webhooks,
* separación clara entre plan gratuito y planes de pago.

Primera versión suficiente:

```text
Login
+
PIQUERO gratis
+
ARCABUCERO 1,99 €/mes o 17,99 €/año
+
MAESTRE DE CAMPO 3,99 €/mes o 37,99 €/año
+
Stripe Checkout
+
Stripe Webhook
+
Supabase
+
Resend
+
Acceso premium básico
```

No implementar todavía:

* foro,
* CMS,
* newsletter avanzada,
* roles complejos,
* analítica avanzada,
* sistema de referidos,
* drops,
* panel admin complejo,
* planes anuales,
* cupones avanzados,
* facturación personalizada.

---

# 30. Dirección visual y textual

Cuando modifiques páginas visibles, respetar esta estética:

* premium,
* sobria,
* editorial,
* histórica,
* Siglo de Oro,
* blanco roto,
* negro,
* rojo profundo,
* dorado envejecido,
* sin estética política,
* sin tono panfletario,
* sin exceso de escudos.

Usar lenguaje como:

```text
Archivo
Crónicas
Papeles y tratados
Rutas de lectura
Gabinete
Mentidero
Círculo de lectores
Plus Ultra
```

Evitar lenguaje como:

```text
Compra ahora
Hazte VIP
Oferta irresistible
Premium brutal
Última oportunidad
```

La suscripción debe sentirse como acceso a un archivo cultural, no como una tienda genérica.

---

# 31. Copy recomendado para planes

## PIQUERO

```text
Entrada gratuita al círculo de lectores.
Accede a una selección de crónicas, manifiestos y papeles abiertos.
```

## ARCABUCERO

```text
Para quienes quieren leer el archivo completo.
Crónicas premium, artículos completos y rutas de lectura por 1,99 €/mes o 17,99 €/año.
```

## MAESTRE DE CAMPO

```text
Para quienes quieren sostener el proyecto y acceder al nivel superior.
Incluye todas las crónicas, ventajas reservadas y prioridad en futuras acciones por 3,99 €/mes o 37,99 €/año.
```

---

# 32. Principio final

No avanzar con supuestos falsos.

No inventar claves.

No saltarse checkpoints.

No activar acceso por retorno de Stripe.

No mezclar PIQUERO con Stripe.

Los planes de pago deben ofrecer opciones mensuales y anuales con sus precios de Stripe separados.

Trabajar siempre así:

```text
hacer lo autónomo
validar
seguir
parar solo cuando haya acción externa
pedir exactamente lo necesario
retomar después de "hecho, continúa"
```
