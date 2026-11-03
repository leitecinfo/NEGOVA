# NEGOVA — Plan Maestro de Implementación Funcional del POS para Restaurantes

> **Fecha de elaboración:** 2026-10-29  
> **Referencia funcional:** TuyApp (25 bloques)  
> **Repositorio:** d:\Proyectos\NEGOVA  
> **Deploy:** https://negova.vercel.app/

---

## 1. Objetivo y Alcance

Completar, mejorar e integrar el sistema POS del vertical de restaurantes de NEGOVA, tomando como referencia funcional la plataforma TuyApp y su inventario de 25 bloques funcionales.

**No se construye desde cero.** El repositorio contiene módulos reales, servicios, tipos, migraciones y flujos que se aprovechan al máximo.

---

## 2. Resumen Ejecutivo del Estado Actual

### Lo que EXISTE y FUNCIONA (con evidencia en código)

| Módulo | Estado | Evidencia |
|--------|--------|-----------|
| Autenticación y sesiones | Implementado | `src/lib/auth/workspace-context.ts`, `(auth)/` routes |
| Navegación / Sidebar | Implementado | `workspace-shell.tsx`, `workspace-navigation.ts` con 5 grupos y 20+ módulos |
| Catálogo de productos | Implementado (Parcial) | `products-service.ts` con CRUD completo, pero sin inventario por ubicación, variantes en metadata JSON, sin importación masiva |
| Mesas y salas | Implementado (Parcial) | `restaurant-service.ts` con gestión completa de mesas, QR, estados; falta UI de salas |
| Pedidos/Órdenes | Implementado (Parcial) | `createRestaurantOrder()` con RPC atómica, validación de precios en servidor, idempotencia. Falta KDS visual y monitor de cocina |
| Domicilios/Delivery | Implementado (Parcial) | `delivery-service.ts` con repartidores, PIN de entrega, sesiones de despacho, zonas básicas. Falta UI de zonas y mapa |
| Clientes | Implementado (Parcial) | `customers-service.ts` con CRUD, búsqueda normalizada. Falta cartera/crédito |
| Empleados/Usuarios | Implementado | `src/app/workspace/[businessId]/usuarios/` con roles y permisos |
| Roles y permisos | Implementado | `src/app/workspace/[businessId]/roles/` con matriz de permisos |
| Menú QR / Presencia digital | Implementado (Parcial) | `src/app/workspace/[businessId]/presencia-digital/`, templates de menú en `src/components/menu/` |
| POS (venta directa) | Implementado (Parcial) | `src/components/pos/pos-screen-client.tsx` existe, falta integración completa con caja y apertura de turno |
| Ventas / Historial | Implementado | `src/app/workspace/[businessId]/ventas/` con listado y detalle |
| Configuración negocio | Implementado (Parcial) | `src/app/workspace/[businessId]/configuracion/` con datos básicos y documentos; falta configuración DIAN completa |
| WhatsApp | Implementado (Parcial) | `src/lib/whatsapp/` con múltiples servicios; integrado con pedidos. Falta UI de gestión |
| Notificaciones | Implementado | `src/app/workspace/[businessId]/notificaciones/` y servicio dedicado |
| Soporte | Implementado | `src/app/workspace/[businessId]/soporte/` con chat |

### Lo que está como PLACEHOLDER / PENDIENTE (modules con `under_construction`)

| Módulo | Estado en Código | Ruta |
|--------|-----------------|------|
| Proveedores | Placeholder `under_construction` | `modulo/proveedores` |
| Gastos | Placeholder `under_construction` | `modulo/gastos` |
| Finanzas | Placeholder `under_construction` | `modulo/finanzas` |
| Reportes avanzados | Placeholder `under_construction` | `modulo/reportes` |
| Caja / Cierres | Placeholder `under_construction` | `modulo/caja` |
| Inventario (Control de existencias) | Placeholder `under_construction` | `modulo/inventario` |
| Compras | Placeholder `under_construction` | `modulo/compras` |
| Cuentas por cobrar/pagar | Placeholder `under_construction` | `modulo/cuentas` |
| Monitor de Cocina (KDS) | Placeholder `under_construction` | `modulo/cocina` |
| Nómina | Placeholder `under_construction` | `modulo/nomina` |
| Recetas e Ingredientes | Sin ruta en workspace | No existe como módulo navegable |
| Reservas | Sin ruta en workspace | No existe como módulo navegable |
| Mermas | Sin ruta en workspace | No existe como módulo navegable |

---

## 3. Arquitectura Encontrada

