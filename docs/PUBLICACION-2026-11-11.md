# Publicación del conjunto integrado — 11 de noviembre de 2026

El titular solicitó publicar todos los cambios y autorizó expresamente aplicar las migraciones 050–054 en Supabase Production, manteniendo apagadas las nuevas campañas y secuencias. Esa autorización sigue vigente; no hay que solicitarla de nuevo para completar esta publicación.

## Código y conservación del trabajo

El snapshot `653b505` conserva los 131 archivos de la implementación local, incluida la eliminación previa de `public/images/subscription-x-brush.png`. El merge `5193f15` incorpora `origin/main` hasta `b0965ad` y conserva las modificaciones posteriores de planes, manifiesto, cookies y la aclaración de Stripe frente a GA4. La rama publicada es `feat/pergamino-integracion`.

La revisión final corrige el solapamiento del control de cookies con los créditos del pie. También conserva los PNG de `images/email/` al limpiar la compilación: el postbuild anterior retiraba la cabecera y el fondo del correo. Ahora comprueba los hashes de los cuatro assets activos contra su manifiesto y falla si alguno falta o difiere.

El script de migración permite usar `--cli` con la sesión oficial ya existente de Supabase. Las credenciales permanecen en su almacenamiento nativo. Sin `--apply` consulta únicamente las versiones pendientes. Las comprobaciones de esquema requieren todos los objetos y las firmas exactas de las funciones.

## Evidencia

- Base integrada: 241 pruebas unitarias correctas, tipos sin errores ni warnings, compilación, tres tareas de lint, integraciones, SEO, GA4, CMS, preferencias de correo, registro y configuración. Auditoría de dependencias de producción: cero vulnerabilidades.
- Tras fusionar producción: tipos, pruebas afectadas, lint de componentes, compilación y verificación de UX comercial correctos.
- PGlite 0.5.16: 49 SQL fuente hasta 054 aplicados; regresiones de consentimiento, permisos, entrega y recepción correctas. Las diez comprobaciones finales de tablas, vistas, columnas y funciones pasan. Los servicios Auth, almacenamiento y red son simulados: esta evidencia no certifica concurrencia o Auth de un Supabase Test remoto.
- Regresión de empaquetado: los cuatro assets del correo se conservan íntegros (524.457 bytes); la ausencia de la cabecera hace fallar el postbuild.
- Revisión final de Chrome en 390 y 1440 píxeles: sin desbordamientos ni errores JavaScript; los dos controles de cookies responden al clic y sincronizan su estado; las preferencias abren; los cuatro enlaces legales son visibles. El modal del manifiesto mantiene una única casilla comercial opcional, desmarcada. Catálogo e inventario están simulados y las peticiones externas y de escritura se bloquean.
- El runner real también se probó sobre una base PGlite 001–044 con ledger: aplica las cinco transacciones 050–054 en orden, preserva el runtime completo y una segunda ejecución no repite DDL. Se corrigió la extracción del `BEGIN` externo tras comentarios y se prevalidan los cinco archivos antes de la primera consulta remota.

Los logs y capturas se conservan fuera del repositorio, bajo `outputs/integracion-vscode/release-validation-2026-11-10` en la raíz de entrega original. No contienen credenciales reales en los artefactos públicos.

## Recuperación y estado externo

La CLI oficial 3.1.0 confirmó en modo de solo lectura que Supabase Production `pjrqozlyrjgugdraoght` llega hasta 044 y que 050–054 están pendientes. El runtime existente continúa habilitado con su fecha y digest previos; no se ha modificado.

Se obtuvo y validó un respaldo lógico privado y coherente de los datos de las siete tablas existentes afectadas, ocho catálogos de tabla, cuatro definiciones de función y el historial de migraciones. Está fuera de Git y no debe subirse a artefactos públicos. Es una recuperación acotada de esta modificación, no una copia íntegra del proyecto ni PITR. La consulta nativa de backups no mostró copias disponibles; el dump convencional no pudo ejecutarse porque no hay Docker/Podman.

El conector de consulta privada de Vercel devuelve `403` para el equipo `team_hQezVofPx29szeDrLNPRsFhI`. La publicación utiliza la integración GitHub → Vercel ya configurada y autorizada por el titular. Se comprobaron el permiso de actualización de `main` mediante `git push --dry-run`, la rama de producción y el contexto de estado de GitHub asociado al proyecto correcto. No se modifican permisos, protección, credenciales ni configuración de seguridad. La comprobación pública y los estados publicados por la integración permiten verificar el despliegue sin acceso a los logs privados del conector.

La migración y la publicación se coordinan en la misma ejecución. La nueva versión modifica la transición administrativa de entrega; la actualización de `main` sigue inmediatamente a la verificación del esquema.

El 11 de noviembre se renovó el respaldo privado y se aplicaron efectivamente 050, 051, 052, 053 y 054 en Supabase Production mediante la sesión nativa de la CLI. Las cinco versiones quedaron registradas en el ledger, las diez comprobaciones de esquema devolvieron `true` y el script confirmó que no cambiaron la activación, fecha de incorporación ni digest del runtime existente. La evidencia de esta ejecución está en `production-release-2026-11-11/migration-apply.log`, junto al respaldo actualizado, fuera del repositorio. No se invocaron workers, envíos ni pagos para verificarla.

## Continuación autorizada

1. Confirmar el proyecto `imperio-espa-ol-deploy`, su equipo, entorno de producción y commit mediante la configuración existente y la integración Git. Comprobar que `origin/main` no ha avanzado y conservar cualquier cambio posterior.
2. Comprobar la vigencia del respaldo y ejecutar con Node 24 `scripts/migrate-pergamino-production.mjs --cli --apply`. Confirmar el ledger 050–054, las diez comprobaciones de esquema y la igualdad del runtime anterior/posterior. No invocar workers para probar la publicación.
3. Publicar el commit final por la integración Git existente hacia `main`; no duplicarlo después mediante CLI. Verificar el despliegue exacto en estado Ready y sus dominios.
4. Comprobar mediante lecturas las páginas modificadas y las cuatro URLs HTTPS del correo, comparando sus hashes. Mantener cerradas por defecto las nuevas secuencias y conservar consentimientos, históricos, colas y datos legales obligatorios.

Esta publicación no autoriza envíos adicionales de prueba, campañas, backfills, cargos ni cambios de DNS, MX o seguridad. IONOS y la configuración de plantillas externas conservan el alcance pendiente descrito en el informe original.
