# Cortes de revisión CRM

Estos cortes fechados describen lo observado. No son contadores actuales ni
autorizan envíos adicionales. La matriz inicial completa se conserva en el
informe de trabajo del 16 de noviembre.

| Corte | Cuentas e incorporación | Elegibilidad y ejecución |
|---|---|---|
| 16/11/2026, auditoría inicial | 613 cuentas; 3 identidades comerciales canónicas | Bienvenida bloqueada por digest distinto. Bienvenida central, verificación de contactos y posventa apagadas. |
| 23/11/2026, antes de regularización | 49 cuentas verificadas identificadas como audiencia; 3 elegibles | Recuperación limitada a nueva actividad de carrito/checkout desde aprobación de las 08:09 CET. |
| 23/11/2026, incorporación autorizada | El titular confirmó permiso previo de 46 cuentas; cohorte inicial de 49 | Se registró la declaración del titular con su fuente propia. Sin inventar fecha original de aceptación ni una nueva acción individual; bajas previas conservadas. |
| 23/11/2026, activación a las 15:55 CET | Misma cohorte de 49 | Migraciones 060-061 aplicadas; coordinación publicada; scope `recovery_welcome`; límites 1/24 h y 3/7 días. No se incorporaron carritos históricos. |
| 23/11/2026, lectura a las 19:18 CET | 49 incorporadas históricamente, 41 elegibles en ese corte | 47 aceptaciones únicas: estados actuales 39 entregados, 7 rebotados y 1 suprimido por el proveedor. Los 8 bloqueos reducen elegibilidad; no se reenvía el historial. |

Tras ese último corte se pausó temporalmente el envío comercial para corregir
el pie de identidad heredado. La corrección se publicó con el commit
`9d8178b5068493caa0462b29c0761593546e6934` y se reanudaron los envíos mediante
la operación con guardas: runtime habilitado, pausa comercial desactivada,
41 elegibles y límites de 1/24 h y 3/7 días conservados. El contenido de
correos realmente enviados y sus recibos se conserva como prueba; una corrección
de plantilla solo modifica mensajes futuros.

## Distinciones de las métricas

- Incorporación no equivale a permiso perpetuo: nuevas bajas, rebotes y quejas
  pueden reducir la elegibilidad sin borrar la incorporación histórica.
- Aceptación por Resend no equivale a entrega. Se utiliza el estado actual del
  proveedor; una marca de entrega anterior no prevalece sobre un rebote tardío.
- Un estado `suppressed` del proveedor se bloquea también en marketing. No se
  atribuye automáticamente a una baja solicitada por la persona.
- Las recuperaciones requieren además analítica válida, intención vigente y
  ausencia de pago o pago en proceso. La bienvenida editorial elegible no exige
  ese permiso analítico.

La fidelización posventa, el interés en producto y las visitas genéricas siguen
fuera del alcance de activación descrito. La ventana horaria con zona acreditada
y los experimentos A/B permanecen como propuestas.
