# Acceso con correo y contrasena

El correo electronico es el identificador de acceso. No existe una contrasena
compartida ni se asignan contrasenas a los propietarios desde administracion.

- /registro: correo, contrasena repetida y aceptacion legal; confirmacion por correo.
- /login: correo y contrasena; conserva el enlace de correo como alternativa.
- /confirmar-correo: reenvio de confirmacion sin revelar si existe la cuenta.
- /recuperar-contrasena: recuperacion o primera contrasena para cuentas existentes.
- /cuenta/contrasena: cambio con sesion verificada; despues solicita iniciar sesion.

Las nuevas contrasenas requieren 12 caracteres y un maximo de 72 bytes UTF-8.
Las contrasenas anteriores mas cortas siguen siendo validas para iniciar sesion.
El callback usa PKCE: abrir el enlace en el mismo navegador que inicio la solicitud.
Los formularios comprueban origen, limitan intentos y no registran contrasenas.
Las respuestas de cuenta y formularios son privadas y no se almacenan en cache.

Los permisos editoriales siguen dependiendo de app_metadata del servidor y de
correo confirmado. Registrarse no concede acceso de pago ni permisos de admin.
Los cambios no habilitan cobros Live ni modifican existencias o reservas.

Validacion automatizada:
- npm test
- npm run check
- npm run lint
- npm run build
- npm run test:integration
- node scripts/verify-password-test.mjs (servidor Test local activo)

La prueba Test crea y elimina su propia cuenta temporal. Comprueba contrasena,
recuperacion de un solo uso y rechazo de la contrasena antigua. No envia correo:
la recepcion y apertura del nuevo correo de recuperacion requiere una prueba
del propietario, que debe elegir su contrasena personalmente.