### Stack Tecnológico
- **Framework:** Next.js 15+ (App Router con Server Actions)
- **Base de datos:** Supabase (PostgreSQL con RLS)
- **Auth:** Supabase Auth + `requireWorkspaceSession()`
- **UI:** React + Tailwind CSS + shadcn/ui (parcial) + sistema de tokens propio
- **Estado:** React state + Server Actions (sin estado global externo)
- **Multiempresa:** `business_id` en todas las tablas + RLS estricto
- **Realtime:** Supabase Realtime habilitado para `restaurant_orders`
- **WhatsApp:** Integración propia con queue system
- **PDF/Impresión:** `pdf-engine.ts` + `thermal-ticket.tsx`

### Tablas de Base de Datos Confirmadas (por migraciones)
- `businesses`, `business_users` — Multiempresa core
- `products`, `categories` — Catálogo
- `restaurant_tables` — Mesas con `qr_version`, `qr_is_active`, `current_order_id`
- `restaurant_orders`, `restaurant_order_items` — Pedidos con `order_type`, `channel_origin`, `delivery_status`, `driver_name`, `idempotency_key`
- `customers`, `customer_addresses` — Clientes multitenant
- `business_digital_menus` — Menú QR/digital
- `delivery_dispatch_sessions` — Sesiones de repartidores
- `subscriptions`, `plans` — Suscripciones
- `audit_logs` — Auditoría de cambios
- `notifications` — Notificaciones in-app
- `business_document_configs` — Configuración de documentos
- `business_sale_correlatives` — Numeración de ventas
- `platform_settings` — Configuración de plataforma

### Flujos Transaccionales Implementados
1. **Creación de pedido:** RPC atómica `create_restaurant_pos_order` con idempotencia real, validación de precios en servidor, manejo de mesas
2. **Verificación de entrega:** PIN de 4 dígitos con límite de 5 intentos, auditoría
3. **Sesiones de repartidores:** Tokens criptográficos SHA-256, tabla `delivery_dispatch_sessions`
4. **Control de stock:** Descuento de existencias vía `metadata.stock_quantity` (limitado — stock en JSON, no en tabla normalizada)

### Problemas de Arquitectura Identificados
1. **Stock en JSON (metadata):** Las existencias se guardan en `products.metadata.stock_quantity` en lugar de una tabla normalizada de inventario. Esto limita el control de existencias por ubicación, movimientos y auditoría.
2. **Repartidores en settings JSONB:** Los repartidores operativos se almacenan en `businesses.settings.delivery_drivers` como JSON, con fallback a tabla `delivery_dispatch_sessions`. Funcional pero dificulta consultas avanzadas.
3. **Módulos sin persistencia:** Gastos, compras, proveedores, caja, reportes solo tienen placeholder UI.
4. **Sin modelo de Recetas:** No existe tabla ni servicio de recetas/ingredientes.
5. **Sin Cajas/Turnos:** No hay modelo para apertura/cierre de caja con turnos.

---

## 4. Clasificación Funcional por Bloque TuyApp

Ver `FUNCTIONAL_GAP_ANALYSIS.md` para la matriz completa.

**Resumen:**
- **Implementado:** 6 bloques (autenticación, navegación, empleados/roles, menú QR base, pedidos base, mesas base)
- **Parcial:** 9 bloques (catálogo, POS, ventas, clientes, configuración, domicilios, presencia digital, WhatsApp, notificaciones)
- **Pendiente:** 8 bloques (inventario/control existencias, compras, proveedores, gastos, recetas, cajas/cierres, reportes avanzados, KDS/monitor cocina)
- **Bloqueada:** 2 bloques (facturación electrónica DIAN — requiere resolución, suscripciones/límites — requiere alineación con planes reales)
- **No aplicable:** 0 bloques

---

## 5. Fases y Orden Recomendado

### Justificación del orden
El orden respeta las dependencias reales del sistema:
1. El inventario normalizado es prerequisito de compras, recetas y descuento correcto de stock
2. Las cajas son prerequisito del cierre financiero y la reconciliación de ventas  
3. Los reportes dependen de que ventas, cajas y gastos estén completos
4. El KDS depende de que el flujo de pedidos esté completo

---

### Fase 1: Fundamentos de Catálogo y Sistema Visual
**Objetivo:** Completar el catálogo de productos con todas las funciones de referencia TuyApp y unificar el sistema visual.

Módulos: Catálogo, Categorías, Modificadores, Variantes, Imágenes, Mermas, Diseño del sistema  
Ver: `PHASE_1_CATALOG_VISUAL.md`

---

### Fase 2: Inventario, Ubicaciones, Compras y Proveedores
**Objetivo:** Crear el modelo normalizado de inventario por ubicación como fundamento de todas las operaciones de stock.

Módulos: Inventario por ubicación, Movimientos, Compras, Proveedores, Cuentas por pagar  
Ver: `PHASE_2_INVENTORY_PURCHASES.md`

---

### Fase 3: Recetas, Ingredientes y Mermas
**Objetivo:** Implementar el control de ingredientes vinculado al inventario y las recetas vinculadas a productos.

