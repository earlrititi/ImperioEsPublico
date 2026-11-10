# Avisos PIQUERO y proteccion del registro

Fecha: 27 de octubre de 2026.

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

## Turnstile: web y proveedor configurados, comprobaciones pendientes

Se ha creado el widget Managed `Imperio E - Produccion` en Cloudflare, limitado
a `imperioes.com` y `www.imperioes.com`, sin pre-clearance. Por indicacion del
titular no se ha creado un widget ni modificado Supabase en Test. La clave publica
esta guardada solo en Vercel Production. `AUTH_CAPTCHA_ENABLED=true` esta publicado
con el commit `80e62e1`, despliegue `dpl_B4mEjvhzQqUKEdKw1D1xQZ8e6z5V` READY,
asignado a `imperioes.com` y `www.imperioes.com`.
Registro, acceso, recuperacion y reenvio devuelven HTML con el widget y la clave
publica real, CSP compatible y cache `private, no-store`. El widget real del
navegador obtuvo una respuesta. El titular introdujo la clave privada y guardo
Turnstile en Supabase Auth. La lectura posterior confirma el interruptor activado,
el proveedor Turnstile y ningun cambio pendiente, sin leer el contenido privado.
Eso confirma la configuracion guardada, no las pruebas de validacion o repeticion.

Los formularios de registro, acceso, magic link, recuperacion y reenvio admiten
el widget y pasan `captchaToken` a Supabase. El backend rechaza tokens ausentes,
duplicados o demasiado largos si `AUTH_CAPTCHA_ENABLED=true`; Supabase valida el
token con el proveedor antes de procesar la operacion protegida. Un token con
formato correcto no se considera verificado por la aplicacion.

La integracion nativa es necesaria: proteger solo `POST /registro` no evita
llamadas directas a la API publica de Auth. No se valida dos veces el mismo
token, porque Turnstile es de un solo uso. Se mantienen los limites por IP.

### Activacion coordinada

1. Reutilizar el widget Managed existente con los hosts `imperioes.com` y
   `www.imperioes.com`. No crear otro ni permitir cualquier hostname.
2. Guardar solo la clave publica como `PUBLIC_TURNSTILE_SITE_KEY` en el entorno
   correspondiente de Vercel. La clave privada va en Supabase Auth, no en Git,
   el frontend, los logs o el chat.
3. El titular ha limitado la activacion a produccion. Mantener Supabase Test
   intacto y ejecutar primero las pruebas aisladas con servicios simulados.
4. Preparar en Supabase Production > Authentication > Attack Protection la
   configuracion Turnstile. La clave privada se introduce por el flujo normal
   de secretos del proveedor, sin compartirla en el chat ni guardarla en el repo.
   No guardar la activacion mientras los formularios publicados no sean compatibles.
5. Coordinar la publicacion web con la activacion del mismo proveedor en Supabase
   de produccion. No habilitar Auth antes de disponer de la web compatible: los
   formularios antiguos sin token dejarian de funcionar.
6. Revisar y publicar la informacion de privacidad aplicable a Cloudflare antes
   de activar el widget. No habilita Google, Meta ni consentimiento comercial.
7. Verificar en ambos hosts que la proteccion esta activa tambien en Auth, que
   una solicitud directa sin token es rechazada y que una alta real confirmada
   produce un unico aviso. No confundir el indicador web con la configuracion
   externa de Supabase, que el panel no consulta.

El 27 de octubre se ha integrado el parche en la rama aislada
`fix/production-turnstile-20261027`, basada en la produccion `565896f`, conservando
los cambios posteriores de planes y footer. Una solicitud directa de acceso
con credenciales ficticias y sin CAPTCHA, realizada antes de activar el proveedor,
devolvio `invalid_credentials`. No se creo una cuenta ni se envio correo.
Se ha recuperado la sesion de Cloudflare y comprobado el mismo widget, Managed,
dos hostnames y sin pre-clearance. El titular completo el doble factor de GitHub
y Supabase ya esta accesible. El titular termino la configuracion de Attack
Protection y la guardo. El agente no ha recuperado ni copiado la clave privada.

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

El 27 de octubre `npm run verify:master` termino con codigo 0 en la rama aislada:
187 unitarias, 32 escenarios de registro/CAPTCHA, todas las integraciones, build,
tipos y lint, y cero vulnerabilidades de produccion. Se actualizaron dos pruebas
antiguas a las filas de planes y el interruptor de cookies publicados, sin cambiar
esos componentes. El widget de prueba oficial se renderizo en escritorio y en
390 px sin desbordamiento. Esa comprobacion visual local no acredita validacion
real ni proteccion nativa en Live.

- `npm run verify:master`: tipos, unitarias, build, lint e integraciones, incluida
  la nueva suite `npm run test:registration`.
- Las pruebas compiladas simulan Auth, almacenamiento y Resend, bloqueando la
  red real. Cubren alta sin confirmar, ambas confirmaciones, deduplicacion,
  usuario no verificado o email discordante, fallo de proveedor y reintento.
- Tambien prueban los cinco formularios con CAPTCHA requerido, ausente, invalido
  y valido; configuracion incompleta; y widget ausente cuando esta desactivado.
- Estas pruebas no acreditan una activacion real de Cloudflare o Supabase.

`scripts/verify-auth-captcha-live.mjs --production <archivo-env-existente>` espera
una respuesta real y fresca del widget por entrada estandar, nunca en argumentos.
Solo utiliza la configuracion publica de Auth y credenciales ficticias de un
correo aleatorio `example.invalid`: no crea cuentas, envia correos ni cobra.
Comprueba ausencia y falsificacion de token, validacion de una respuesta nueva,
rechazo de su repeticion y los formularios de acceso de ambos dominios sin token.
La validacion fresca debe superar CAPTCHA y terminar en `invalid_credentials`;
no se presenta como un inicio de sesion real. No usar una clave secreta como
entrada de prueba.

La ejecucion automatizada de esta prueba Live fue bloqueada por la politica del
entorno antes de iniciar el proceso: no se ejecutaron los seis casos ni se dio
por superada su validacion. No se reintento por otro canal. La respuesta efimera
preparada para la prueba se elimino. El titular confirmo que el acceso normal
desde la web funciona despues de guardar Turnstile. Es una comprobacion manual
confirmada por el titular; la pestaña ya estaba cerrada al intentar inspeccionar
el destino final. Sigue pendiente la prueba automatizada de tokens ausentes,
falsos, validos y reutilizados. No confundir este limite con las 32 pruebas
aisladas ya superadas, que utilizan transportes simulados.

Referencias: [CAPTCHA nativo de Supabase](https://supabase.com/docs/guides/auth/auth-captcha),
[validacion de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
