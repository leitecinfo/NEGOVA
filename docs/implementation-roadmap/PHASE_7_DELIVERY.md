# Fase 7 — Domicilios Completo

**Objetivo:** Completar la gestión de domicilios con zonas, mapa, configuración avanzada y seguimiento.  
**Depende de:** Base funcional ya implementada en delivery-service.ts  
**Puede ejecutarse en paralelo con Fase 6.**

---

## Tareas

### DOM-001 — Editor de zonas de entrega (Completada)
**ID:** DOM-001 | **Prioridad:** P1 | **Estado:** Completada | **Dependencias:** DEC-006 (proveedor de mapas)  

**Alcance:**
- Migración: tabla `delivery_zones` (business_id, name, description, tariff, min_order, estimated_time_min, priority, color, geometry JSONB, status)
- UI: pestaña "Zonas" en módulo de domicilios
  - Mapa interactivo con zonas dibujadas
  - Herramientas: "Dibujar polígono" o "Dibujar radio"
  - Modal "Nueva zona": nombre, descripción, tarifa, pedido mínimo, tiempo estimado, prioridad, color, estado activa
- Al crear pedido de domicilio: verificar si la dirección está dentro de alguna zona activa; aplicar tarifa correspondiente

**Criterios de aceptación:**
- Se puede dibujar una zona en el mapa con polígono o radio
- La zona se guarda con tarifa y tiempo estimado
- Al crear un pedido de domicilio dentro de la zona: se aplica la tarifa de la zona
- Al crear un pedido fuera de todas las zonas: muestra advertencia o rechaza

---

### DOM-002 — Configuración completa de domicilios
**ID:** DOM-002 | **Prioridad:** P1 | **Dependencias:** Ninguna | **Estado:** Completada  

**Alcance:**
- Pestaña "Configuración" en domicilios con secciones:
  1. **Tarifa por domicilio:** Fija por entrega (monto editable) / Por distancia / Por zona
  2. **Quién paga:** El cliente / El negocio / Compartido 50/50
  3. **Asignación:** Manual / Automática / Rotativa
  4. **Tiempos y alertas:** Tiempo máximo para aceptar (min), alerta si lleva más de X min, auto-reasignar si no acepta
  5. **Metas y bonificaciones:** Meta diaria de entregas, bonificación al cumplir, bonificación nocturna
- Persistir en `businesses.settings.delivery`
- Botón "Guardar configuración"

**Criterios de aceptación:**
- Se puede configurar tarifa fija de \$5.000 que el cliente paga
- Se puede configurar tiempo máximo de 30 minutos con alerta
- La configuración persiste al recargar
- La tarifa configurada se aplica al crear pedidos de domicilio

---

### DOM-003 — Vista por repartidor
**ID:** DOM-003 | **Prioridad:** P1 | **Dependencias:** Ninguna | **Estado:** Completada  

**Alcance:**
- Pestaña "Por Repartidor" en domicilios
- Vista agrupada por repartidor (o "Sin asignar")
- Cada repartidor muestra: pedidos activos, tiempo transcurrido, estado de entrega
- Monitoreo en tiempo real con Supabase Realtime
- Tests unitarios en `tests/unit/workspace-dom-003-driver-view.test.ts`


**Criterios de aceptación:**
- Los pedidos se agrupan visualmente por repartidor asignado
- Los pedidos sin asignar aparecen en un grupo separado
- El tiempo transcurrido se actualiza en tiempo real

---

### DOM-004 — Seguimiento de pedido para cliente (Completada)
**ID:** DOM-004 | **Prioridad:** P2 | **Estado:** Completada | **Dependencias:** DOM-001  

