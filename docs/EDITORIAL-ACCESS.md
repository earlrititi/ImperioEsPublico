# Acceso editorial

Las cuentas autorizadas usan correo y contrasena, con enlace de correo alternativo.
No existe contrasena maestra, ruta secreta ni bypass por email en el frontend.

El servidor consulta auth.getUser y exige correo confirmado y
app_metadata.editorial_admin === true. user_metadata no concede permisos.
El permiso permite leer articulos de pago sin modificar suscripciones, Stripe
ni permisos de administracion de pedidos. La respuesta premium sigue siendo
private, no-store y el cuerpo no se incluye en artefactos publicos.

Asignacion idempotente a las dos cuentas autorizadas por el propietario:
node scripts/configure-editorial-admins.mjs --apply
Sin --apply solo consulta el estado. Credenciales exclusivamente en el archivo
local excluido de Git. Para retirar acceso, un operador autorizado debe cambiar
app_metadata.editorial_admin a false, conservando el resto de metadatos.

Las cuentas operativas quedan confirmadas al aplicar el script autorizado, pero
el script no genera ni modifica contrasenas. Las cuentas sin contrasena pueden
definirla desde /recuperar-contrasena o, una vez autenticadas, desde
/cuenta/contrasena. Los enlaces nuevos se verifican mediante token hash en el
servidor y pueden abrirse desde otro navegador.

El icono UserRound de Lucide lleva a /cuenta; sin sesion redirige a
/login?next=/cuenta. Comprobado a 1440 y 390 px, a la izquierda del menu.

Verificacion: 36 tests unitarios, Astro check sin errores (187 archivos), build
Production y 114 escenarios compilados. Incluye acceso editorial sin suscripcion,
rechazo de cuenta no confirmada y rechazo de metadatos editables por el usuario.
No se ha iniciado sesion suplantando a los propietarios ni se han abierto sus buzones.
