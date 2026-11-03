# NEGOVA — Decisiones Pendientes y Riesgos Técnicos

> Fecha: 2026-10-29  
> Requieren aprobación explícita antes de ejecutar las tareas relacionadas.

---

## 1. Decisiones que Requieren Aprobación

### DEC-001 — Migración del Stock de metadata JSONB a tabla normalizada
**Prioridad:** Alta — Bloquea Fase 2 (Inventario) y Fase 3 (Recetas)  
**Situación actual:** El stock se almacena en `products.metadata.stock_quantity` (JSONB). Funcional pero limita el control por ubicación, los movimientos auditables y las recetas.  
**Opciones:**
1. **Crear tabla `inventory_stock` normalizada** con migración de datos existentes del JSONB
2. **Mantener JSONB** para stock simple y añadir tabla solo para ingredientes con control avanzado
3. **Migración por fases:** Crear tabla nueva y deprecar JSONB gradualmente

**Riesgo de opción 1:** Requiere migrar datos de producción. Los negocios que ya tienen stock en metadata podrían perder datos si la migración no es correcta.  
**Recomendación:** Opción 1 con migración cuidadosa y reversible.  
**Decisión requerida:** ¿Cuál opción elegir?

---

### DEC-002 — Integración entre restaurant_orders y business_sale_documents
**Prioridad:** Alta — Bloquea integridad financiera  
**Situación actual:** Existen dos sistemas paralelos:
- `restaurant_orders` — pedidos operativos del POS y restaurante
- `business_sale_documents` — historial oficial de ventas

Un pedido del POS puede NO crear un documento de venta (Etapa 8 de HOJA-DE-RUTA-POS.md).  
**Pregunta:** ¿Deben ser el mismo registro o permanecer separados con una FK de relación?  
**Implicación:** Si se unifican, el flujo completo es: `restaurant_order` → (al pagar) → `business_sale_document`. Si se mantienen separados, ambos deben sincronizarse.  
**Recomendación:** FK de referencia: al completar el pago de un `restaurant_order`, crear o vincular un `business_sale_document`.  
**Decisión requerida:** ¿Unificar o mantener separados con relación FK?

---

### DEC-003 — Facturación Electrónica DIAN
**Prioridad:** Media (puede diferirse)  
**Situación actual:** Los campos de configuración DIAN existen en el formulario de configuración pero no hay integración funcional con la DIAN.  
**Requerimiento:** Requiere:
- Resolución fiscal de la empresa (número asignado por DIAN)
- Credenciales de proveedor tecnológico habilitado ante DIAN
- Certificado digital
**Estado:** Bloqueada hasta que el negocio tenga su resolución y proveedor.  
**Decisión requerida:** ¿Con qué proveedor tecnológico se integrará? (SIIGO, World Office, FacturAPI, etc.)

---

### DEC-004 — Modelo de Cajas y Turnos
**Prioridad:** Alta — Bloquea Fase 6  
**Situación actual:** No existe tabla de cajas ni turnos.  
**Propuesta de esquema:**
```sql
cash_registers (id, business_id, name, location, is_active)
cash_sessions (id, register_id, business_id, opened_by, opened_at, closed_by, closed_at, initial_amount, status: open|closed)
cash_movements (id, session_id, business_id, type: sale|expense|entry|withdrawal, amount, method, reference_id, created_by)
```
**Pregunta:** ¿Se requiere una caja por POS o múltiples cajas por ubicación? ¿El turno es por día o por jornada manual?  
**Decisión requerida:** Confirmar modelo de datos propuesto antes de crear la migración.

---

### DEC-005 — Repartidores: JSONB vs Tabla Normalizada
**Prioridad:** Media  
**Situación actual:** Los repartidores operativos se guardan en `businesses.settings.delivery_drivers` (JSONB). Funciona pero limita consultas y reportes.  
**Opciones:**
1. Mantener JSONB (actual — no rompe nada)
2. Crear tabla `delivery_drivers` y migrar
**Recomendación:** Crear tabla al implementar Fase 7 (Domicilios completo) y migrar datos existentes.  
**Decisión requerida:** ¿Migrar en Fase 7 o mantener JSONB?

---

### DEC-006 — Zonas de Entrega con Mapa
**Prioridad:** Media  
**Pregunta:** ¿Qué proveedor de mapas se usará para las zonas de entrega?
- Google Maps API (requiere billing habilitado)
- Mapbox (alternativa más económica)
- Leaflet con OpenStreetMap (gratuito, menos features)  
**Decisión requerida:** Proveedor de mapas.

---

### DEC-007 — Integraciones de Delivery Externo (Rappi, Justo)
**Prioridad:** Baja (P3)  
**Estado:** Resuelta (Tarea [DOM-005])  
**Resolución:** Enfoque Híbrido Documentado e Implementado:  
1. **Canal Propio Prioritario (0% Comisión):** NEGOVA Domicilios Directos se posiciona como el canal principal de venta con 0% de comisión por pedido, reteniendo margen neto superior (~60% de margen frente a ~33% con comisiones de agregadores) y propiedad absoluta de los datos de clientes.
2. **Integración Externa Unificada (Rappi & Justo):** Ingesta desacoplada mediante Webhooks en `/api/integrations/delivery/webhook/[provider]` mapeando órdenes externas al esquema canónico `restaurant_orders` con canal respectivo (`rappi` o `justo`).
3. **Plataforma y Experiencia:** Guía interactiva en la pestaña "Integraciones" de `/workspace/[businessId]/pedidos/domicilios` con comparador de comisiones/márgenes, configuración de credenciales (App ID, Client Secret, API Key, Store ID), URL de webhook generada por tenant y simulador de pedidos para validación sin costo.  
**Documento de Evaluación:** `docs/08-integraciones-servicios/8.2-evaluacion-integraciones-delivery-rappi-justo.md`.