**Alcance & Implementación:**
- **Modelo y Generación de Códigos ([`src/lib/delivery/tracking-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/tracking-service.ts)):**
  - Generación de código criptográfico de seguimiento tipo `TRK-XXXXXX` con 6 caracteres alfanuméricos en mayúsculas no ambiguos (sin 0, 1, I, O).
  - Almacenamiento en columna `tracking_code` de `restaurant_orders` e indexado con migración [`20261101190000_delivery_tracking_codes.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261101190000_delivery_tracking_codes.sql), con compatibilidad de notas `[TRK:XXXXXX]`.
  - Sanitización estricta de notas públicas (`sanitizePublicNotes`): elimina tags `[PIN:...]` y `[TRK:...]` para garantizar cero exposición de datos sensibles.
- **Ruta Pública de Seguimiento ([`/seguimiento/[trackingCode]`](file:///d:/Proyectos/NEGOVA/src/app/seguimiento/[trackingCode]/page.tsx)):**
  - Sin necesidad de autenticación, acceso público indexado por código único.
  - Barra de progreso visual con 4 pasos interactivos: **Confirmado** (25%) → **Preparando** (50%) → **En camino** (75%) → **Entregado** (100%), con soporte para órdenes canceladas.
  - Sincronización en tiempo real vía Supabase Realtime (`postgres_changes` en `restaurant_orders`) con polling periódico resiliente cada 8 segundos mediante Server Action [`getOrderTrackingAction`](file:///d:/Proyectos/NEGOVA/src/app/seguimiento/[trackingCode]/actions.ts).
  - Portal buscador complementario en [`/seguimiento`](file:///d:/Proyectos/NEGOVA/src/app/seguimiento/page.tsx).
- **Notificación por WhatsApp ([`src/lib/whatsapp/order-whatsapp-format.ts`](file:///d:/Proyectos/NEGOVA/src/lib/whatsapp/order-whatsapp-format.ts)):**
  - Inclusión automática del enlace de seguimiento directo en el resumen formateado para el cliente al crear un pedido a domicilio.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-dom-004-order-tracking.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dom-004-order-tracking.test.tsx) (**14/14 pruebas aprobadas al 100%**).

**Criterios de aceptación:**
- Al crear un pedido de domicilio, se genera un código de seguimiento
- El cliente puede abrir el enlace y ver el estado actual
- El estado se actualiza automáticamente sin recargar (Realtime o polling)
- No se exponen datos sensibles (no muestra PIN ni datos del repartidor)

---

### DOM-005 — Evaluar integraciones externas (Completada)
**ID:** DOM-005 | **Prioridad:** P3 | **Estado:** Completada | **Dependencias:** DEC-007  

**Alcance & Implementación:**
- **Evaluación Técnica & Financiera:** Documento completo en [`docs/08-integraciones-servicios/8.2-evaluacion-integraciones-delivery-rappi-justo.md`](file:///d:/Proyectos/NEGOVA/docs/08-integraciones-servicios/8.2-evaluacion-integraciones-delivery-rappi-justo.md) resolviendo `DEC-007` con estrategia híbrida (canal directo 0% comisión prioritario + agregadores centralizados).
- **Servicio & Tipos:** [`src/lib/delivery/integration-types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/integration-types.ts) y [`src/lib/delivery/delivery-integrations-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/delivery-integrations-service.ts) con cálculo financiero, generación de webhooks por tenant, ingesta de órdenes y simulador.
- **Ruta de Webhooks:** [`src/app/api/integrations/delivery/webhook/[provider]/route.ts`](file:///d:/Proyectos/NEGOVA/src/app/api/integrations/delivery/webhook/[provider]/route.ts) para ingesta de órdenes desde Rappi y Justo en `restaurant_orders`.
- **UI Interactiva:** Pestaña "Integraciones (Rappi / Justo)" con componente [`DeliveryIntegrationsTab`](file:///d:/Proyectos/NEGOVA/src/components/delivery/delivery-integrations-tab.tsx) integrado en [`DeliveriesClient`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/domicilios/deliveries-client.tsx):
  - Simulador dinámico de margen neto según ticket y costo de ingredientes.
  - Formulario de credenciales (App ID, Secret, API Key, Store ID, entorno Sandbox/Producción).
  - URL de webhook generada por negocio con botón copiar.
  - Simulador de pedidos de prueba con feedback vía toast (cero alertas nativas).
  - Guía paso a paso interactiva (1 a 5) con enlaces a documentación de desarrolladores.
- **Pruebas Automatizadas:** Suite unitaria [`tests/unit/workspace-dom-005-integrations.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dom-005-integrations.test.ts) (9/9 pruebas aprobadas al 100%).

---

## Criterios de Finalización de Fase 7
- [x] Se pueden crear zonas de entrega con tarifa y tiempo (DOM-001)
- [x] La configuración de domicilios es completa y persistente (DOM-002)
- [x] La vista por repartidor funciona con datos en tiempo real (DOM-003)
- [x] El seguimiento de pedidos funciona para el cliente (DOM-004)
- [x] Las integraciones externas están evaluadas, documentadas e integradas operativamente (DOM-005)

