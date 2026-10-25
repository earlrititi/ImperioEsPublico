# Avisos PIQUERO y proteccion del registro

Fecha: 25 de octubre de 2026.

## Cambio de avisos

- Una identidad nueva sin `email_confirmed_at` ya no genera el aviso al titular.
- El aviso se solicita al completar la confirmacion de correo: `type=email`
  (plantilla desplegada actualmente), `type=signup` o callback PKCE de registro.
- La confirmacion por enlace funciona tambien sin la cookie del navegador donde
  se hizo el alta. Un GET del enlace, un enlace caducado y una recuperacion de
  contrasena no generan el aviso.
- Antes de reclamar el evento o enviar, `notifyLead` consulta el usuario real
  mediante Supabase Auth Admin. Requiere correo confirmado y coincidencia de
  identificador y email. No confia en una casilla, parametro o cookie del cliente.
- Se conserva el identificador anterior `registration + user.id`: no se duplican
  avisos ya enviados, aunque aquellos fueran anteriores a la confirmacion.
  Un fallo de correo se registra y no bloquea el acceso confirmado.
- Los nuevos avisos dicen que el correo esta confirmado, que la cuenta es
  gratuita y que no implica consentimiento comercial. No se reescribe el historial.
- No hay barrido ni envio retrospectivo de avisos. Los accesos normales con
  contrasena, magic link y recuperacion no hacen un reenvio de registros.

El dashboard conserva todas las cuentas, pero separa los recuentos de confirmadas
y pendientes y permite filtrar por ese estado. Ni una identidad creada ni un
aviso administrativo son prueba de actividad, de una compra o de consentimiento.
La elegibilidad de las automatizaciones ya exigia correo verificado y opt-in.
No se borra ninguna cuenta ni se etiqueta automaticamente como bot.

## Turnstile: integracion preparada, activacion externa pendiente

Se ha creado el widget Managed `Imperio E - Produccion` en Cloudflare, limitado
a `imperioes.com` y `www.imperioes.com`, sin pre-clearance. Por indicacion del
titular no se ha creado un widget ni modificado Supabase en Test. La clave publica
esta guardada solo en Vercel Production. `AUTH_CAPTCHA_ENABLED=false` permanece
desactivado hasta coordinar la web con la proteccion nativa de Supabase.
Esto no acredita por si solo que el CAPTCHA nativo este activo: siguen pendientes
su configuracion en Supabase, la publicacion coordinada y la validacion real.

Los formularios de registro, acceso, magic link, recuperacion y reenvio admiten
el widget y pasan `captchaToken` a Supabase. El backend rechaza tokens ausentes,
duplicados o demasiado largos si `AUTH_CAPTCHA_ENABLED=true`; Supabase valida el
token con el proveedor antes de procesar la operacion protegida. Un token con
formato correcto no se considera verificado por la aplicacion.

La integracion nativa es necesaria: proteger solo `POST /registro` no evita
llamadas directas a la API publica de Auth. No se valida dos veces el mismo
token, porque Turnstile es de un solo uso. Se mantienen los limites por IP.

### Activacion coordinada

1. Crear un widget Managed de Turnstile con los hosts `imperioes.com` y
   `www.imperioes.com`. No permitir cualquier hostname. Mantener Test separado.
2. Guardar solo la clave publica como `PUBLIC_TURNSTILE_SITE_KEY` en el entorno
   correspondiente de Vercel. La clave privada va en Supabase Auth, no en Git,
   el frontend, los logs o el chat.
3. Probar primero en Supabase Test y un hostname de preview permitido: Auth >
   Bot and Abuse Protection > Enable CAPTCHA protection > Turnstile > clave
   privada. Configurar `AUTH_CAPTCHA_ENABLED=true` en ese preview.
4. Comprobar alta, acceso, reenvio y recuperacion con tokens validos e invalidos,
   confirmacion por email y callback. No utilizar claves de prueba en Live.
5. Coordinar la publicacion web con la activacion del mismo proveedor en Supabase
   de produccion. No habilitar Auth antes de disponer de la web compatible: los
   formularios antiguos sin token dejarian de funcionar.
6. Revisar y publicar la informacion de privacidad aplicable a Cloudflare antes
   de activar el widget. No habilita Google, Meta ni consentimiento comercial.
7. Verificar en ambos hosts que la proteccion esta activa tambien en Auth, que
   una solicitud directa sin token es rechazada y que una alta real confirmada
   produce un unico aviso. No confundir el indicador web con la configuracion
   externa de Supabase, que el panel no consulta.

Si el flag esta activo pero falta la clave publica, el registro falla cerrado.
Si falla el proveedor, no se interpreta como un CAPTCHA valido. El error al
usuario es generico y no confirma si un email tiene cuenta.

## Verificacion reproducible

El 25 de octubre pasaron 187 pruebas unitarias y 32 escenarios especificos de
registro y CAPTCHA, ademas del resto de suites compiladas, tipos, build y lint.
El arbol instalado probado utiliza Zod 4.6.7. Tras sincronizar el lockfile,
`npm audit --omit=dev` termino con cero vulnerabilidades. Las comprobaciones son
aisladas: no crean cuentas reales ni envian correos, y no sustituyen la validacion
pendiente en produccion.

- `npm run verify:master`: tipos, unitarias, build, lint e integraciones, incluida
  la nueva suite `npm run test:registration`.
- Las pruebas compiladas simulan Auth, almacenamiento y Resend, bloqueando la
  red real. Cubren alta sin confirmar, ambas confirmaciones, deduplicacion,
  usuario no verificado o email discordante, fallo de proveedor y reintento.
- Tambien prueban los cinco formularios con CAPTCHA requerido, ausente, invalido
  y valido; configuracion incompleta; y widget ausente cuando esta desactivado.
- Estas pruebas no acreditan una activacion real de Cloudflare o Supabase.

Referencias: [CAPTCHA nativo de Supabase](https://supabase.com/docs/guides/auth/auth-captcha),
[validacion de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
