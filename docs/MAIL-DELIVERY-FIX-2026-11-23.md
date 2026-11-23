# Supresión del proveedor y pie de los mensajes futuros

La ejecución autorizada incorporó 49 cuentas verificadas. En la lectura de las
18:18 UTC hubo 47 aceptaciones únicas: 39 con estado actual `delivered`, siete
`bounced` y una `suppressed`. No se confundieron marcas anteriores de entrega
con el estado posterior. El máximo de aceptación por destinatario fue uno.

Los siete rebotes ya estaban bloqueados automáticamente. Se reflejó también la
supresión existente del proveedor, sin quitarla ni reemplazar motivos previos;
quedaron 41 identidades elegibles en ese corte. El helper común extiende ese
comportamiento a los dos reconciliadores y al webhook firmado. Si no se guarda
el bloqueo, el webhook devuelve 503 para que Resend reintente. Una consulta de
Test redirigida no bloquea al cliente original.

La revisión visual detectó que el pie de `renderAdminMail` aún incorporaba los
datos del anterior titular. Se pausó temporalmente el circuito comercial y se
aplicó la corrección ya preparada en el checkout principal: identidad de marca
en el pie, sin modificar sus otros cambios locales ni los documentos legales.
Los mensajes nuevos y sus previsualizaciones usan ese pie. Una copia congelada
con el NIF retirado se rechaza antes del proveedor; no se reescribe su contenido
ni se reutiliza su clave con un payload diferente.

Los mensajes ya entregados no se pueden retirar o modificar. Su historial y
sus recibos se conservan. No se reenvió el histórico para corregir el pie.
Los documentos legales completos siguen siendo un trabajo separado.

QA: 332 pruebas unitarias, Astro Check sin errores/warnings (ocho hints previos),
compilación y ESLint correctos. El fixture compilado comprueba los tres caminos
de supresión, firma inválida, persistencia fallida y separación Live/Test sin
servicios reales. Las 61 variantes se regeneran y comprueban a 390/600 px antes
de entregar el catálogo final. No requiere migraciones nuevas ni aprobación de
otro digest comercial: las definiciones mantienen `82fe4925…`; conserva los
límites 1/24 h, 3/7 días y el alcance ya autorizado.

Fuente primaria del estado `suppressed`:
https://resend.com/changelog/email-suppression-visibility