---

### DEC-008 — Planes y Límites del Sistema
**Prioridad:** Alta  
**Situación actual:** Solo los productos tienen validación de límite de plan en el servidor (`checkProductPlanLimit`). El resto de recursos (usuarios, ubicaciones, módulos) no tienen validación real.  
**Pregunta:** ¿Cuáles son los límites por plan para cada recurso?  
```
Plan Inicio: 50 productos, ? usuarios, ? ubicaciones
Plan Crece: 200 productos, ? usuarios, ? ubicaciones
Plan Negocio: Ilimitado, ?, ?
```
**Decisión requerida:** Definir tabla completa de límites por plan y por recurso.

---

## 2. Riesgos Técnicos

### RISK-001 — RLS de products/categories sin filtro tenant
**Severidad:** Alta  
**Descripción:** La política RLS inicial en `products` y `categories` usa `USING (true)`, permitiendo a cualquier usuario autenticado con JWT leer datos de otros negocios vía cliente Supabase directo. La migración `20261013010000` probablemente corrige esto, pero debe verificarse.  
**Acción:** Verificar y confirmar que las políticas RLS tienen `business_id = auth.jwt() -> 'business_id'` o equivalente.  
**Estado:** Requiere verificación inmediata.

---

### RISK-002 — Descuento de stock al vender no es atómico
**Severidad:** Alta  
**Descripción:** Cuando se crea un pedido en `createRestaurantOrder()`, el descuento de stock se hace DESPUÉS de la RPC atómica (en un `try` separado). Si el proceso falla entre la RPC y el descuento, el pedido se crea pero el stock no se descuenta.  
**Impacto:** Inconsistencia de inventario en escenarios de fallo.  
**Solución:** Mover el descuento de stock dentro de la RPC PostgreSQL para garantizar atomicidad.

---

### RISK-003 — Dos sistemas de ventas sin integración
**Severidad:** Alta  
**Descripción:** `restaurant_orders` y `business_sale_documents` son paralelos. Un pedido del POS puede NO aparecer en el historial de ventas y viceversa.  
**Impacto:** Los reportes financieros pueden ser incorrectos.  
**Solución:** Vincular ambos sistemas (ver DEC-002).

---

### RISK-004 — Nómina con UI parcialmente construida pero inaccesible
**Severidad:** Media  
**Descripción:** La página `/nomina/page.tsx` redirige a `/modulo/nomina` (placeholder) en lugar de mostrar la UI ya construida en `workspace-nomina-client.tsx`.  
**Impacto:** Funcionalidad construida no accesible para el usuario.  
**Solución:** Corregir la redirección y conectar la UI al page.tsx.

---

### RISK-005 — PIN de entrega almacenado en texto en campo notes
**Severidad:** Media (aceptable con controles actuales)  
**Descripción:** El PIN de verificación de entrega se almacena en el campo `notes` del pedido en formato `[PIN:XXXX:intentos]`. Visible para cualquier usuario con permiso de ver pedidos.  
**Controles actuales:** Anti brute-force (5 intentos), el PIN cambia por pedido, el acceso al campo requiere autenticación.  
**Mejora recomendada:** Mover a columna dedicada con restricción de acceso por RLS o cifrado.  
**Decisión requerida:** ¿Migrar a columna dedicada? (Requiere migración y cambio de lógica en delivery-service.ts)

---

### RISK-006 — Server Actions sin validación de permisos granulares en módulos futuros
**Severidad:** Alta  
**Descripción:** Al implementar nuevos módulos (gastos, compras, inventario), deben usar `verifyWorkspaceAction(businessId, "permiso.requerido")` en cada action. El patrón existe y funciona, pero es fácil omitirlo.  
**Acción:** Revisar que TODAS las server actions de nuevos módulos tengan validación RBAC antes de ejecutar cualquier query.

---

### RISK-007 — Migraciones sin estrategia de rollback documentada
**Severidad:** Media  
**Descripción:** Las migraciones existentes no incluyen rollback scripts (`DOWN` migrations).  
**Acción:** Para las nuevas migraciones de Fases 2-10, crear scripts de rollback equivalentes.

---

## 3. Limitaciones Conocidas

- **QZ Tray para impresión directa:** Requiere software instalado en el equipo del cajero. No funciona sin instalación local.
- **WhatsApp API:** Depende de credenciales de MetaAPI. Si las credenciales expiran, las notificaciones fallan silenciosamente.
- **Realtime de Supabase:** Habilitado para `restaurant_orders` pero la UI del módulo de pedidos necesita confirmar que la suscripción está activa y funcional (no solo habilitada en BD).
- **Imágenes de productos:** El límite de 800x800px está documentado en referencia pero no validado en el servidor.

---

## 4. Elementos que NO deben modificarse sin consulta

1. **La RPC `create_restaurant_pos_order`** — Es el núcleo transaccional. Cualquier cambio requiere revisión profunda.
2. **El sistema de autenticación y sesiones** — `requireWorkspaceSession()` y `verifyWorkspaceAction()` son la primera línea de defensa.
3. **Los tipos de pedido** (`dine_in`, `takeout`, `delivery`) — Son el contrato base de todo el sistema.
4. **Las migraciones ya aplicadas en producción** — Solo se pueden agregar nuevas, nunca modificar las existentes.
5. **El esquema de `business_users` y suscripciones** — Afecta a todos los negocios activos.

