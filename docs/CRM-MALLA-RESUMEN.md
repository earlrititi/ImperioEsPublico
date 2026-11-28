# Cómo funciona la malla de correo

Corte de publicación: 23 de noviembre de 2026. Alcance comercial activo: `recovery_welcome`.

```mermaid
flowchart TD
    A["Persona verificada con permiso vigente"] --> B{"Estado actual"}
    B --> W["Bienvenida"]
    B --> C["Carrito abandonado"]
    B --> X["Checkout abandonado"]
    W --> P["Coordinador único: checkout > carrito > bienvenida"]
    C --> P
    X --> P
    P --> L["Límites: 1 correo comercial / 24 h y 3 / 7 días"]
    L --> V{"Revisión antes de enviar"}
    V -->|Apto| E["Plantilla común y seguimiento en admin/mail"]
    V -->|Aún no corresponde| D["Posponer o descartar el paso obsoleto"]
    V -->|Baja o bloqueo| S["Detener correo comercial"]
```

Los plazos se cuentan desde el evento que abre cada recorrido y son mínimos,
sujetos a prioridad, pertinencia y frecuencia:

| Recorrido | Plazos de referencia |
|---|---|
| Bienvenida | Inicio, +3, +5, +8 y +12 días |
| Carrito | +4 y +24 horas |
| Checkout | +1, +24 y +72 horas |

La recuperación requiere actividad reciente registrada y los permisos aplicables,
incluido el analítico. Una compra cancela la recuperación correspondiente. La
bienvenida editorial puede seguir siendo pertinente después de comprar; sus
ofertas convertidas se omiten. Los pasos atrasados no se acumulan para enviarse
todos juntos.

Los mensajes de servicio (cuenta, pedido y pago) mantienen su circuito separado.
Las automatizaciones por visitas o interés en producto y las de posventa y
fidelización permanecen apagadas. La ventana por zona horaria y los experimentos
A/B siguen como propuestas.

El plano A0 y el anexo literal se reproducen con los scripts descritos en
[CRM-REVIEW-ARTIFACTS.md](CRM-REVIEW-ARTIFACTS.md). El plano diferencia
implementación activa, funciones apagadas y propuestas.