Módulos: Ingredientes, Recetas, Costos por receta, Descuento de ingredientes  
Ver: `PHASE_3_RECIPES_INGREDIENTS.md`

---

### Fase 4: Clientes, Cartera y Empleados
**Objetivo:** Completar el módulo de clientes con crédito/cartera y afinar el sistema de empleados y permisos.

Módulos: Clientes (cartera, crédito, pagos), Empleados (permisos granulares aplicados en servidor), Nómina básica  
Ver: `PHASE_4_CUSTOMERS_STAFF.md`

---

### Fase 5: Gastos y Control Financiero
**Objetivo:** Implementar el registro de gastos operativos y de producción con relación a caja y reportes.

Módulos: Gastos, Categorías de gastos, Medios de pago  
Ver: `PHASE_5_EXPENSES.md`

---

### Fase 6: POS Completo, Cajas, Cierres y Flujo de Pedidos
**Objetivo:** Completar el POS con apertura de caja, gestión de turnos y cierre diario con reconciliación.

Módulos: POS (caja abierta, pagos múltiples, cotizaciones), Cajas, Turnos, Cierre del día, Cierre por rango, KDS/Monitor de cocina, Mis Órdenes, Mesas completo, Reservas  
Ver: `PHASE_6_POS_CASH_ORDERS.md`

---

### Fase 7: Domicilios Completo
**Objetivo:** Completar la gestión de domicilios con zonas, mapa, configuración y seguimiento avanzado.

Módulos: Zonas con mapa, Configuración de tarifas, Por repartidor, Seguimiento  
Ver: `PHASE_7_DELIVERY.md`

---

### Fase 8: Reportes, Dashboard e Informes
**Objetivo:** Implementar el panel de reportes completo con exportación.

Módulos: Dashboard KPIs, Ventas, Empleados, Inventario, Gastos, Compras, Recetas, Domicilios, Cierre día, Horas pico, Cartera  
Ver: `PHASE_8_REPORTS.md`

---

### Fase 9: Configuración, Integraciones, Suscripciones y Complementos
**Objetivo:** Completar configuración de negocio, suscripciones con límites reales y canales digitales.

Módulos: Configuración DIAN, Unidades/conversiones, Impresión, Suscripciones/límites, Canales digitales, Centro de ayuda  
Ver: `PHASE_9_CONFIG_SUBS.md`

---

### Fase 10: Integración Final, Pruebas y Estabilización
**Objetivo:** Verificar todos los flujos de extremo a extremo, pruebas de regresión y estabilización.

Ver: `PHASE_10_INTEGRATION_TESTING.md`

---

## 6. Dependencias Críticas entre Módulos

```
Producto → [Variantes, Modificadores] → [POS, Menú QR] → Pedido → [Cocina/KDS] → [Venta, Pago]
                                                                                       ↓
Ingrediente → [Receta ← Producto] ──────────────────────────────────────→ [Stock Descuento]
                                                                               ↓
Ubicación → [Inventario Normalizado] ← [Compra ← Proveedor] ──────────→ [Costo Promedio]
                                                                               ↓
Venta → [Inventario, Historial] ──────────────────────────────────────→ [Cierre Caja]
                                                                               ↓
[Gastos, Ingresos, Cobros] ────────────────────────────────────────────→ [Reportes Financieros]
```

Ver `DEPENDENCY_MAP.md` para el mapa completo.

---

## 7. Riesgos y Decisiones Pendientes

Ver `DECISIONS_AND_RISKS.md` para detalles.

**Top 5 riesgos:**
1. **Migración de stock a tabla normalizada** — Alto: Puede requerir migración de datos existentes en `metadata.stock_quantity`
2. **Modelo de cajas sin tabla** — Alto: No existe tabla de cajas ni turnos; requiere diseño y migración
3. **Recetas sin tabla** — Alto: Requiere diseño de esquema nuevo desde cero
4. **DIAN / Facturación electrónica** — Bloqueado: Requiere credenciales y autorización externa
5. **Límites de plan no aplicados en servidor** — Medio: Solo productos tiene validación real; el resto no valida en servidor

---

## 8. Criterios Globales de Finalización

- [ ] Los 25 bloques funcionales de referencia tienen al menos estado "Parcial → Completo"
- [ ] Todos los flujos P0/P1 están cubiertos por pruebas automatizadas
- [ ] El aislamiento multiempresa está verificado por pruebas
- [ ] Los módulos financieros (ventas, cajas, gastos) están reconciliados entre sí
- [ ] La UI es consistente en todos los módulos (mismo sistema de diseño)
- [ ] El sistema funciona correctamente en móvil y escritorio
- [ ] No hay secretos o PINs almacenados en texto plano
- [ ] Las migraciones son reversibles y tienen estrategia de rollback

