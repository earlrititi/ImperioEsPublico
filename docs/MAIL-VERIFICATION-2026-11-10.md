# Correo: comprobación y prueba del 10 de noviembre de 2026

El renderer local `src/lib/corporate-email.ts` está conectado al singleton y a todos los emisores directos inventariados. Las pruebas focalizadas de plantilla y correo administrativo pasan: 10/10 con Node 24. Los cuatro assets oficiales coinciden con el manifiesto del kit y pesan 92.068 bytes. No se sobrescribieron los cambios locales de otros módulos ni se realizaron despliegues, push o migraciones.

Se consultaron el remoto y los tres últimos despliegues de producción de Vercel mediante acceso autenticado de lectura:

- El más reciente, `dpl_7P9RzZ8rfWdwDPPt8bLfqwhUmjcQ`, procede de `main` en `b0965ad54d0eb82af9f00212e91eb1b87231778f`; ese commit solo añade una aclaración al dashboard comercial. Su árbol no contiene el renderer nuevo.
- Los dos anteriores, `dpl_DAG2PibNduwycYEkKHeSADDcfE7B` y `dpl_8k4x6vsPXqT11ARoznKrdqPRYWDi`, son publicaciones por CLI. Sus árboles tampoco contienen `corporate-email.ts` ni los assets del pergamino. El `resend.ts` recuperado del penúltimo no aplica `prepareCorporateEmail`.
- Las cuatro URLs `https://imperioes.com/images/email/pergamino-v1/*` nuevas devuelven 404. Por tanto, no se declara esta plantilla activa en producción.

El usuario autorizó una nueva prueba puntual a su buzón. Se envió un único correo desde la dirección corporativa, con asunto «Imperio Español | Prueba de pergamino · 10/11/2026», el renderer compartido y las cuatro imágenes incrustadas mediante CID, para revisarlo sin publicar assets. **Resend confirmó `delivered`.** El mensaje pasó la validación de contenido, referencias y ausencia de datos personales del titular. La clave del proveedor se utilizó solo en memoria; no se copió a QA, documentos ni logs.

La evidencia privada de la prueba, con el ID del proveedor y el último evento observado, se conserva en `outputs/integracion-vscode/authorized-preview-2026-11-10-result.json` bajo la raíz de entrega del 6 de noviembre. La clave de idempotencia y el registro de intento impiden repetir accidentalmente esta misma prueba. Un evento `delivered` acredita la entrega informada por el proveedor, no lectura, carpeta de destino o renderizado verificado en Gmail.

La plantilla corporativa pura y este correo de prueba no añaden datos personales de Adrián. Se mantiene la identificación legal/fiscal en los pies y documentos donde corresponde, tal como exige el traspaso. Las snapshots antiguas conservan su payload para respetar la idempotencia.

La implementación local está preparada y comprobada. Su publicación en producción sigue sujeta a la autorización explícita vigente; no se ha interpretado una solicitud de revisión o prueba de correo como permiso para desplegar.
