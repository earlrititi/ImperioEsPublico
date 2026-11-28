# Catálogo y diagrama CRM

Los artefactos se generan desde renderizadores reales con datos ficticios. No
consultar servicios ni cargar `.env.local` para este proceso. El exportador
bloquea `fetch`; las vistas de correo interceptan los recursos de marca y sirven
únicamente los originales de `public/`.

## Reproducir

Desde la raíz del proyecto, con Node 24 y las dependencias de la aplicación:

```powershell
node --import tsx scripts/export-crm-mail-catalog.mjs tmp/crm-catalogue
python scripts/verify-crm-mail-previews.py tmp/crm-catalogue tmp/crm-mail-previews
python scripts/render-crm-review.py tmp/crm-catalogue output/pdf
```

Para Python se requieren `reportlab`, `pymupdf`, `Pillow` y `playwright`; el
script de vistas usa Chrome headless instalado. Los scripts no envían correo,
no crean cargos y no alteran datos ni configuraciones externas.

La exportación produce `catalog.json`, un índice HTML y 61 variantes:
las 12 automatizaciones, ejemplos de cuenta y compra, acciones de Auth,
estados de Stripe, reservas y los dos correos de posventa. Las automatizaciones
conservan el cuerpo literal con `{{nombre}}`; los ejemplos dinámicos sustituyen
datos por valores ficticios. Cada registro incluye asunto, preheader, disparador,
segmento, CTA/enlaces, versión y hashes de fuente y resultado. Es un catálogo de
variantes de referencia, no una afirmación de que todos los estados posibles se
hayan ejecutado en producción.

## Estado de publicación

Sin `production-state.json` en el directorio del catálogo, el PDF presenta la
coordinación como pendiente. Para una revisión publicada, copiar allí únicamente
un manifiesto de estado verificado, sin datos personales ni secretos:

```json
{
  "coordinator_active": true,
  "welcome_approved": true,
  "commercial_paused": false,
  "activated_at": "2026-11-23T14:55:00Z",
  "production_commit": "9d8178b5068493caa0462b29c0761593546e6934",
  "scope": "recovery_welcome"
}
```

Ese fichero documenta el corte revisado; nunca activa un servicio. El estado
actual del proyecto debe comprobarse antes de regenerar una revisión posterior.
Las cifras iniciales de incorporación no equivalen a elegibilidad perpetua:
bajas, rebotes y reclamaciones reducen la audiencia admisible.

Una pausa comercial temporal debe constar también en ese manifiesto y en los
textos de estado del documento. No presentar como activos unos envíos pausados.
Los cambios futuros del pie de plantilla obligan a reexportar los ejemplos;
conservar el contenido y las pruebas de correos reales ya enviados.

## Comprobación de los resultados

- `verify-crm-mail-previews.py` comprueba 122 layouts, a 390 y 600 píxeles, sin
  desbordamiento horizontal y con los logos originales cargados. Guarda las PNG
  y tres hojas de contacto para inspección visual.
- `render-crm-review.py` produce exactamente dos PDF: una hoja A0 apaisada
  vectorial de 1189 × 841 mm y un anexo A4 de 62 páginas. Verifica que los 61
  cuerpos y asuntos están completos y que ningún bloque sale de la página.
- El directorio `rendered/` incluye PNG de cada página y hojas de contacto;
  inspeccionarlas después de cada cambio significativo.
- `pdf-verification.json` registra tamaño, páginas y SHA-256. Los hashes de
  plantilla del catálogo no sustituyen el digest de aprobación del runtime.

La referencia PDF original citada en el prompt no se encontró. El diagrama nuevo
representa los recorridos y condiciones de la implementación, con funciones
activas, apagadas y propuestas diferenciadas. Los experimentos y la ventana
horaria preferente permanecen como propuestas. La aceptación del proveedor no
acredita entrega, ni un clic o una apertura acredita una venta.
