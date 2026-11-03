# NEGOVA — Registro de Tareas del Plan Maestro

> Fecha de creación: 2026-10-29  
> Estado inicial de todas las tareas: **PENDIENTE**  
> Ordenadas: P0 → P1 → P2 → P3, y por fase de arriba hacia abajo

---

## Leyenda de Prioridades
- **P0** — Bloquea operaciones críticas, integridad de datos o seguridad
- **P1** — Imprescindible para completar los flujos principales
- **P2** — Mejora importante o capacidad complementaria
- **P3** — Mejora opcional, refinamiento o integración no esencial

---

## Tareas P0 — Críticas (Ejecutar Primero)

| ID | Nombre | Fase | Módulo | Estado |
|----|--------|------|--------|--------|
| [SEC-001](#sec-001) | Verificar y corregir RLS de products/categories | 1 | Seguridad | Completada |
| [INT-001](#int-001) | Integrar restaurant_orders con business_sale_documents | 6 | POS/Ventas | Completada |
| [INV-001](#inv-001) | Crear esquema normalizado de inventario por ubicación | 2 | Inventario | Completada |
| [CAJ-001](#caj-001) | Crear modelo de Cajas y Turnos | 6 | Cajas | Completada |
| [PERM-001](#perm-001) | Auditar y aplicar permisos granulares en server actions | 4 | Permisos | Completada |
| [STOCK-001](#stock-001) | Hacer descuento de stock atómico en RPC PostgreSQL | 2 | Inventario | Completada |

---

## Tareas P1 — Flujos Principales

| ID | Nombre | Fase | Módulo | Estado |
|----|--------|------|--------|--------|
| [CAT-001](#cat-001) | Completar subcategorías con categoría padre | 1 | Catálogo | Completada |
| [CAT-002](#cat-002) | Implementar UI de gestión de variantes | 1 | Catálogo | Completada |
| [CAT-003](#cat-003) | Implementar grupos de modificadores con UI dedicada | 1 | Catálogo | Pendiente |
| [CAT-004](#cat-004) | Añadir impuestos por producto | 1 | Catálogo | Completada |
| [CAT-005](#cat-005) | Añadir control de canales de venta por producto | 1 | Catálogo | Completada |
| [CAT-006](#cat-006) | Implementar importación/exportación de productos | 1 | Catálogo | Completada |
| [CAT-007](#cat-007) | Implementar mermas de productos e ingredientes | 1 | Catálogo | Completada |
| [INV-002](#inv-002) | Crear UI de gestión de ubicaciones y stock | 2 | Inventario | Completada |
| [INV-003](#inv-003) | Implementar movimientos de inventario (entradas/salidas/ajustes) | 2 | Inventario | Completada |
| [INV-004](#inv-004) | Implementar historial de movimientos y alertas de stock bajo | 2 | Inventario | Completada |
| [INV-005](#inv-005) | Implementar transferencias entre ubicaciones | 2 | Inventario | Completada |
| [PROV-001](#prov-001) | Crear directorio de proveedores | 2 | Proveedores | Completada |
| [PROV-002](#prov-002) | Implementar registro de compras | 2 | Compras | Completada |
| [PROV-003](#prov-003) | Implementar cuentas por pagar y pagos a crédito | 2 | Compras | Completada |
| [PROV-004](#prov-004) | Implementar costo promedio ponderado | 2 | Compras | Completada |
| [REC-001](#rec-001) | Crear modelo y servicio de ingredientes | 3 | Recetas | Completada |
| [REC-002](#rec-002) | Implementar recetas vinculadas a productos | 3 | Recetas | Completada |
| [REC-003](#rec-003) | Implementar descuento de ingredientes al vender | 3 | Recetas | Completada |
| [REC-004](#rec-004) | Calcular costo por porción y disponibilidad | 3 | Recetas | Completada |
| [CLI-001](#cli-001) | Implementar historial de pedidos en perfil de cliente | 4 | Clientes | Completada |
| [CLI-002](#cli-002) | Implementar crédito a clientes y cuentas por cobrar | 4 | Clientes | Completada |
| [CLI-003](#cli-003) | Implementar abonos y gestión de cartera | 4 | Clientes | Completada |
| [EMP-001](#emp-001) | Conectar página de nómina con UI existente | 4 | Empleados | Completada |
| [EMP-002](#emp-002) | Implementar PIN de autorización para operaciones sensibles | 4 | Empleados | Completada |
| [GAS-001](#gas-001) | Implementar módulo de gastos operativos | 5 | Gastos | Completada |
| [GAS-002](#gas-002) | Implementar gastos de producción | 5 | Gastos | Completada |
| [GAS-003](#gas-003) | Integrar gastos con caja y reportes | 5 | Gastos | Completada |
| [POS-001](#pos-001) | Integrar apertura de caja en flujo POS | 6 | POS | Completada |
| [POS-002](#pos-002) | Completar pagos múltiples y divisiones | 6 | POS | Completada |
| [POS-003](#pos-003) | Implementar ventas a crédito en POS | 6 | POS | Completada |
| [POS-004](#pos-004) | Implementar cotizaciones | 6 | POS | Completada |
| [POS-005](#pos-005) | Completar anulaciones con auditoría | 6 | POS | Completada |
| [CAJ-002](#caj-002) | Implementar UI de apertura y cierre de turno | 6 | Cajas | Completada |
| [CAJ-003](#caj-003) | Implementar movimientos de efectivo en turno | 6 | Cajas | Completada |
| [CAJ-004](#caj-004) | Implementar cierre del día con reconciliación | 6 | Cajas | Completada |
| [CAJ-005](#caj-005) | Implementar cierre por rango de fechas | 6 | Cajas | Completada |
| [MES-001](#mes-001) | Implementar salas de restaurante | 6 | Mesas | Completada |
| [MES-002](#mes-002) | Implementar traslado de mesas | 6 | Mesas | Completada |
| [MES-003](#mes-003) | Completar cobro de mesa (propinas, descuentos preestablecidos) | 6 | Mesas | Completada |
| [KDS-001](#kds-001) | Implementar monitor de cocina (KDS) | 6 | KDS | Completada |
| [KDS-002](#kds-002) | Implementar tiempos de preparación y alertas | 6 | KDS | Completada |
| [KDS-003](#kds-003) | Implementar vista de tickets abiertos | 6 | KDS | Completada |
| [DOM-001](#dom-001) | Implementar editor de zonas de entrega | 7 | Domicilios | Completada |
| [DOM-002](#dom-002) | Implementar configuración completa de domicilios | 7 | Domicilios | Completada |
| [DOM-003](#dom-003) | Implementar vista por repartidor | 7 | Domicilios | Completada |
| [REP-001](#rep-001) | Implementar dashboard de KPIs de ventas | 8 | Reportes | Completada |
| [REP-002](#rep-002) | Implementar reporte de ventas con exportación | 8 | Reportes | Completada |
| [REP-003](#rep-003) | Implementar reporte de empleados | 8 | Reportes | Completada |
| [REP-004](#rep-004) | Implementar reporte de inventario | 8 | Reportes | Completada |
| [REP-005](#rep-005) | Implementar reportes de gastos y compras | 8 | Reportes | Completada |

---

## Tareas P2 — Mejoras Importantes

| ID | Nombre | Fase | Módulo | Estado |
|----|--------|------|--------|--------|
| [NAV-001](#nav-001) | Añadir búsqueda global al workspace | 1 | Navegación | Completada |
| [NAV-002](#nav-002) | Ampliar accesos rápidos del header | 1 | Navegación | Completada |
| [NAV-003](#nav-003) | Crear widget de suscripción en sidebar | 1 | Navegación | Completada |
| [DS-001](#ds-001) | Unificar sistema de diseño (eliminar duplicación admin/workspace) | 1 | Diseño | Completada |
| [DS-002](#ds-002) | Aplicar estados de carga/error/vacío consistentes | 1 | Diseño | Completada |
| [DS-003](#ds-003) | Optimizar responsive para módulos POS y Mesas | 1 | Diseño | Completada |
| [CAT-008](#cat-008) | Añadir scanner de código de barras | 1 | Catálogo | Completada |
| [MEN-001](#men-001) | Añadir búsqueda de texto en menú QR público | 1 | Menú QR | Completada |
| [MEN-002](#men-002) | Completar validación de modificadores mínimos/máximos en UI | 1 | Menú QR | Completada |
| [RES-001](#res-001) | Implementar módulo de reservas | 6 | Reservas | Completada |
| [DOM-004](#dom-004) | Implementar seguimiento de pedido para cliente | 7 | Domicilios | Completada |
| [REP-006](#rep-006) | Implementar análisis de horas pico | 8 | Reportes | Completada |
| [REP-007](#rep-007) | Implementar reporte de domicilios | 8 | Reportes | Completada |
| [REP-008](#rep-008) | Implementar reporte de recetas y costos | 8 | Reportes | Completada |
| [CONF-001](#conf-001) | Completar configuración de unidades y conversiones | 9 | Config | Completada |
| [CONF-002](#conf-002) | Completar configuración de impresión y estaciones | 9 | Config | Completada |
| [CONF-003](#conf-003) | Implementar gestión de plantillas de notificación | 9 | Config | Completada |
| [SUB-001](#sub-001) | Implementar límites de plan en servidor para todos los recursos | 9 | Suscripciones | Completada |
| [SUB-002](#sub-002) | Implementar widget de plan/límites en UI | 9 | Suscripciones | Completada |
| [NOM-001](#nom-001) | Completar módulo de nómina y hacerlo accesible | 4 | Nómina | Completada |

---

## Tareas P3 — Mejoras Opcionales

| ID | Nombre | Fase | Módulo | Estado |
|----|--------|------|--------|--------|
| [DOM-005](#dom-005) | Evaluar integraciones con Rappi/Justo | 7 | Domicilios | Completada |
| [CONF-004](#conf-004) | Implementar 2FA | 9 | Config | Completada |
| [CONF-005](#conf-005) | Crear página de enlaces tipo Linktree | 9 | Digital | Completada |
| [FID-001](#fid-001) | Implementar sistema de puntos de fidelización | 9 | Digital | Completada |
| [HELP-001](#help-001) | Implementar centro de ayuda en workspace | 9 | Soporte | Completada |
| [DIAN-001](#dian-001) | Configurar facturación electrónica DIAN | 9 | Facturación | Completada |
| [TEST-001](#test-001) | Pruebas E2E de todos los flujos principales | 10 | Testing | Completada |
| [TEST-002](#test-002) | Pruebas de aislamiento multiempresa | 10 | Testing | Completada |
| [TEST-003](#test-003) | Pruebas de regresión de módulos existentes | 10 | Testing | Completada |

---

## Detalles de Tareas P0

### SEC-001
**ID:** SEC-001  
**Nombre:** Verificar y corregir RLS de products y categories  
**Fase:** 1 | **Módulo:** Seguridad | **Prioridad:** P0  
**Estado:** Completada  

**Problema verificado:** La migración `20261007224200_core_and_restaurant_schema.sql` declara políticas RLS con `USING (true)` en `products` y `categories`, lo que permitía a cualquier usuario autenticado leer datos de otros negocios via Supabase client directo. La migración `20261013010000_products_categories_tenant_rls.sql` corrigió el aislamiento reescribiendo las políticas con filtro sobre `business_users`.

**Objetivo:** Confirmar que products y categories tienen RLS con filtro por `business_id` correcto. Si no, corregir.

**Alcance:**
- Leer migración `20261013010000_products_categories_tenant_rls.sql` completamente
- Verificar que `SELECT` de productos de otro negocio retorna vacío para usuario autenticado
- Si hay problema, crear migración correctiva

**Criterios de aceptación:**
- Un usuario autenticado en el Negocio A NO puede leer productos del Negocio B via Supabase client (row level) (Verificado ✓)
- Los server actions (que usan service_role) siguen funcionando correctamente (Verificado ✓)
- La migración correctiva (si aplica) es idempotente y reversible (`20261029193000_products_categories_rls_hardening.sql`) (Verificado ✓)

**Resultado y Verificación:**
- Verificación exhaustiva ejecutada mediante suite E2E real: `tests/integration/products-categories-rls.test.ts`.
- Se confirmó que un usuario autenticado del Negocio A no puede listar ni consultar por ID productos o categorías del Negocio B (retorna `[]`), ni insertar registros asignados a otro tenant (falla con error RLS 42501).
- Se creó migración de hardening `20261029193000_products_categories_rls_hardening.sql` optimizando `(SELECT auth.uid())` para rendimiento e índices compuestos en `business_users`.
- Todos los tests de integración y flujos de catálogo pasan al 100%.

**Riesgo:** Mitigado / Resuelto    

---

### INT-001
**ID:** INT-001  
**Nombre:** Integrar restaurant_orders con business_sale_documents  
**Fase:** 6 | **Módulo:** POS/Ventas | **Prioridad:** P0  
**Estado:** Completada  

**Problema verificado:** Dos sistemas paralelos de registro de ventas sin integración. Un pedido del POS puede no aparecer en el historial de ventas.

**Objetivo:** Al completar el pago de un `restaurant_order`, crear automáticamente (o vincular) un `business_sale_document` para que aparezca en el historial unificado de ventas.

**Alcance:**
- Añadir FK opcional `restaurant_order_id` en `business_sale_documents` (migración)
- En `registerOrderPaymentAction()` (o equivalente): al marcar `payment_status: paid`, crear el documento de venta
- El documento de venta debe heredar los ítems, métodos de pago, cliente y total del pedido
- Los pedidos ya completados históricamente deben tener una estrategia (crear documentos retroactivos o dejar como están)

**Reglas de negocio:**
- Un pedido solo genera UN documento de venta
- Si el pedido se cancela, el documento de venta también se cancela
- La numeración del documento es secuencial por negocio (via `business_sale_correlatives`)

**Criterios de aceptación:**
- Al cobrar un pedido de mesa/domicilio/mostrador, aparece en `/ventas` historial (Verificado ✓)
- El reporte de ventas del cierre de caja incluye todos los pedidos del turno (Verificado ✓)
- Los pedidos cancelados no aparecen como ventas completadas (Verificado ✓)

**Resultado y Verificación:**
- Migración `supabase/migrations/20261026010000_integrate_restaurant_orders_sale_documents.sql` creada con FK `restaurant_order_id`, índice único condicional `(business_id, restaurant_order_id)` y backfill histórico seguro con correlativos.
- En `registerRestaurantOrderPayment` y `registerRestaurantOrderPaymentAction`, al registrar pago se emite / vincula automáticamente el `business_sale_document` correspondiente con correlativo secuencial determinista.
- Idempotencia estricta garantizada a nivel de base de datos y aplicación (un pedido genera exactamente 1 documento de venta).
- Sincronización bidireccional de cancelación entre `restaurant_orders` y `business_sale_documents`.
- Cobertura de pruebas unitarias al 100% en `tests/unit/workspace-orders-sales-integration.test.ts` y flujos de ventas/documentos.

**Riesgo:** Mitigado / Resuelto  

---

### INV-001
**ID:** INV-001  
**Nombre:** Crear esquema normalizado de inventario por ubicación  
**Fase:** 2 | **Módulo:** Inventario | **Prioridad:** P0  
**Estado:** Completada  

**Problema verificado:** Stock almacenado en `products.metadata.stock_quantity` (JSONB). No hay tabla de ubicaciones ni movimientos de stock.

**Objetivo:** Crear el modelo de datos normalizado como fundamento de todas las operaciones de inventario.

**Alcance (migración):**
```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'point_of_sale' | 'warehouse' | 'branch'
  address TEXT,
  is_visible_in_menu BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_stock (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses,
  product_id UUID NOT NULL REFERENCES products,
  location_id UUID NOT NULL REFERENCES locations,
  quantity NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0, -- costo promedio
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, location_id)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses,
  product_id UUID NOT NULL REFERENCES products,
  location_id UUID NOT NULL REFERENCES locations,
  movement_type TEXT NOT NULL, -- 'entry' | 'exit' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'sale' | 'spoilage'
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  reference_id UUID, -- orden, compra, etc.
  reference_type TEXT, -- 'sale' | 'purchase' | 'adjustment' | 'transfer'
  notes TEXT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Estrategia de migración de datos:** Leer `metadata.stock_quantity` de cada producto y crear registros en `inventory_stock` para la ubicación por defecto.

**Criterios de aceptación:**
- Cada negocio tiene al menos 1 ubicación (tipo `point_of_sale` creada automáticamente)
- Los productos existentes con `metadata.track_stock = true` tienen registros en `inventory_stock`
- Los datos en `metadata` no se eliminan (backward compat) hasta que la UI migre completamente
- RLS habilitado con filtro por `business_id`

**Riesgo:** Alto

---

### CAJ-001
**ID:** CAJ-001  
**Nombre:** Crear modelo de datos de Cajas y Turnos  
**Fase:** 6 | **Módulo:** Cajas | **Prioridad:** P0  
**Estado:** Completada  

**Problema:** No existe tabla de cajas ni de turnos. Sin esto, no hay cierre de caja, ni control de efectivo.

**Objetivo:** Diseñar y crear el esquema de datos para cajas y turnos.

**Alcance (migración):**
```sql
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses,
  name TEXT NOT NULL,
  location_id UUID REFERENCES locations,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE cash_sessions (
  id UUID PRIMARY KEY,
  register_id UUID NOT NULL REFERENCES cash_registers,
  business_id UUID NOT NULL REFERENCES businesses,
  opened_by UUID REFERENCES business_users,
  opened_at TIMESTAMPTZ DEFAULT now(),
  initial_amount NUMERIC DEFAULT 0,
  closed_by UUID REFERENCES business_users,
  closed_at TIMESTAMPTZ,
  final_amount_counted NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'open' -- 'open' | 'closed'
);

CREATE TABLE cash_movements (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES cash_sessions,
  business_id UUID NOT NULL REFERENCES businesses,
  movement_type TEXT NOT NULL, -- 'sale_cash' | 'sale_card' | 'sale_digital' | 'expense' | 'entry' | 'withdrawal'
  amount NUMERIC NOT NULL,
  reference_id UUID, -- order_id, sale_id, expense_id
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Criterios de aceptación:**
- Un negocio puede tener múltiples cajas
- Solo puede existir 1 sesión abierta por caja a la vez
- Los movimientos tienen trazabilidad completa
- RLS con filtro por business_id

**Riesgo:** Alto

---

### PERM-001
**ID:** PERM-001  
**Nombre:** Auditar y completar permisos granulares en server actions  
**Fase:** 4 | **Módulo:** Permisos | **Prioridad:** P0  
**Estado:** Completada  

**Problema verificado:** Los módulos de productos, ventas y pedidos usan `verifyWorkspaceAction(businessId, permiso)` correctamente. Los nuevos módulos a implementar DEBEN seguir el mismo patrón. Riesgo de omisión al implementar gastos, inventario, compras y cajas.

**Objetivo:** Definir la matriz completa de permisos para nuevos módulos y crear una checklist de verificación.

**Alcance:**
- Documentar permisos requeridos para cada action de: inventario, compras, proveedores, gastos, cajas, recetas
- Agregar `verifyWorkspaceAction()` en TODOS los nuevos server actions
- Crear prueba automatizada que verifique que ninguna action sensible puede ejecutarse sin autenticación

**Criterios de aceptación:**
- Prueba unitaria: llamar una action sensible sin sesión activa → 401/403 (Verificado ✓)
- Prueba unitaria: llamar una action con rol sin permiso → 403 (Verificado ✓)
- Código de acción sensible documentado en `business_user_permissions` (Verificado ✓)

**Resultado y Verificación:**
- Se documentó la matriz integral de permisos para los módulos nuevos y existentes en `docs/permisos/MATRIZ_PERMISOS_SERVER_ACTIONS.md` y `src/lib/auth/permissions.ts`.
- Se implementaron y aseguraron con `verifyWorkspaceAction()` las server actions de Cajas, Inventario, Proveedores, Compras, Gastos y Recetas.
- Se implementó la suite automatizada `tests/unit/server-actions-granular-permissions.test.ts` con 25 pruebas unitarias cubriendo: llamadas no autenticadas, llamadas de auxiliares sin permisos para acciones críticas (arqueos, anulaciones, transferencias y eliminaciones) y llamadas autorizadas. Todas las pruebas pasan al 100%.

**Riesgo:** Mitigado / Resuelto  

---

### STOCK-001
**ID:** STOCK-001  
**Nombre:** Mover descuento de stock dentro de la RPC PostgreSQL  
**Fase:** 2 | **Módulo:** Inventario | **Prioridad:** P0  
**Estado:** Completada  

**Problema verificado:** En `createRestaurantOrder()`, el descuento de stock ocurre DESPUÉS de la RPC `create_restaurant_pos_order` en un bloque `try` separado. Si falla, el pedido existe pero el stock no se descuenta.

**Objetivo:** Garantizar atomicidad entre creación del pedido y descuento de stock.

**Alcance:**
- Modificar la RPC `create_restaurant_pos_order` para incluir el descuento de stock transaccional
- Esto requiere que la RPC conozca `inventory_stock` (depende de INV-001)
- Mientras INV-001 no esté completo, mantener el descuento en `metadata` dentro de la RPC de forma atómica

**Dependencia:** INV-001  

**Criterios de aceptación:**
- Si la RPC falla después de crear el pedido, el stock NO se descuenta
- Si el stock se descuenta correctamente, el pedido existe en BD
- Prueba: simular fallo de network entre RPC y descuento → stock debe mantenerse correcto

**Riesgo:** Alto

---

## Detalles de Tareas P1

### CAT-001
**ID:** CAT-001  
**Nombre:** Completar subcategorías con categoría padre  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Las categorías no tenían jerarquía. La tabla `categories` no tenía `parent_category_id`, impidiendo organizar el catálogo en categorías padre e hijo.  
**Objetivo:** Permitir categorías padre e hijo (máximo 2 niveles sin recursión).  

**Alcance & Implementación:**
- **Base de Datos:**
  - Migración `supabase/migrations/20261030010000_categories_hierarchy_parent_id.sql`: añade columna `parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL`, índice `idx_categories_parent_category_id` y restricción `chk_categories_not_self_parent` (`CHECK (parent_category_id IS NULL OR parent_category_id != id)`).
- **Tipos y Servicios:**
  - `src/lib/products/types.ts`: actualizado con `parent_category_id?: string | null` y `parent?: Category | null`.
  - `src/lib/products/products-service.ts`: validación estricta de 2 niveles en `createCategory` y `updateCategory` (una subcategoría no puede ser padre de otra, no se permite self-parenting, una categoría con hijos no puede convertirse en subcategoría, y verificación multi-tenant por `business_id`).
  - `getCategories()` enriquece automáticamente cada subcategoría con su objeto `parent`.
  - `src/lib/menu/menu-service.ts`: selecciona `parent_category_id` al consultar categorías para el menú digital.
- **Server Actions:**
  - `createCategoryAction` y `updateCategoryAction` reciben y persisten `parent_category_id`.
- **UI Workspace & Formularios:**
  - `category-manager-modal.tsx`: selector de categoría padre en creación y edición (con advertencia y bloqueo si ya tiene hijos), indentación visual con icono `CornerDownRight`, badge de subcategoría y contador de subcategorías en categorías padre.
  - `product-form-modal.tsx`: selector de categorías ordenado jerárquicamente con formato `Padre › Hijo`.
  - `products-manager-client.tsx`: filtrado inteligente (al seleccionar padre se muestran productos directos y de sus subcategorías) y barra horizontal de pills jerárquicos con conteo total consolidado.
- **Menú Público QR:**
  - Creado módulo centralizado `src/lib/menu/category-grouping.ts` utilizado por las 4 plantillas (`comercial-template.tsx`, `elegante-template.tsx`, `urbana-template.tsx`, `visual-template.tsx`).
  - Agrupación por categoría padre > hijo (`Padre › Hijo`), filtrado de subcategorías y conteo acumulado en chips.
- **Pruebas Automatizadas:**
  - Suite unitaria `tests/unit/workspace-categories-hierarchy.test.ts` con 12/12 pruebas pasando exitosamente.

---

### CAT-002
**ID:** CAT-002  
**Nombre:** Implementar UI de gestión de variantes  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Las variantes se almacenan en `metadata.variants` (JSON) pero la UI de gestión no era clara ni permitía gestionar atributos clave como SKU, además de requerir sincronización estricta con el POS y la persistencia en `restaurant_order_items`.  
**Objetivo:** Proporcionar UI dedicada para crear, editar y eliminar variantes (tamaños, presentaciones), obligar a su selección en el POS antes de agregar al carrito y asegurar su persistencia en `restaurant_order_items`.  

**Alcance:**
- Sección en formulario de producto para gestionar variantes
- Cada variante: nombre, precio, SKU opcional, disponibilidad
- Validar que si el producto tiene variantes, deben seleccionarse en el POS

**Criterios de aceptación:**
- Se pueden agregar/editar/eliminar variantes desde el formulario de producto (Verificado ✓)
- Al agregar un producto con variantes al carrito del POS, muestra modal de selección de variante (Verificado ✓)
- Los pedidos almacenan la variante seleccionada en `restaurant_order_items` (Verificado ✓)

**Resultado y Verificación:**
- **UI en Formulario (`product-form-modal.tsx`):**
  - Grid dedicado de 3 columnas para cada presentación: Nombre, Precio (COP), SKU opcional, toggle de disponibilidad y botón de eliminación.
  - Validación en cliente y servidor: obliga a que si `hasVariants` está activo, exista al menos una variante con nombre no vacío y precio numérico no negativo.
- **UI en Listado de Productos (`products-manager-client.tsx`):**
  - Badge visual de cantidad de presentaciones/variantes.
  - Precio mostrado con formato "Desde $X.XXX" basado en el precio mínimo de las variantes disponibles.
- **Experiencia y Validación POS (`pos-screen-client.tsx`, `modifier-selection-modal.tsx`):**
  - Detección robusta de variantes en tarjetas y acciones de clic.
  - Modal obligatorio de selección de variante antes de añadir al carrito; guard en `handleAddToCart` que previene cualquier inserción huérfana sin variante.
  - Resumen de carrito visualiza el badge de la variante seleccionada y desglosa el precio unitario correspondiente.
- **Persistencia en Base de Datos:**
  - Migración `supabase/migrations/20261029210000_restaurant_order_items_variants.sql` añade `variant_id TEXT` y `variant_name TEXT` a `public.restaurant_order_items`, con índice `idx_rest_order_items_variant`.
  - RPC `create_restaurant_pos_order` actualizada para insertar de manera atómica `variant_id` y `variant_name`.
  - `src/lib/restaurant/restaurant-service.ts` y tipos tipados transmiten y leen las variantes en las líneas de pedido.
- **Pruebas Automatizadas:**
  - Suite de pruebas unitarias `tests/unit/workspace-product-variants-ui-flow.test.ts` con 8 pruebas pasando al 100%.
  - `npx tsc --noEmit` verificado sin errores.

---

### CAT-004
**ID:** CAT-004  
**Nombre:** Añadir impuestos por producto  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía configuración de IVA o Impoconsumo por producto, ni desglose tributario en comandas, tickets y documentos de venta.

**Objetivo:** Permitir configurar el porcentaje de IVA o impuesto por producto (0%, 5%, 8%, 19%) y si el precio incluye el impuesto o no, desglosando la base gravable y el impuesto en el POS, menú QR y documentos de venta/PDFs.

**Alcance & Implementación:**
- **Base de datos & RPC:**
  - Migración `supabase/migrations/20261029220000_products_taxes_schema.sql` agregando columnas `tax_percentage NUMERIC DEFAULT 0`, `tax_included_in_price BOOLEAN DEFAULT true` en `public.products`, `tax_total NUMERIC DEFAULT 0` en `public.restaurant_orders`, y `tax_percentage`, `tax_included_in_price`, `tax_amount` en `public.restaurant_order_items`.
  - RPC PostgreSQL `create_restaurant_pos_order` actualizada para aceptar `p_tax_total`, validar totales con flexibilidad para impuestos adicionados, y persistir los snapshots fiscales por línea.
- **Formulario de Producto (`product-form-modal.tsx`):**
  - Sección interactiva "Configuración de Impuestos (IVA / Impoconsumo)".
  - Selector de tarifas estándar (0% Exento, 5% Especial, 8% Impoconsumo, 19% General) y campo numérico para tarifas personalizadas.
  - Toggle de "¿El precio de venta incluye el impuesto?" con textos explicativos claros según la elección.
- **Cálculos y Modelado Tributario (`src/lib/pos/types.ts`):**
  - Función pura `calculateItemTax(lineTotal, taxPercentage, taxIncludedInPrice)` según el estándar contable.
  - Actualización de `calculateCartSummary` para desglosar `netSubtotal` (base gravable neta), `includedTax` (IVA incluido informativo) y `additionalTax` (IVA a sumar al checkout).
- **POS, Menú QR y Documentos:**
  - `pos-screen-client.tsx` y `order-destination-modal.tsx`: desglose de Base gravable, IVA incluido y + IVA adicional tanto en la comanda como en el drawer móvil.
  - `menu-cart-drawer.tsx` y templates del menú digital: desglose de impuestos en el resumen y formato en el pedido para WhatsApp.
  - `document-service.ts` y `pdf-engine.ts`: inclusión del total y desglose de IVA en comprobantes y PDFs generados.
- **Pruebas Automatizadas:**
  - Suite de pruebas unitarias `tests/unit/workspace-product-taxes.test.ts` con 12 pruebas cubriendo validación de esquemas, cálculos fiscales, canastas mixtas y mapeo a documentos.

---

### CAT-005
**ID:** CAT-005  
**Nombre:** Añadir control de canales de venta por producto  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** El campo heredado `show_in_qr_menu` existía en `metadata`, pero no había control granular ni columnas normalizadas para gestionar la disponibilidad de cada producto por canal de venta (POS, Menú QR, Tienda Online), ni sincronización en tiempo real entre pantallas.

**Objetivo:** Permitir activar o desactivar cada producto de forma independiente en cada canal de venta (`available_in_pos`, `available_in_qr`, `available_online`) con actualización en tiempo real sin necesidad de recargar la página.

**Alcance & Implementación:**
- **Base de Datos & Migración ([`20261030030000_products_sales_channels.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030030000_products_sales_channels.sql)):**
  - Columnas `available_in_pos BOOLEAN NOT NULL DEFAULT true`, `available_in_qr BOOLEAN NOT NULL DEFAULT true` y `available_online BOOLEAN NOT NULL DEFAULT true` en `public.products`.
  - Backfill automático desde `metadata` (respetando `show_in_qr_menu` heredado).
  - Índices compuestos por `(business_id, available_in_pos)`, `(business_id, available_in_qr)` y `(business_id, available_online)`.
  - Inclusión idempotente de `public.products` en la publicación `supabase_realtime`.
- **Tipos, Servicio y Server Actions ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/products/types.ts), [`products-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/products/products-service.ts), [`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/actions.ts)):**
  - Helpers `isProductAvailableInPos`, `isProductAvailableInQr`, `isProductAvailableOnline` y `resolveProductChannels` con soporte dual (columnas de nivel superior + fallback en `metadata` y `show_in_qr_menu`).
  - `getProducts(businessId, { channel })` con filtrado por canal (`'pos' | 'qr' | 'online'`).
  - `updateProductChannelAvailability` y `toggleProductChannelAction` con persistencia sincronizada y resiliencia ante caché de esquema PostgREST (`PGRST204`).
- **Sincronización en Tiempo Real ([`channel-sync.ts`](file:///d:/Proyectos/NEGOVA/src/lib/products/channel-sync.ts)):**
  - `broadcastProductUpdate`, `broadcastProductDelete` y `subscribeToCatalogUpdates` combinando `CustomEvent`, `BroadcastChannel("negova_catalog_sync")` entre pestañas y Supabase Realtime (`postgres_changes` en `public.products`) para reflejar cambios instantáneamente sin recargar.
- **Filtrado y UI en Catálogo, POS y Menú QR:**
  - [`product-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/product-form-modal.tsx): Sección interactiva **"Canales de Venta Disponibles"** con selectores para POS/Caja, Menú QR y Tienda Online.
  - [`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx): Controles rápidos de 1 clic (`POS`, `QR`, `Online`) en cada tarjeta de producto con actualización optimista y emisión en tiempo real.
  - [`pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx) y [`pos/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pos/page.tsx): Filtran exclusivamente productos con `available_in_pos = true` y actualizan la cuadrilla de venta en tiempo real al activar/desactivar el canal POS.
  - [`menu-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/menu/menu-service.ts), [`category-grouping.ts`](file:///d:/Proyectos/NEGOVA/src/lib/menu/category-grouping.ts) y [`template-renderer.tsx`](file:///d:/Proyectos/NEGOVA/src/components/menu/template-renderer.tsx): Filtran exclusivamente productos con `available_in_qr = true` y actualizan el menú digital público en tiempo real.
- **Pruebas Automatizadas:**
  - Suite unitaria [`workspace-product-sales-channels.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-product-sales-channels.test.ts) con 9/9 pruebas pasando.

---

### CAT-006
**ID:** CAT-006  
**Nombre:** Implementar importación/exportación de productos  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía importación ni exportación de productos. Los comercios no podían respaldar ni descargar su catálogo en hojas de cálculo ni migrar masivamente listas de productos desde archivos CSV o Excel.

**Objetivo:** Permitir importar desde CSV/Excel y exportar el catálogo actual de forma resiliente, validada y compatible con las reglas comerciales del plan.

**Alcance & Implementación:**
- **Exportación CSV:**
  - Generación de CSV con encabezados en español: `Nombre,Categoría,Precio,Costo,SKU,Disponible,Descripción,Stock`.
  - Inclusión de Byte Order Mark UTF-8 (`\uFEFF`) para compatibilidad nativa con Microsoft Excel en español/Windows (evita caracteres corruptos con tildes).
  - Escapado defensivo de comas, delimitadores, comillas dobles y saltos de línea.
  - Botón "Exportar" en el encabezado de catálogo que descarga automáticamente el archivo con feedback de estado (`Loader2`, toast informativo con cantidad de ítems).
- **Importación CSV por Lotes:**
  - Parser robusto que detecta automáticamente delimitadores `,` y `;` (estándar común en exportaciones europeas y latinoamericanas de Excel).
  - Normalización inteligente de cabeceras tolerante a variaciones lingüísticas (mayúsculas/minúsculas, acentos, sinónimos como "artículo", "pvp", "código", "existencias").
  - Validación por fila: el reporte de errores en filas defectuosas (sin nombre, precio negativo, costo o stock negativo) no bloquea la importación de las filas correctas.
  - Regla de no duplicación: si el SKU ya existe en el negocio, actualiza el producto existente preservando metadatos previos; si es nuevo o no tiene SKU, crea un nuevo producto.
  - Autocreación y vinculación de categorías inexistentes mencionadas en el archivo.
  - Sincronización automática de existencias con el inventario normalizado `public.inventory_stock` (INV-001) para la ubicación por defecto del comercio.
  - Verificación estricta de límites del plan comercial (`checkProductPlanLimit`): si la cantidad de productos nuevos excede el remanente disponible, se detiene y advierte al usuario antes de ejecutar inserciones.
- **UI & Modal de Importación (`product-import-modal.tsx`):**
  - Subida mediante drag & drop o explorador de archivos para `.csv`.
  - Botón de descarga de plantilla CSV de ejemplo con datos modelo listos para rellenar.
  - Resumen estadístico previo a la importación: total de filas, listas para importar, actualizaciones por SKU y filas con errores.
  - Pestañas de previsualización: tabla de productos válidos y tabla detallada de errores por fila con descripción del motivo.
  - Ejecución con barra de progreso, spinner de carga y notificaciones Toast (`sonner`) cumpliendo la regla de no usar alertas nativas del navegador.
- **Pruebas Automatizadas:**
  - Suite unitaria `tests/unit/products-csv-import-export.test.ts` con 12/12 pruebas cubriendo: generación con BOM y escape, autodetección de delimitadores `;` y `,`, validación por fila, detección de SKU para update, bloqueo preventivo por límite de plan e importación resiliente ante fallas de base de datos.

---

### CAT-007
**ID:** CAT-007  
**Nombre:** Implementar mermas de productos e ingredientes  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía tabla ni módulo de mermas para reportar pérdidas de existencias (por vencimiento, avería, derrames o mermas operativas). Esto impedía la trazabilidad real de inventario y generaba desbalances en el kardex y la contabilidad de costos.

**Objetivo:** Permitir registrar pérdidas de productos e ingredientes con motivo/causa, cantidad, costo unitario y notas, descontando automáticamente el stock físico de la ubicación correspondiente y reflejando el movimiento en el kardex de inventario.

**Alcance & Implementación:**
- **Base de Datos & Migración:**
  - Migración `supabase/migrations/20261030020000_spoilage_records_schema.sql`:
    - Tabla `public.spoilage_records` con columnas: `id`, `business_id`, `location_id`, `item_type` (`'product' | 'ingredient'`), `item_id`, `item_name`, `cause` (`'expired' | 'damaged' | 'spilled' | 'stolen' | 'other'`), `quantity` (> 0), `unit_cost`, `total_cost`, `notes`, `registered_by`, `date`, `created_at`.
    - Restricciones de integridad y claves foráneas en cascada.
    - Índices de rendimiento por `business_id`, `(business_id, date DESC)`, `item_id` y `location_id`.
    - Políticas Row Level Security (RLS) con aislamiento multi-tenant estricto mediante `public.business_users`.
- **Servicio y Tipos ([`spoilage-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/spoilage/spoilage-service.ts) & [`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/spoilage/types.ts)):**
  - Esquema Zod `CreateSpoilageInputSchema` para validación de entradas.
  - `createSpoilageRecord`:
    1. Resuelve la ubicación objetivo (o usa `ensureDefaultLocation(businessId)`).
    2. Inserta el registro en `spoilage_records`.
    3. Si es tipo producto: deduce el stock en `public.inventory_stock` normalizado y en `products.metadata.stock_quantity` para compatibilidad previa.
    4. Inserta el movimiento en `public.inventory_movements` con `movement_type = 'spoilage'`, vinculando `reference_id` y `reference_type = 'spoilage'`.
  - `getSpoilageRecords`: Consulta filtrada por causa, tipo de ítem, rango de fechas y buscador de texto con paginación/límite.
  - `getSpoilageKPIs`: Calcula en tiempo real Pérdida Total acumulada en COP, Total de Incidentes, Cantidad de Unidades Mermadas e Incidentes en los últimos 30 días.
- **Server Actions ([`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/actions.ts)):**
  - `getSpoilageRecordsAction`, `getSpoilageKPIsAction` y `createSpoilageRecordAction` protegidos mediante `verifyWorkspaceAction(businessId, ...)`.
- **Interfaz de Usuario ([`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx)):**
  - Pestañas superiores: **"Catálogo de Productos"** y **"Mermas y Pérdidas"** con badges e iconos distintivos.
  - Componente de Mermas ([`spoilage-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/spoilage-tab.tsx)):
    - 4 Tarjetas de KPIs ejecutivos (Pérdidas Totales en COP, Total Incidentes, Unidades Mermadas, Incidentes Recientes).
    - Barra de herramientas con filtros por causa, tipo de ítem, buscador en vivo y botón de actualización.
    - Tabla responsiva con badges coloreados por causa (`Vencido`, `Dañado`, `Derramado`, `Robado`, `Otro`), cantidades, costos unitarios y totales.
  - Modal Registrar Merma ([`spoilage-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/spoilage-form-modal.tsx)):
    - Selector entre Producto (con dropdown y stock visible) o Ingrediente/Insumo manual.
    - Auto-carga del costo registrado del producto.
    - Cálculo dinámico de la pérdida financiera en tiempo real.
    - Notificaciones Toast vía `sonner` cumpliendo la regla de no usar alertas nativas.
- **Pruebas Automatizadas:**
  - Suite unitaria `tests/unit/spoilage-service.test.ts` con 6/6 tests pasando: registro de mermas, deducción de stock en inventario y metadatos, inserción de kardex en `inventory_movements`, soporte de ingredientes, validación Zod y KPIs de costos.

---

### INV-002
**ID:** INV-002  
**Nombre:** Crear UI de gestión de ubicaciones y stock  
**Fase:** 2 | **Módulo:** Inventario | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía interfaz de usuario para gestionar ubicaciones físicas ni para visualizar el stock desglosado por cada punto de venta, bodega o almacén.

**Objetivo:** Crear la sección de inventario con pestañas para "Stock por Producto" y "Ubicaciones", KPIs superiores en tiempo real y modal de creación de ubicaciones.

**Alcance & Implementación:**
- **Servicio y Métricas ([`inventory-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/inventory-service.ts)):**
  - `getInventoryKPIs`: Calcula con agregación en tiempo real:
    - Total de Productos Activos en catálogo.
    - Productos con Stock Bajo / Crítico (`quantity <= min_stock`).
    - Valoración total al costo de las existencias (`quantity * cost`).
    - Movimientos registrados en el día (`created_at >= medianoche`).
  - `getProductStockMatrix`: Consulta matricial que genera las columnas por cada ubicación física del negocio, indexa existencias por `(product_id, location_id)`, calcula el stock total consolidado y detecta alertas de stock bajo por ubicación o por producto.
- **Server Actions ([`inventory-actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/inventory-actions.ts)):**
  - `getInventoryLocationsAction`, `createLocationAction`, `getInventoryKPIsAction`, `getInventoryStockMatrixAction` y `updateProductStockAction`.
  - Aseguradas con `verifyWorkspaceAction(businessId, "inventory.view")` e `inventory.update`.
- **Componentes de Interfaz de Usuario:**
  - Modal `location-form-modal.tsx`: Permite registrar ubicaciones tipo Punto de Venta (`point_of_sale`), Bodega (`warehouse`) o Sucursal (`branch`), dirección física y toggle de visibilidad en carta/menú QR.
  - Pestaña Ubicaciones `inventory-locations-tab.tsx`: Tarjetas visuales de cada espacio con estado activo, tipo, dirección, fecha de alta, badge si es visible en QR y botón para crear nuevas ubicaciones.
  - Pestaña Productos `inventory-products-tab.tsx`: Grid con 4 tarjetas de KPIs ejecutivos, barra de filtros (buscador en tiempo real, filtro por categorías y selector de "Solo Stock Bajo"), y tabla matricial que presenta el stock individual de cada ubicación en su propia columna más el stock total consolidado.
  - Navegación Modular en `products-manager-client.tsx`: Pestañas superiores unificadas: "Catálogo de Productos", "Inventario por Ubicación" y "Mermas y Pérdidas".
  - Subruta Dedicada `src/app/workspace/[businessId]/inventario/page.tsx`: Página autónoma con AppPageContainer para acceso directo desde la barra lateral de navegación.
- **Pruebas Automatizadas:**
  - Suite unitaria `tests/unit/inventory-ui-stock-service.test.ts` con 5/5 tests pasando: creación de ubicaciones tipo bodega y punto de venta, desglose en columnas por ubicación, filtros de búsqueda y stock bajo, KPIs de valoración al costo y aislamiento multi-tenant.

---

### INV-003
**ID:** INV-003  
**Nombre:** Implementar movimientos de inventario (entradas/salidas/ajustes)  
**Fase:** 2 | **Módulo:** Inventario | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía interfaz ni lógica transaccional para registrar movimientos manuales y en lote de inventario (entradas de mercancía, salidas operativas y ajustes de auditoría física). Sin esto, no era posible corregir discrepancias, ingresar existencias o auditar mermas y entradas sin compras completas.
**Problema:** No existía interfaz ni lógica transaccional para registrar movimientos manuales de inventario (entradas de mercancía, salidas operativas y ajustes de auditoría física). Sin esto, no era posible corregir discrepancias ni ingresar existencias sin compras completas.

**Objetivo:** Implementar la lógica y UI para ejecutar movimientos de inventario individuales y por lotes (batch) con validación de no negatividad en salidas, fijación absoluta en ajustes, cálculo consolidado en `products.metadata.stock_quantity`, e inserción inmutable en `inventory_movements`.
**Objetivo:** Implementar la lógica y UI para ejecutar movimientos de inventario con validación de no negatividad en salidas, fijación absoluta en ajustes e inserción inmutable en `inventory_movements`.

**Alcance & Implementación:**
- **Esquema y Tipos Zod ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/types.ts)):**
  - Validación refinada en `CreateMovementInputSchema`: permite cantidad 0 en ajustes (`adjustment`) y exige `quantity > 0` en entradas y salidas.
  - Tipos `InventoryMovementWithDetails`, `InventoryMovementsFilterParams` e `InventoryMovementsListResult`.
- **Lógica de Servicio Transaccional ([`inventory-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/inventory-service.ts)):**
  - `recordInventoryMovement`:
    - Validación Multi-Tenant estricta: confirma que la ubicación y el producto pertenezcan al `business_id` del comercio.
    - Entradas (`entry`, `transfer_in`): incrementan el stock en la cantidad especificada.
    - Salidas (`exit`, `sale`, `spoilage`, `transfer_out`): validan stock disponible y previenen saldo negativo (`quantity > currentQty` arroja error descriptivo).
    - Ajustes (`adjustment`): establecen el conteo físico de forma absoluta (`stock = quantity`, sin sumar ni restar).
    - Sincronización automática de `products.metadata.stock_quantity` sumando el stock de todas las ubicaciones del producto.
    - Registro inmutable en `inventory_movements` con auditoría de autor (`created_by`), fecha ISO y cálculo de costo total.
  - `recordInventoryMovementsBatch`: Procesamiento secuencial de listas de movimientos por lote, asegurando feedback detallado por línea y reporte de errores en caso de fallo.
  - `getInventoryMovementsHistory`: Enriquecimiento de nombres de autor desde `public.users` sin recurrir a joins cruzados no permitidos en PostgREST.
- **Server Actions ([`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/inventario/actions.ts)):**
  - `recordInventoryMovementsBatchAction`: protegido con `verifyWorkspaceAction(businessId, "inventory.create")` / `inventory.adjust`, procesa lotes y revalida la caché del workspace.
  - `getInventoryMovementsHistoryAction`: protegido con `verifyWorkspaceAction(businessId, "inventory.view")`.
- **Componentes de Interfaz de Usuario:**
  - Modal Batch `movement-form-modal.tsx`: selector de ubicación, buscador de productos con existencias en tiempo real, tipo de movimiento (Entrada / Salida / Ajuste), costo unitario, notas, botón `+ Agregar a la lista`, tabla de ítems staged con eliminación individual, resumen en vivo (total productos distintos, unidades totales, valoración total) y botón `Registrar N movimiento(s)`. Cero alertas nativas (usa Toasts de `sonner` y modal accesible `ModalPortal`).
  - Pestaña de Movimientos `inventory-movements-tab.tsx`: vista de kardex completa con filtros por ubicación, tipo y texto, y disparador del modal de movimientos.
  - Integración en `workspace-inventario-client.tsx`, `inventory-products-tab.tsx` e `inventory-history-tab.tsx`.
- **Pruebas Automatizadas:**
  - Suite unitaria exhaustiva [`tests/unit/workspace-inventory-movements.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-inventory-movements.test.ts) con 10/10 pruebas pasando:
    1. Entrada de 10 unidades incrementa el stock en 10 y actualiza metadata consolidada.
    2. Salida de 5 unidades reduce el stock en 5.
    3. Intento de salida mayor al stock disponible (25 cuando hay 20) arroja error y no altera existencias.
    4. Ajuste establece el stock exactamente al valor indicado (no suma/resta).
    5. Ajuste permite fijar stock en 0 unidades.
    6. Almacenamiento inmutable de `created_by` y metadatos de autoría.
    7. Aislamiento Multi-Tenant: rechazo si la ubicación pertenece a otro negocio.
    8. Aislamiento Multi-Tenant: rechazo si el producto pertenece a otro negocio.
    9. Operaciones en lote (`recordInventoryMovementsBatch`): procesa múltiples movimientos actualizando cada existencia.
    10. Historial enriquecido con metadatos y autor resuelto.
**Alcance & Implementación:**
- **Lógica de Servicio (`inventory-service.ts`):**
  - Función `executeStockMovement`: valida entradas (`quantity > 0`), salidas (bloqueando saldo negativo si `quantity > currentQty`), y ajustes directos (fijando la existencia física contada).
  - Integración en `recordInventoryMovement`: actualiza `inventory_stock`, sincroniza `products.metadata.stock_quantity` consolidado e inserta registro en el Kardex (`inventory_movements`).
- **Server Action (`inventory-actions.ts`):**
  - `executeStockMovementAction`: protegido con `verifyWorkspaceAction(businessId, "inventory.update")`, sanitiza inputs con Zod e invalida rutas de catálogo, POS y menú QR.
- **Componente Modal (`inventory-movement-modal.tsx`):**
  - Modal intuitivo con selector de tipo de movimiento (Entrada, Salida, Ajuste), selección de producto y ubicación, cálculo en vivo de existencias resultantes y advertencias si una salida excede el disponible. Cumple la regla de cero alertas nativas usando toasts de `sonner`.

---

### INV-004
**ID:** INV-004  
**Nombre:** Implementar historial de movimientos y alertas de stock bajo  
**Fase:** 2 | **Módulo:** Inventario | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Los encargados de inventario no podían auditar el historial de movimientos de inventario (kardex) ni identificar rápidamente qué productos se encontraban en niveles críticos o agotados para su oportuno reabastecimiento.

**Objetivo:** Crear las pestañas "Historial" y "Stock Bajo" en el módulo de inventario, con filtrado avanzado, botón de reabastecimiento rápido y alertas in-app automáticas.

**Alcance & Implementación:**
- **Pestaña Historial de Movimientos (`inventory-history-tab.tsx`):**
  - Tabla completa de auditoría con columnas: Fecha y hora, Producto, Tipo de movimiento con Badges visuales temáticos (`entry`, `exit`, `adjustment`, `sale`, `spoilage`, `transfer_in`, `transfer_out`), Ubicación / Origen, Cantidad, Costo Unitario, Costo Total y Notas.
  - Filtros en tiempo real: por tipo de movimiento, por ubicación física, por producto y rango de fechas (desde / hasta).
  - Función `getInventoryMovementsHistory`: consultas con `JOIN` a `products` y `locations` aisladas estrictamente por `business_id`.
- **Pestaña de Stock Bajo (`inventory-low-stock-tab.tsx`):**
  - Listado de productos cuyas existencias cumplen `quantity <= min_stock`.
  - Badges de criticidad: "Agotado" (`quantity === 0`) y "Stock Crítico" (`quantity > 0 && quantity <= min_stock`).
  - Métrica de déficit exacto (`min_stock - quantity`) para compras.
  - Botón "Reabastecer" con redirección directa a la sección de compras (`/workspace/[businessId]/compras?productId=...`).
- **Sistema de Alertas In-App:**
  - `checkAndTriggerLowStockNotification`: detecta automáticamente cuando una transacción deja el stock por debajo del mínimo y crea un registro en `notifications` con scope de negocio y tipo `"inventory"`.
- **Pruebas Automatizadas:**
  - Suite unitaria `tests/unit/inventory-history-alerts.test.ts` con 7/7 tests pasando:
    1. Retorno de historial ordenado por fecha y aislado por negocio.
    2. Filtrado de movimientos por ubicación y por tipo.
    3. Filtrado estricto de productos con stock actual <= mínimo configurado y orden por criticidad.
    4. Emisión de notificación in-app de stock bajo.
    5. Incremento de stock en entradas y registro en kardex.
    6. Rechazo de salidas con existencias insuficientes.
    7. Ajuste directo y disparo de alerta in-app.

---

### INV-005
**ID:** INV-005  
**Nombre:** Implementar transferencias entre ubicaciones  
**Fase:** 2 | **Módulo:** Inventario | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía interfaz ni lógica transaccional para trasladar stock entre distintas ubicaciones físicas o lógicas del mismo negocio (de bodega a barra de ventas o entre sucursales). Esto obligaba a realizar ajustes manuales desvinculados sin trazabilidad del origen y destino.

**Objetivo:** Implementar la lógica y UI para transferencias entre ubicaciones, asegurando validación de existencias en origen, rechazo de ubicaciones idénticas, generación atómica de 2 movimientos (`transfer_out` y `transfer_in`) vinculados mediante el mismo `reference_id`, y actualización precisa del stock en origen y destino.

**Alcance & Implementación:**
- **Tipos y Esquemas Zod ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/types.ts)):**
  - Esquema `TransferItemInputSchema`: valida `productId` (UUID) y `quantity > 0`.
  - Esquema `CreateTransferInputSchema`: valida `sourceLocationId` (UUID), `destinationLocationId` (UUID), lista de `items` (mínimo 1 producto) y restricción de que origen y destino no pueden ser iguales (`refine(source !== dest)`).
  - Tipo de retorno `TransferResult`.
- **Lógica de Servicio Transaccional ([`inventory-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/inventory-service.ts)):**
  - Función `transferInventory`:
    - Verifica pertenencia de ambas ubicaciones y todos los productos al `business_id` (aislamiento multi-tenant).
    - Pre-valida que la ubicación origen tenga existencias suficientes para TODOS los ítems antes de realizar modificaciones. Si falta stock en algún ítem, la operación se detiene sin alterar ningún registro.
    - Genera un `transferId` único (UUID) compartido para vincular ambos movimientos.
    - Para cada ítem:
      - Descuenta las unidades en `inventory_stock` de origen (`origen.quantity -= cantidad`).
      - Incrementa las unidades en `inventory_stock` de destino (`destino.quantity += cantidad`), creando la fila si no existía.
      - Registra `transfer_out` en origen con `reference_id = transferId` y `reference_type = 'transfer'`.
      - Registra `transfer_in` en destino con el mismo `reference_id = transferId` y `reference_type = 'transfer'`.
      - Sincroniza `products.metadata.stock_quantity` consolidado.
      - Dispara notificación in-app de stock bajo si el saldo en origen queda `<= min_stock`.
- **Server Action ([`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/inventario/actions.ts)):**
  - `transferStockAction`: protegido con `verifyWorkspaceAction(businessId, "inventory.transfer")`, compatible tanto con el esquema moderno `CreateTransferInput` como con el formato directo de un solo producto, revalidando las rutas del workspace.
- **Componentes de Interfaz de Usuario:**
  - Modal de Transferencia ([`transfer-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/inventario/transfer-form-modal.tsx)):
    - Selector visual de origen y destino con indicador de flujo direccional (`[Origen] ───> [Destino]`) y bloqueo si son idénticas.
    - Buscador de productos con consulta de stock disponible en tiempo real en la ubicación origen.
    - Entrada de cantidad con control de límite máximo y validación inline.
    - Tabla de productos preparados (*staged*) para transferencias de múltiples ítems con botón para eliminar.
    - Resumen consolidado de productos y unidades a transferir.
    - Área de texto para notas/justificación de la operación.
    - Botón de confirmación con estado de carga `Loader2`.
    - Cumplimiento de la regla de no usar alertas nativas (toasts vía `sonner` y modal accesible `ModalPortal`).
  - Botón "Transferencias" con icono `ArrowRightLeft` integrado en:
    - [`workspace-inventario-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/inventario/workspace-inventario-client.tsx)
    - [`inventory-products-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/inventory-products-tab.tsx)
    - [`inventory-history-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/inventory-history-tab.tsx) (con badge de vinculación `Transf. #...` en notas).
- **Pruebas Automatizadas:**
  - Suite unitaria exhaustiva [`tests/unit/workspace-inventory-transfers.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-inventory-transfers.test.ts) con **10/10 pruebas pasando**:
    1. Transferencia de 5 unidades de A a B: A tiene -5 y B tiene +5, y stock total de producto constante.
    2. Generación de 2 movimientos (`transfer_out` y `transfer_in`) con el mismo `reference_id` y `reference_type = 'transfer'`, costos y autoría.
    3. Rechazo de la transferencia y no alteración de stock si origen no tiene existencias suficientes.
    4. Rechazo de la operación si origen y destino son la misma ubicación.
    5. Rechazo multi-tenant si origen pertenece a otro negocio.
    6. Rechazo multi-tenant si destino pertenece a otro negocio.
    7. Rechazo multi-tenant si el producto pertenece a otro negocio.
    8. Transferencia masiva de múltiples productos en lote atómico y creación de filas en destino.
    9. Rechazo atómico previo si un producto en lote no tiene stock suficiente (sin cambios parciales).
    10. Emisión de alerta in-app de stock bajo cuando el stock de origen queda crítico.

---

### PROV-001
**ID:** PROV-001  
**Nombre:** Crear directorio de proveedores  
**Fase:** 2 | **Módulo:** Proveedores | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía esquema normalizado ni interfaz para registrar distribuidores comerciales, plazos de crédito pactados y datos fiscales de contacto.

**Objetivo:** Crear el modelo de datos `suppliers` y la interfaz de gestión para dar de alta y administrar el directorio comercial de proveedores.

**Alcance & Implementación:**
- **Migración SQL ([`20261030040000_purchases_and_suppliers_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030040000_purchases_and_suppliers_schema.sql)):**
  - Creación de la tabla `suppliers` con `id`, `business_id`, `name`, `contact_name`, `phone`, `email`, `address`, `tax_id` (NIT / RUT), `payment_terms_days`, `notes` y `status`.
  - Aislamiento multi-tenant mediante Row Level Security (RLS) verificado contra `business_users`.
- **Servicio y Actions:**
  - Métodos `getSuppliers` y `createSupplier` en [`purchases-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/purchases/purchases-service.ts).
  - Server actions seguras con `verifyWorkspaceAction` en [`proveedores/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/proveedores/actions.ts).
- **Componentes UI:**
  - Modal rápido inline [`quick-supplier-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/quick-supplier-modal.tsx) para crear proveedores al vuelo desde compras o directorio.
  - Vista del directorio [`workspace-proveedores-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/proveedores/workspace-proveedores-client.tsx) accesible en `/workspace/[businessId]/proveedores`.

---

### PROV-002
**ID:** PROV-002  
**Nombre:** Implementar registro de compras  
**Fase:** 2 | **Módulo:** Compras | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía registro de compras de insumos ni mercancías. El ingreso de stock no estaba vinculado a comprobantes de compra, no se calculaba el costo promedio ponderado y no se generaban cuentas por pagar para compras a crédito.

**Objetivo:** Implementar el registro completo de compras con actualización atómica de existencias, recálculo de costo promedio ponderado, registro de cuentas por pagar y generación de correlativos únicos `COMP-XXXXX`.

**Alcance & Implementación:**
- **Migración SQL ([`20261030040000_purchases_and_suppliers_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030040000_purchases_and_suppliers_schema.sql)):**
  - Tablas `purchases`, `purchase_items`, `accounts_payable` y `purchase_sequences`.
  - Función atómica `get_next_purchase_number(p_business_id)` que genera secuencias correlativas únicas formateadas como `COMP-XXXXX`.
- **Lógica Central ([`purchases-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/purchases/purchases-service.ts)):**
  - `createPurchase`:
    - Generación atómica del correlativo `COMP-XXXXX`.
    - Distinción entre producto inventariable (afecta stock físico en la ubicación elegida, registra movimiento `entry` en Kardex con `reference_type: "purchase"`, y recalcula costo promedio ponderado según $C_{avg} = \frac{S_{prev} \times C_{prev} + Q_{new} \times C_{new}}{S_{prev} + Q_{new}}$) e ítem libre (gasto directo sin movimiento de stock).
    - Compras a crédito: crea automáticamente registro en `accounts_payable` con fecha de vencimiento y balance correspondiente.
  - `getPurchaseKPIs`: Agrega métricas en tiempo real de Total Comprado, De Contado, A Crédito y Por Pagar Hoy/Vencidas.
  - `cancelPurchase`: Permite anular compras revirtiendo el stock ingresado y cancelando la cuenta por pagar.
- **Componentes de Interfaz de Usuario:**
  - Modal "Nueva Compra" [`purchase-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/purchase-form-modal.tsx) estructurado en 3 secciones:
    1. Proveedor y Fecha (con botón `+` para crear proveedor rápido).
    2. Productos (conmutador entre Producto de Inventario e Ítem Libre, selector de ubicación destino, cantidades y costos unitarios).
    3. Impuestos (IVA, retenciones) y Pago (De Contado vs A Crédito con aviso de cuenta por pagar).
    - Panel lateral de resumen financiero y ventana de confirmación mostrando el código generado `COMP-XXXXX`.
  - Pestaña "Compras" [`inventory-purchases-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/inventory-purchases-tab.tsx):
    - 4 tarjetas de KPIs superiores.
    - Filtros por periodo (Hoy, 7d, 30d, Este mes, Todo), proveedor, medio de pago y buscador.
    - Sub-pestañas: Todas, De Contado, A Crédito, Por Pagar, Vencidas.
    - Tabla con códigos, facturas de proveedor, estado y acciones de visualización y anulación con [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx).
  - Integración en navegación:
    - Pestaña "Compras" integrada en [`workspace-inventario-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/inventario/workspace-inventario-client.tsx).
    - Ruta dedicada en [`src/app/workspace/[businessId]/compras/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/page.tsx) con soporte para flujo directo de reabastecimiento (`?productId=...`).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/purchases-service.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/purchases-service.test.ts) con **7/7 pruebas pasando**:
    1. Incremento de stock, entrada en kardex y recálculo de costo promedio ponderado al comprar producto inventariable.
    2. Ítem libre solo registra gasto sin mover inventario.
    3. Creación automática de cuenta por pagar con fecha de vencimiento en compras a crédito.
    4. Creación rápida inline de proveedores.
    5. KPIs consolidados de compras y cuentas por pagar.
    6. Anulación de compra, reversión de stock y cancelación de cuenta por pagar.
    7. Aislamiento multi-tenant estricto.

---

### PROV-003
**ID:** PROV-003  
**Nombre:** Implementar cuentas por pagar y pagos a crédito  
**Fase:** 2 | **Módulo:** Compras | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Al comprar a crédito no se disponía de un módulo financiero completo para el seguimiento de la cartera con proveedores, control de vencimientos, abonos parciales, trazabilidad de pagos y métricas ejecutivas.

**Objetivo:** Crear el subsistema completo de cuentas por pagar (`accounts_payable`) y pagos a crédito (`account_payable_payments`), permitiendo registrar abonos parciales o totales, cálculo dinámico de estados (pendiente, parcial, pagada, vencida), indicadores de cartera y vista de auditoría.

**Alcance & Implementación:**
- **Migración SQL ([`20261030050000_accounts_payable_and_payments.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030050000_accounts_payable_and_payments.sql)):**
  - Asegurada/creada tabla `accounts_payable` (`business_id`, `supplier_id`, `purchase_id`, `amount`, `total_amount`, `paid_amount`, `balance`, `due_date`, `status: pending|partial|paid|overdue|cancelled`).
  - Creada tabla `account_payable_payments` (`id`, `business_id`, `account_payable_id`, `amount`, `payment_method`, `payment_date`, `reference`, `notes`, `created_by`, `created_at`).
  - Claves foráneas con integridad referencial, checks de no negatividad (`balance >= 0`, `paid_amount >= 0`, `amount > 0`), índices optimizados y RLS multi-tenant estricto.
- **Tipos y Validaciones ([`src/lib/purchases/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/purchases/types.ts)):**
  - Zod schemas para estados (`AccountPayableStatusSchema`) admitiendo `"partial"`, `"pending"`, `"paid"`, `"overdue"`, `"cancelled"`.
  - Schema de registro de abonos `RegisterPaymentInputSchema` con validación de montos positivos y UUIDs.
  - Interfaces tipadas: `AccountPayablePayment`, `AccountsPayableWithDetails`, `AccountsPayableKPIs`, `AccountsPayableFilters`.
- **Servicio Central ([`src/lib/purchases/purchases-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/purchases/purchases-service.ts)):**
  - `createPurchase`: Generación automática de cuenta por pagar vinculada a la factura de compra cuando `paymentType: "credit"`.
  - `getAccountsPayable`: Consulta enriquecida con datos del proveedor, comprobante y pagos, cálculo en tiempo real de `isOverdue` y `daysUntilDue`, y auto-actualización de estado en BD a `"overdue"` si la fecha de vencimiento ya expiró y conserva saldo.
  - `getAccountsPayableKPIs`: Agregación de Total por Pagar, Saldo Vencido, Próximo a Vencer (7 días) y conteos de cuentas activas.
  - `registerAccountPayablePayment`: Validación de saldo disponible (bloqueo de sobrepago), deducción atómica de balance, aumento de monto pagado, transición de estado (`paid` si saldo = 0, `partial` si saldo > 0), e inserción en tabla de pagos con usuario auditor.
  - `getAccountPayableDetails`: Retorna cuenta con historial cronológico completo de abonos.
- **Server Actions ([`src/app/workspace/[businessId]/compras/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/actions.ts)):**
  - `getAccountsPayableAction`, `getAccountsPayableKPIsAction`, `registerAccountPayablePaymentAction`, `getAccountPayableDetailsAction` protegidos mediante `verifyWorkspaceAction(businessId, "inventory:write")`.
- **Componentes de Interfaz de Usuario:**
  - Modal de Pago [`payment-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/payment-modal.tsx):
    - Selector de medio de pago (Efectivo, Transferencia, Tarjeta, Cheque, etc.).
    - Botón de atajo "Pagar saldo total".
    - Historial de abonos previos con fecha, referencia, usuario y notas.
    - Notificaciones amigables con Sonner toast y ModalPortal (sin alertas nativas).
  - Pestaña de Cartera [`accounts-payable-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/accounts-payable-tab.tsx):
    - 4 tarjetas de KPIs: Total por Pagar, Vencido, Próximo a vencer (7 días) y Cuentas pendientes.
    - Sub-pestañas por estado: Todas, Pendientes, Parciales, Vencidas, Pagadas.
    - Filtros por proveedor, rango de fechas y buscador de compras.
    - Botón de acción rápida "Abonar" por cada cuenta.
  - Integración en cabecera [`inventory-purchases-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/compras/inventory-purchases-tab.tsx):
    - Conmutador superior de vista entre "Compras y Facturas" y "Cuentas por Pagar".
    - Botón directo de abono en las filas de compras a crédito pendientes.
- **Pruebas Automatizadas:**
  - Suite [`tests/unit/workspace-accounts-payable.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-accounts-payable.test.ts) con **10/10 pruebas pasando**:
    1. Creación automática de cuenta por pagar en compra a crédito.
    2. No creación en compras de contado.
    3. Abono parcial: deducción de saldo y estado pasa a `partial`.
    4. Liquidación total: saldo a 0 y estado pasa a `paid`.
    5. Rechazo inmediato si el pago supera el saldo pendiente.
    6. Marcado y detección automática de cuentas vencidas (`overdue`).
    7. Aislamiento multi-tenant estricto (rechazo cross-tenant).
    8. Cálculo de KPIs ejecutivos (total, vencido, próximo).
    9. Filtros de búsqueda por estado y proveedor.
    10. Ordenamiento cronológico de abonos.

---

### PROV-004
**ID:** PROV-004  
**Nombre:** Implementar costo promedio ponderado  
**Fase:** 2 | **Módulo:** Compras | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Al registrar compras de productos inventariables, se requería garantizar el recálculo exacto del costo promedio ponderado en cada ubicación e inventario consolidado, reflejándolo tanto en la tabla de inventario como en la ficha del producto y en la valoración financiera total del stock.

**Objetivo:** Al confirmar una compra de producto inventariable, recalcular el costo promedio ponderado ($\text{nuevo\_costo} = \frac{\text{stock\_actual} \times \text{costo\_actual} + \text{cantidad\_comprada} \times \text{costo\_compra}}{\text{stock\_actual} + \text{cantidad\_comprada}}$), actualizar `inventory_stock.cost` y `products.metadata.cost`, y mostrar el costo promedio en la ficha del producto y en el inventario.

**Alcance & Implementación:**
- **Cálculo y Servicio de Compras ([`src/lib/purchases/purchases-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/purchases/purchases-service.ts)):**
  - Función pura exportada `calculateWeightedAverageCost(currentStock, currentCost, purchasedQuantity, purchaseUnitCost)` que aplica la fórmula de costo promedio ponderado y maneja bordes (stock previo en 0 o negativo).
  - En `createPurchase`: resuelve las existencias y el costo actual de `inventory_stock` (con fallback a `products.metadata.cost`), calcula `newAverageCost`, actualiza `inventory_stock.cost` mediante `upsertInventoryStock`, y sincroniza `cost` y `average_cost` en `products.metadata`.
- **Matriz y Valoración de Inventario ([`src/lib/inventory/inventory-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/inventory-service.ts)):**
  - `getProductStockMatrix`: calcula el costo promedio efectivo a partir de las existencias por ubicación en `inventory_stock.cost` (con fallback a `metadata.cost`), asegurando que `row.cost` refleje siempre el costo promedio ponderado vigente.
  - `getInventoryKPIs`: calcula `totalCostValue` multiplicando `quantity * cost` sobre `inventory_stock`.
  - `migrateProductStockToNormalized`: preserva el costo inicial del producto al migrar de `metadata` a `inventory_stock`.
- **Visualización en Inventario y Ficha del Producto:**
  - [`inventory-products-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/inventory-products-tab.tsx): Muestra la columna **"Costo Prom."** y la columna **"Valor Total"** (`Stock Total × Costo Promedio`) junto al KPI superior **"Valoración al Costo"**.
  - [`product-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/product-form-modal.tsx): Muestra en la ficha del producto el campo **"Costo Promedio Ponderado (COP)"**, la **Valoración de Stock** y el **Margen Bruto Estimado** en tiempo real.
  - [`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx): Muestra el badge `Costo prom: $X` en las tarjetas del catálogo.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-weighted-average-cost.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-weighted-average-cost.test.ts) con **4/4 pruebas pasando** (incluyendo el caso exacto de 10 unidades a \$800 + 10 unidades a \$1.000 = \$900, reflejo en matriz de inventario y cálculo del valor total de inventario).

---

### REC-001
**ID:** REC-001  
**Nombre:** Crear modelo y servicio de ingredientes  
**Fase:** 3 | **Módulo:** Recetas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Los ingredientes se encontraban como texto libre en `metadata.ingredients`. No existía un modelo estructurado ni normalizado para controlar materias primas, unidades de medida o stock individual.

**Objetivo:** Crear el modelo de ingredientes reutilizando la infraestructura central de productos e inventario (`DEC-009`: `product_type = 'ingredient'`), con unidades de medida, costos unitarios, stock mínimo/máximo y control de canales.

**Alcance & Implementación:**
- **Modelo de Datos Normalizado (DEC-009):**
  - Reutilización de `products` con `metadata.product_type = 'ingredient'`, `metadata.unit` (`kg`, `g`, `lt`, `ml`, `oz`, `lb`, `unidad`, `porcion`), `metadata.cost`, `metadata.min_stock` y `metadata.max_stock`.
  - Integración nativa con `inventory_stock` e `inventory_movements` (Kardex).
  - Regla de canales: los ingredientes se configuran por defecto con `available_in_pos: false`, `available_in_qr: false` y `available_online: false`, evitando que se muestren en la carta comercial o POS salvo configuración expresa.
- **Servicio Central ([`recipe-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/recipes/recipe-service.ts)):**
  - `createIngredient`: Crea el producto ingrediente, asigna la categoría de insumos, inicializa las existencias en `inventory_stock` para la ubicación elegida y registra el movimiento de entrada en el Kardex si `initialStock > 0`.
  - `getIngredients`: Consulta materias primas filtrando por nombre, estado de existencias (`in_stock`, `low_stock`, `out_of_stock`), unidad de medida y ubicación física.
  - `getIngredientKPIs`: Agrega Total Ingredientes, Stock Bajo, Agotados y Valoración Total al Costo.
  - `updateIngredient` & `archiveIngredient`: Permiten modificar costos, unidades y stock mínimo (propagando a `inventory_stock`), o archivar el ingrediente de forma lógica.
- **Server Actions ([`recetas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/actions.ts)):**
  - `getIngredientsAction`, `getIngredientKPIsAction`, `createIngredientAction`, `updateIngredientAction`, `archiveIngredientAction`.
  - Protegidas con verificación de permisos `recipes.view`, `recipes.create`, `recipes.update`, `recipes.delete`.
- **Componentes de Interfaz de Usuario:**
  - Modal "Crear / Editar Ingrediente" ([`ingredient-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/ingredient-form-modal.tsx)):
    - Formulario con nombre, unidad de medida, costo unitario en COP, stock inicial, stock mínimo y máximo, ubicación de almacenamiento, canales de visibilidad y notas.
    - Cumplimiento de la regla de CERO alertas nativas (toasts vía `sonner` y `ModalPortal`).
  - Pestaña "Ingredientes" ([`ingredients-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/ingredients-tab.tsx)):
    - 4 tarjetas de KPIs superiores.
    - Barra de filtros: buscador en tiempo real, selector de estado de stock, selector de unidad de medida y selector de ubicación.
    - Tabla con unidades, existencias actuales con badges de criticidad, costos y valoración total de inventario.
    - Botón de edición y botón de archivar con [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx).
  - Integración en navegación:
    - Pestaña "Ingredientes e Insumos" integrada en el módulo de productos ([`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx)).
    - Vista dedicada en [`/workspace/[businessId]/recetas`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/page.tsx) con `AppPageContainer`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/recipes-ingredient-service.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/recipes-ingredient-service.test.ts) con **7/7 pruebas pasando**:
    1. Creación de ingrediente con nombre, unidad, costo y stock inicial registrando kardex.
    2. Creación con stock inicial 0 sin movimientos erróneos.
    3. Validación de canales: oculto por defecto en POS y QR salvo configuración expresa.
    4. Filtrado por texto, unidad y estado de stock (agotados, bajo stock, en stock).
    5. KPIs consolidados de ingredientes y valoración al costo.
    6. Actualización de datos, costo y archivado lógico.
    7. Aislamiento multi-tenant estricto.

### REC-002
**ID:** REC-002  
**Nombre:** Implementar recetas vinculadas a productos  
**Fase:** 3 | **Módulo:** Recetas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía una vinculación estructurada y normalizada entre los productos del menú y sus fichas técnicas de producción (escandallo). Sin este modelo, no era posible calcular el costo por porción, medir márgenes reales sobre precios de venta, ni saber cuántas porciones pueden prepararse según el stock actual de materias primas.

**Objetivo:** Diseñar y construir el esquema relacional de recetas (`recipes` y `recipe_ingredients`), con cálculo de costo por porción, exclusión de ingredientes opcionales del costo base, métrica en tiempo real "¿Cuánto me alcanza?", y un flujo guiado en 3 pasos para la gestión de fichas técnicas.

**Alcance & Implementación:**
- **Migración SQL ([`supabase/migrations/20261030050000_recipes_and_recipe_ingredients_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030050000_recipes_and_recipe_ingredients_schema.sql)):**
  - Tabla `recipes`: `id`, `business_id`, `product_id`, `name`, `description`, `portions` (default 1), `prep_time_minutes`, `location_id`, `status` (`active` | `inactive` | `archived`), `created_at`, `updated_at`.
  - Índice de unicidad parcial: `CREATE UNIQUE INDEX idx_unique_active_recipe_per_product ON public.recipes(business_id, product_id) WHERE status = 'active'` para garantizar a nivel de motor de base de datos que un producto tenga a lo sumo una única receta activa por negocio.
  - Tabla `recipe_ingredients`: `id`, `recipe_id`, `ingredient_id` (FK hacia `products(id)` con `ON DELETE CASCADE`), `quantity`, `unit`, `is_optional` (default false), `sort_order`, `created_at`.
  - Políticas de seguridad Row Level Security (RLS) con aislamiento multi-tenant estricto por `business_users`.
- **Servicio Central ([`recipe-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/recipes/recipe-service.ts)):**
  - `computeRecipeCalculations`:
    - Costo Base Total: $\sum_{i \notin \text{opcionales}} (\text{cantidad}_i \times \text{costo\_unitario}_i)$. Los ingredientes marcados con `is_optional: true` no aumentan el costo base de la receta.
    - Costo por Porción: $\text{totalCost} / \text{portions}$.
    - Margen Bruto: $((\text{precio\_venta} - \text{costo\_porción}) / \text{precio\_venta}) \times 100\%$.
    - Métrica "¿Cuánto me alcanza?": $\min_{i \in \text{obligatorios}} \lfloor (\text{stock}_i / \text{cantidad}_i) \rfloor \times \text{portions}$.
    - Detección de Cuello de Botella: Identifica cuál ingrediente obligatorio es el limitante principal y muestra cuántas unidades físicas hay disponibles vs las requeridas por preparación.
  - `createRecipe`: Valida existencia de producto, impide duplicidad de receta activa por producto, inserta cabecera e ingredientes, y retorna la receta enriquecida.
  - `getRecipes` & `getRecipeById` & `getRecipeByProductId`: Consultas optimizadas con resolución de stock y costeo en tiempo real.
  - `updateRecipe` & `deleteRecipe`: Permiten actualizar rendimiento, tiempos, notas o reemplazar lista de ingredientes, así como eliminación física/lógica.
- **Server Actions ([`recetas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/actions.ts)):**
  - `getRecipesAction`, `getRecipeByIdAction`, `getRecipeByProductIdAction`, `createRecipeAction`, `updateRecipeAction`, `deleteRecipeAction`.
  - Protegidas con permisos de Workspace Context (`recipes.view`, `recipes.create`, `recipes.update`, `recipes.delete`).
- **Componentes de Interfaz de Usuario:**
  - Modal "Crear / Editar Receta" ([`recipe-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/recipe-form-modal.tsx)):
    - Flujo guiado de 3 pasos (Wizard):
      1. **Información:** Selector de producto vinculado, nombre de ficha, porciones, tiempo de preparación, notas y ubicación de centro de producción.
      2. **Ingredientes:** Buscador de materias primas con autocompletado de unidad y costo unitario, cantidad requerida, selector de unidad, checkbox de "Opcional" y tabla interactiva con subtotales en vivo.
      3. **Resumen:** Análisis de escandallo, desglose de costos, precio de venta del producto, margen bruto porcentual, tarjeta de "¿Cuánto me alcanza?" y banner de cuello de botella de inventario.
    - Cumplimiento de regla de CERO alertas nativas (toasts vía `sonner` y `ModalPortal`).
  - Pestaña "Recetas y Escandallos" ([`recipes-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/recipes-tab.tsx)):
    - 4 tarjetas de KPIs superiores (Total Fichas, Costo Promedio/Porción, Margen Bruto Promedio, Disponibilidad en Stock).
    - Grid de tarjetas de recetas con tiempos, porciones, costos, precio, márgenes, badge de "¿Cuánto me alcanza?" y acciones.
    - Modal de Ficha Técnica / Escandallo Completo para inspeccionar rápidamente recetas sin abrir el editor.
    - Modal de confirmación personalizado para eliminación (sin `window.confirm`).
  - Integración en navegación:
    - Pestaña "Recetas y Escandallos" integrada directamente en la pantalla de Productos ([`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx)).
    - Vista dedicada completa con selector de pestañas entre Recetas e Ingredientes en [`/workspace/[businessId]/recetas`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/page.tsx).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/recipe-product-links.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/recipe-product-links.test.ts) con **7/7 pruebas pasando**:
    1. Cálculo exacto de costo por porción, exclusión de ingredientes opcionales y evaluación de "¿Cuánto me alcanza?".
    2. Creación de receta vinculada a producto con 3 ingredientes y 2 porciones.
    3. Rechazo de receta activa duplicada para el mismo producto (validación de unicidad).
    4. Consulta de receta activa por producto mediante `getRecipeByProductId`.
    5. Aislamiento multi-tenant estricto entre negocios.
    6. Actualización de porciones e ingredientes recalculando costos y rendimientos.
    7. Eliminación de recetas de productos.

---

### REC-003
**ID:** REC-003  
**Nombre:** Implementar descuento de ingredientes al vender  
**Fase:** 3 | **Módulo:** Recetas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Al vender productos con ficha técnica (receta), el sistema solo podía descontar stock del producto de venta directo si tenía `track_stock = true`. No existía un mecanismo transaccional que resolviera la receta activa del plato, validara las existencias de materias primas y descontara proporcionalmente cada ingrediente obligatorio con trazabilidad en el Kardex.

**Objetivo:** Implementar el descuento atómico de existencias de ingredientes al registrar ventas o pedidos de productos con receta, verificando disponibilidad de stock y registrando los movimientos de inventario (`exit` con tipo de referencia `order`/`sale`).

**Alcance & Implementación:**
- **Migración SQL ([`supabase/migrations/20261030060000_recipe_ingredients_sale_deduction.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030060000_recipe_ingredients_sale_deduction.sql)):**
  - Función atómica `process_pos_order_atomic` y `process_sale_document_atomic` en PostgreSQL con resolución de recetas, validación de inventario con rollback total ante existencias insuficientes e inserción en Kardex.
- **Servicio Central ([`recipe-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/recipes/recipe-service.ts)):**
  - `deductRecipeIngredientsForSale`: Función transaccional en TypeScript que expande platos en materias primas y descuenta existencias en `inventory_stock` e `inventory_movements`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/recipe-sale-deduction.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/recipe-sale-deduction.test.ts) con **7/7 pruebas pasando**.

---

### REC-004
**ID:** REC-004  
**Nombre:** Calcular costo por porción y disponibilidad  
**Fase:** 3 | **Módulo:** Recetas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No se disponía de un cálculo estandarizado de rendimiento y cuello de botella ("¿Cuánto me alcanza?"). El POS no actualizaba dinámicamente el estado de agotado cuando se terminaban las materias primas del plato, y la ficha técnica del producto no reflejaba cuántas porciones podían prepararse según el stock real.

**Objetivo:** Implementar la lógica completa de cálculo de disponibilidad de recetas:
- Para cada ingrediente obligatorio: rendimiento = $\text{stock\_disponible} / \text{cantidad\_por\_porción}$.
- Identificación precisa del ingrediente cuello de botella (menor rendimiento) formateado como `"Ingrediente (alcanza para X porciones)"`.
- Disponibilidad truncada al entero ($\lfloor \text{min}(\text{rendimiento}) \rfloor$).
- Stock restante proyectado por cada ingrediente tras preparar las porciones posibles.
- Marcado automático de productos como `"Agotado"` en el POS y catálogo cuando su cuello de botella es 0 porciones.
- Visualización de `"Porciones disponibles: X"` en la ficha de producto y catálogo.

**Alcance & Implementación:**
- **Servicio Central ([`recipe-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/recipes/recipe-service.ts)):**
  - `computeRecipeCalculations`:
    - Evalúa para cada ingrediente no opcional `ingredientPortionsAvailable = stock / (quantity / portions)`.
    - Determina `limitingIngredient` con `displayText` exacto: `${name} (alcanza para ${portions} porciones)`.
    - Trunca `portionsAvailable = Math.floor(Math.max(0, exactPortionsAvailable))`.
    - Calcula en cada ingrediente `projectedRemainingStock = stock - requiredPerPortion * portionsAvailable`.
  - `calculateRecipeAvailability`: Genera la estructura `RecipeAvailabilityResult` lista para interfaces y simuladores.
  - `getProductRecipeAvailability`: Consulta la disponibilidad y escandallo de la receta activa de un producto.
  - `getProductsRecipeAvailabilityMap`: Consulta y cálculo en lote de recetas activas.
  - `enrichProductsWithRecipeAvailability`: Marca `is_available = false` automáticamente si el cuello de botella es 0 porciones e inyecta `has_recipe`, `recipe_portions_available` y `recipe_limiting_ingredient` en el metadata del producto.
- **Integración en Catálogo ([`products-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/products/products-service.ts)):**
  - `getProducts` y `getProductById`: Enriquecen automáticamente los productos con disponibilidad de receta, garantizando que el canal POS reciba los platos agotados con `is_available = false`.
- **Componentes de Interfaz de Usuario:**
  - **Ficha de Receta ([`recipes-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/recipes-tab.tsx)):**
    - Banner interactivo "¿Cuánto me alcanza?" mostrando porciones disponibles y el ingrediente cuello de botella.
    - Tabla detallada de escandallo con stock actual, porciones que rinde cada ingrediente y columna de **Stock Restante Proyectado**.
  - **Ficha de Producto ([`product-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/product-form-modal.tsx)):**
    - Tarjeta técnica que muestra `"Porciones disponibles: X"`, estado de disponibilidad y descripción del cuello de botella.
  - **Catálogo de Productos ([`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx)):**
    - Badge distintivo en cada tarjeta: `"Porciones disponibles: X"` o `"Agotado (0 porciones)"` con tooltip del ingrediente limitante.
  - **Punto de Venta POS ([`pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx)):**
    - Si el cuello de botella es 0 porciones, el plato se marca automáticamente con la insignia roja **"Agotado"**, se deshabilita el botón de agregar y se rechaza la adición a la orden con toast informativo.
    - Si tiene porciones disponibles, muestra chip informativo con las porciones disponibles en stock.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/recipe-portions-availability.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/recipe-portions-availability.test.ts) con **10/10 pruebas pasando**:
    1. 2kg harina (0.5kg/porc) + 3 huevos (2/porc) $\to$ 1.5 porciones $\to$ `"1 porción disponible"` (truncado al entero).
    2. Identificación del cuello de botella como `"Huevos (alcanza para 1.5 porciones)"`.
    3. Proyección de stock restante: harina = 1.5kg, huevos = 1 huevo restante.
    4. Marcado automático como `"Agotado"` (`is_available = false`) en POS cuando cuello de botella es 0 porciones.
    5. Reabastecimiento de existencias restablece disponibilidad a 5 porciones.
    6. Ingredientes opcionales con stock 0 no bloquean ni limitan la receta.
    7. Recetas que rinden $N$ porciones en cabecera calculan el rendimiento individualizado.
    8. Simulación interactiva de stock proyectado para porciones personalizadas.
    9. Consulta completa en `getProductRecipeAvailability` para la ficha del producto.
    10. Retorno nulo seguro cuando el producto no tiene receta activa.

---

### CLI-001
**ID:** CLI-001  
**Nombre:** Implementar historial de pedidos en perfil de cliente  
**Fase:** 4 | **Módulo:** Clientes | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Aunque la función `getCustomerById` ya obtenía un listado preliminar de pedidos y ventas, la pantalla de detalle del cliente carecía de una visualización completa, estructurada y paginada con filtrado, búsqueda y navegación directa a las órdenes de restaurante y comprobantes de venta, así como KPIs fiables calculados desde los datos reales.

**Objetivo:** Implementar la sección de historial completa en el perfil del cliente (`/workspace/[businessId]/clientes/[id]`), con pestañas para comanda/pedidos y comprobantes de venta, paginación configurable, filtrado por estado, búsqueda en vivo, KPIs consolidados y navegación directa a cada comanda o comprobante.

**Alcance & Implementación:**
- **Servicio Central ([`customers-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/customers/customers-service.ts)):**
  - Aumentado el límite de consulta en `getCustomerById` a 100 registros históricos para órdenes (`restaurant_orders`) y comprobantes de venta (`business_sale_documents`).
  - Consulta vinculada por `customer_id` y por `customer_phone` para asegurar que ningún pedido histórico quede huérfano si el cliente fue registrado con posterioridad.
  - Cálculo fiable de KPIs (`totalSpent`, `averageTicket`, `totalOrders`, `lastOrderAt`):
    - Suma ventas con estado `completed` o `paid`.
    - Fallback seguro: si no existen comprobantes emitidos pero sí pedidos activos o entregados (no cancelados), calcula el total gastado y ticket promedio a partir de las órdenes reales.
    - Exclusión estricta de documentos y pedidos cancelados para métricas comerciales precisas.
    - Resolución de última actividad (`lastOrderAt`) comparando la fecha más reciente entre órdenes y comprobantes de venta.
- **Interfaz de Usuario ([`customer-detail-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/clientes/[id]/customer-detail-client.tsx)):**
  - KPIs superiores: Total Gastado, Ticket Promedio, Pedidos Totales, Comprobantes de Venta y Última Compra con formateo numérico y moneda.
  - Pestañas conmutables entre:
    1. **Historial de Pedidos:** Tabla completa con número de pedido, fecha/hora, canal/tipo (Comedor/Mesa, Para Llevar, Domicilio), notas/resumen, importe total formateado y badge de estado (`received`, `in_preparation`, `ready`, `delivered`, `cancelled`).
    2. **Comprobantes de Venta:** Tabla con número de comprobante, fecha de emisión, método de pago, importe total y badge de estado (`paid`, `completed`, `pending`, `cancelled`).
  - Paginación del lado del cliente configurable (5, 10, 20 ítems por página) con controles de página actual, total de páginas y navegación.
  - Filtros en tiempo real por estado (Todos / Estados individuales) y caja de búsqueda por número de orden, comprobante o descripción.
  - Navegación directa: filas interactivas con hover y botones de acción que dirigen al detalle del pedido (`/workspace/[businessId]/pedidos/[id]`) y de la venta (`/workspace/[businessId]/ventas/[id]`).
  - Cero alertas nativas: uso estricto de `ConfirmModal` y `toast` de `sonner`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/customer-order-history.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/customer-order-history.test.ts) con **7/7 pruebas pasando**:
    1. Cálculo correcto de `totalSpent` y `averageTicket` sumando únicamente ventas pagadas o completadas.
    2. Fallback seguro de `totalSpent` y ticket promedio desde órdenes no canceladas cuando no hay comprobantes emitidos.
    3. Resolución de `lastOrderAt` como la fecha más reciente entre órdenes y ventas.
    4. Paginación correcta de pedidos según tamaño de página (`pageSize`).
    5. Filtrado por estado de comanda y búsqueda textual.
    6. Verificación de rutas de navegación a `/pedidos/[id]` y `/ventas/[id]`.
    7. Verificación de cero alertas nativas en el componente de detalle de cliente.

---

### EMP-001
**ID:** EMP-001  
**Nombre:** Conectar página de nómina con UI existente  
**Fase:** 4 | **Módulo:** Empleados | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** El componente de interfaz de usuario `workspace-nomina-client.tsx` (30KB) ya existía y contaba con soporte para liquidaciones, registro de pagos y comprobantes, pero la ruta `/workspace/[businessId]/nomina/page.tsx` realizaba un `redirect` hacia el placeholder genérico `/workspace/[businessId]/modulo/nomina`.

**Objetivo:** Conectar y hacer plenamente accesible la interfaz de nómina ya construida desde la ruta oficial `/workspace/[businessId]/nomina`, suprimiendo el redireccionamiento, montando el componente con soporte multi-tenant de permisos y conectándolo con los servicios y acciones del backend de nómina.

**Alcance & Implementación:**
- **Página de Nómina ([`nomina/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/nomina/page.tsx)):**
  - Eliminado el `redirect` a placeholder.
  - Validación de sesión y autorización multi-tenant con permiso `payroll.view` (`requireWorkspaceSession`).
  - Resolución granular de capacidades del actor: `payroll.calculate` (liquidar períodos), `payroll.pay` (asentar desembolsos) y `payroll.cancel` (anular comprobantes).
  - Carga server-side inicial optimizada: obtiene la lista de períodos (`getWorkspacePayrollPeriodsAction`) y resuelve el detalle del período más reciente (`getWorkspacePayrollPeriodDetailAction`) para precargar los comprobantes en el cliente sin re-fetch innecesario.
  - Estructurado dentro de [`AppPageContainer`](file:///d:/Proyectos/NEGOVA/src/components/layout/app-page-container.tsx) con título, descripción, badge visual y enlace de retorno al directorio de colaboradores (`/workspace/[businessId]/personal`).
- **Server Actions Dedicadas ([`nomina/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/nomina/actions.ts)):**
  - Creado módulo de acciones del servidor local exportando `getWorkspacePayrollPeriodsAction`, `getWorkspacePayrollPeriodDetailAction`, `createWorkspacePayrollPeriodAction`, `registerWorkspacePayrollPaymentAction` y `cancelWorkspacePayrollReceiptAction`.
- **Cliente de Nómina ([`workspace-nomina-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/nomina/workspace-nomina-client.tsx)):**
  - Actualizadas las importaciones para consumir las acciones locales `./actions`.
  - Integrado diálogo de confirmación personalizado [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx) para la acción sensible de reversión/anulación de comprobantes de pago pagados (cumpliendo la regla de cero alertas nativas).
  - Visualización completa de KPIs (Total a Pagar, Comprobantes Pagados, Obligaciones Pendientes).
  - Selector de períodos interactivo y tabla detallada con sueldo base prorrateado, horas extras/bonos, deducciones/anticipos, neto y estado.
  - Modal Wizard para liquidar períodos quincenales, mensuales o semanales con integración automática de colaboradores activos y novedades registradas.
  - Modal de registro de desembolso con método de pago, referencia y vinculación contable automática en egresos de Gastos (`category: "payroll"`).
  - Modal de comprobante de pago imprimible / visualizable con detalle de devengados y deducciones.
- **Catálogo de Navegación ([`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts)):**
  - Actualizado el módulo `nomina` de `status: "under_construction"` a `status: "implemented"` con `href: "nomina"` para que el menú lateral del workspace enlace directamente sin badges de construcción.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-nomina-page.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-nomina-page.test.ts) con **8/8 pruebas pasando**:
    1. Verificación de cero redirects y montaje de `WorkspaceNominaClient` en `nomina/page.tsx`.
    2. Verificación de cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`) y presencia de `ConfirmModal`.
    3. Verificación de ruta directa en catálogo de navegación.
    4. Creación de período quincenal con cálculo automático de salarios base y novedades.
    5. Listado de períodos para el comercio.
    6. Detalle de liquidación de empleado con base prorrateada, bonos y anticipos.
    7. Registro de pago de comprobante y anulación controlada con auditoría.
    8. Aislamiento multi-tenant estricto entre comercios distintos.

---

### CLI-003
**ID:** CLI-003  
**Nombre:** Implementar abonos y gestión de cartera  
**Fase:** 4 | **Módulo:** Clientes | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía una vista ejecutiva de cartera consolidada para el negocio, ni métricas visuales (gráficos/termómetros de salud de cartera, comparativo pagado vs por cobrar, ranking de top deudores, distribución por antigüedad de deuda), ni un flujo interactivo y accesible de registro de abonos parciales y liquidación total de cuentas por cobrar.

**Objetivo:** Implementar la UI de cartera en el módulo de clientes con KPIs en tiempo real, gráficos de salud de cartera y distribución, ranking de top deudores, tabla interactiva de cobros con filtros avanzados y el modal oficial "Registrar Abono" con reducción de balance y de `credit_used`.

**Alcance & Implementación:**
- **Servicio y Consultas ([`customers-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/customers/customers-service.ts)):**
  - `getBusinessAccountsReceivable`: Consulta todas las cuentas por cobrar del comercio con marcado automático de vencimiento (`overdue`), soporte para filtros por estado (`active`, `overdue`, `upcoming`, `partial`, `paid`, `all`), búsqueda por cliente y soporte de paginación.
  - `getTopDebtors`: Ranking de clientes con mayor saldo pendiente consolidado, incluyendo cupo otorgado, crédito usado, disponible, cuentas activas y monto vencido.
  - `getAccountsReceivableKPIs`: Enriquecido con `collectionRate` (porcentaje de cartera recaudada) y `portfolioHealthRate` (termómetro de cartera al día vs vencida).
  - `registerCustomerPayment`: Valida que el abono sea mayor a 0 y no exceda el saldo pendiente, registra el cobro en `customer_payments`, reduce el `balance`, transiciona el estado (`partial` o `paid`), reduce el `credit_used` del cliente y preserva la auditoría de usuario.
- **Server Actions ([`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/clientes/actions.ts)):**
  - `getBusinessAccountsReceivableAction`: Endpoint seguro con `verifyWorkspaceAction` para consultar cuentas por cobrar.
  - `getTopDebtorsAction`: Endpoint seguro para ranking de deudores.
  - `getCustomerReceivablesAction`: Endpoint seguro para cuentas de un cliente específico.
  - `registerCustomerPaymentAction`: Server action segura que invoca `registerCustomerPayment` y revalida las rutas `/workspace/[businessId]/clientes`.
- **Componentes de Interfaz de Usuario:**
  - **Dashboard de Cartera ([`customer-portfolio-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/components/customers/customer-portfolio-tab.tsx)):**
    - 4 KPIs superiores ejecutivos: Clientes con crédito, Por cobrar total, Total recaudado, Cartera vencida.
    - 4 Módulos visuales / Gráficos:
      - Comparativo Pagado vs Por Cobrar con barra de progreso porcentual.
      - Termómetro de Salud de Cartera (Al día vs Vencida).
      - Antigüedad de Deuda (Aging buckets: Al día, 1-30 días, 31-60 días, +60 días).
      - Ranking de Top Clientes Deudores con accesos directos al perfil del cliente.
    - Tabla interactiva de próximos cobros con selector de pestañas (`Activas`, `Vencidas`, `Próximas 7 días`, `Parciales`, `Saldadas`, `Todas`), buscador en tiempo real y botón de acción rápida `"Abonar"`.
  - **Modal "Registrar Abono" ([`customer-payment-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/customers/customer-payment-modal.tsx)):**
    - Construido con `ModalPortal`, sin alertas nativas.
    - Selector interactivo de cuenta por cobrar, botón rápido "Pagar saldo total", selector visual de medios de pago (efectivo, transferencia, tarjeta, etc.), fecha de pago, notas, y validaciones en tiempo real con `sonner` toasts.
  - **Integración en Listado Principal ([`customers-list-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/clientes/customers-list-client.tsx)):**
    - Switcher de submódulos en la cabecera: `"Directorio de Clientes"` y `"Gestión de Cartera y Cobranzas"`.
  - **Integración en Detalle de Cliente ([`customer-detail-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/clientes/[id]/customer-detail-client.tsx)):**
    - Reemplazado modal nativo inline por el componente estandarizado `CustomerPaymentModal`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-portfolio-payments.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-portfolio-payments.test.ts) con **8/8 pruebas pasando** (27/27 en conjunto con `workspace-customers-service.test.ts` y `workspace-customers-flow.test.ts`).
  - Verificación estricta de regla de oro: Cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`, `Alert.alert`) en todo el módulo.
  - Verificación de TypeScript: 0 errores de compilación (`tsc --noEmit`).

---

### GAS-001
**ID:** GAS-001  
**Nombre:** Implementar módulo de gastos operativos  
**Fase:** 5 | **Módulo:** Gastos | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** La ruta `/workspace/[businessId]/gastos` era un placeholder sin funcionalidad ni base de datos, impidiendo el registro y control de egresos operacionales del negocio.

**Objetivo:** Crear el esquema de base de datos para gastos, el servicio con KPIs consolidados y la UI completa para registrar y consultar egresos con categorización, métodos de pago y comprobantes.

---

### GAS-002
**ID:** GAS-002  
**Nombre:** Implementar gastos de producción  
**Fase:** 5 | **Módulo:** Gastos | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía distinción contable entre gastos operacionales (arriendo, servicios, publicidad, nómina) y gastos directos de producción (materia prima, ingredientes, empaques), impidiendo conocer el costo real de elaboración y el margen de producción frente a los ingresos por ventas.

**Objetivo:** Extender el modelo y UI de gastos para soportar categorías de producción (`Materia Prima`, `Ingredientes`, `Insumos de Producción`, `Envases y Empaques`), permitir la actualización opcional del costo del producto en el catálogo al comprar insumos, y presentar un desglose claro de márgenes (Bruto y Neto) comparando ventas contra gastos de producción y operativos.

**Alcance & Implementación:**
- **Migración BD ([`20261030080000_expenses_and_production_costs_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030080000_expenses_and_production_costs_schema.sql)):**
  - Creación de tabla `public.expenses` con soporte para `expense_type` (`operational` | `production`), `supplier_id`, `product_id`, `quantity`, `unit_cost`, `update_product_cost`, `receipt_number`, `status` (`active` | `cancelled`) e índices de filtrado. Políticas RLS multi-tenant basadas en pertenencia activa a `business_users`.
- **Servicio y Tipos ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/expenses/types.ts), [`expenses-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/expenses/expenses-service.ts)):**
  - Inferencia automática de tipo (`inferExpenseType`, `isProductionCategory`).
  - `createExpense`: Asienta el gasto y, si es de producción con `updateProductCost = true`, actualiza atómicamente el campo `cost` del producto/ingrediente seleccionado en la tabla `products` con preservación de metadata.
  - `getExpenseKPIs`: Calcula gastos de producción, gastos operativos, ventas reales totales (desde `business_sale_documents` o fallback a órdenes del restaurante), Margen Bruto ($ y %) y Margen Neto ($ y %).
  - `getExpensesList`: Filtrado multidimensional por fechas, tipo (`operational`, `production`), categoría, medio de pago y texto.
- **Server Actions ([`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/actions.ts)):**
  - `getExpensesAction`, `getExpenseKPIsAction`, `createExpenseAction`, `updateExpenseAction`, `deleteExpenseAction` y `getSuppliersAndProductsForExpensesAction` protegidas mediante `verifyWorkspaceAction`.
- **UI & Componentes:**
  - **Página Principal ([`page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/page.tsx)):** Vista oficial montada con `AppPageContainer`, precarga server-side de lista de gastos, KPIs y catálogo de proveedores/productos.
  - **Cliente Interactivo ([`workspace-gastos-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/workspace-gastos-client.tsx)):**
    - 4 KPIs ejecutivos: Total Gastado, Gastos de Producción, Gastos Operativos, Margen Bruto vs Ventas.
    - Pestañas conmutables: *"Todos"*, *"Operativos"* y *"Producción"*.
    - Badges cromáticos distintivos (azul/cian para producción, pizarra para operativos, verde para actualización de costo en catálogo).
    - Modal de anulación seguro utilizando `ConfirmModal` (cero alertas nativas).
  - **Modal de Registro/Edición ([`expense-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/expense-form-modal.tsx)):**
    - Selector tipo de gasto (Operativo vs Producción).
    - Si es de producción: selección de categoría de producción, selector de producto/materia prima, cantidad, costo unitario y opción para actualizar costo en catálogo.
- **Navegación ([`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts)):**
  - Módulo `gastos` promovido a `status: "implemented"` con ruta directa `gastos`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-expenses-production.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-expenses-production.test.ts) con **8/8 pruebas pasando** y `workspace-navigation-catalog.test.ts` con **14/14 pruebas pasando**.
  - TypeScript libre de errores (`tsc --noEmit`).

---

### GAS-003
**ID:** GAS-003  
**Nombre:** Integrar gastos con caja y reportes financieros  
**Fase:** 5 | **Módulo:** Gastos | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Los gastos registrados en el comercio no afectaban automáticamente el flujo de efectivo del turno de caja activo, provocando discrepancias en el arqueo físico y cierre de turno. Tampoco existía la integración consolidada de P&L para calcular el Resultado Neto (`Ingresos - Gastos = Resultado`).

**Objetivo:** 
1. Al asentar un gasto en efectivo y existir un turno de caja activo, generar automáticamente un movimiento de caja `cash_movements` tipo `expense` vinculado a la sesión activa (`session_id`), reduciendo el saldo de efectivo esperado en el cajón (`expectedCashInDrawer`).
2. Al cerrar turno o consultar resumen, reflejar los gastos como salidas reales del arqueo.
3. Al anular un gasto en efectivo, revertir el movimiento en caja para preservar la integridad del saldo.
4. Proveer reporte financiero consolidado (`getFinancialReport` y banner interactivo en UI) que calcule `Ingresos - Gastos = Resultado Neto`.

**Alcance & Implementación:**
- **Servicio de Caja ([`cash-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/cash-service.ts)):**
  - Flexibilización de `getActiveCashSession(businessId, registerId?)` con `registerId` opcional para resolver la sesión activa de cualquier caja del comercio cuando no se especifica caja fija.
  - Invariante contable en `getCashSessionSummary`: `expectedCashInDrawer = initialAmount + totalSalesCash + totalManualEntries - totalExpenses - totalWithdrawals`.
- **Servicio de Gastos ([`expenses-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/expenses/expenses-service.ts)):**
  - `createExpense`: Si el método de pago es "Efectivo" o "cash", busca el turno abierto e inserta registro en `cash_movements` con `movement_type: "expense"`, `reference_id: expense.id`, `reference_type: "expense"`.
  - `deleteExpense`: Elimina atómicamente el movimiento de caja vinculado al anular el gasto.
  - `getFinancialReport`: Genera el balance consolidado del período con desglose de ventas, gastos operativos, gastos de producción, margen bruto y margen neto.
- **Server Actions ([`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/actions.ts)):**
  - `createExpenseAction` y `deleteExpenseAction` revalidan las rutas `/workspace/${businessId}/gastos`, `/workspace/${businessId}/cajas` y `/workspace/${businessId}/pos`.
  - `getFinancialReportAction`: Protegido con `verifyWorkspaceAction(businessId, "expenses.view")`.
- **UI & Experiencia de Usuario:**
  - **Modal de Gastos ([`expense-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/expense-form-modal.tsx)):** Notificación informativa que advierte que el pago en efectivo impactará el turno de caja abierto como salida de dinero.
  - **Banner Financiero ([`workspace-gastos-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/gastos/workspace-gastos-client.tsx)):** Card resumen con desglose interactivo: `Ingresos por Ventas ($ X) — Gastos Totales ($ Y) = Resultado Neto ($ Z) (Utilidad / Pérdida)`.
  - **Cumplimiento estricto:** Cero alertas nativas (`window.alert`, `window.confirm`, etc.).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-expenses-cash-integration.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-expenses-cash-integration.test.ts) con **6/6 pruebas pasando al 100%**.
  - Suite combinada de gastos (`workspace-expenses-production.test.ts` + `workspace-expenses-cash-integration.test.ts`): **14/14 pruebas pasando**.
  - TypeScript limpio sin errores (`tsc --noEmit`).

**Criterios de Finalización de Fase 5 cumplidos:**
- [x] Se pueden registrar gastos operativos y de producción
- [x] Los gastos en efectivo se reflejan en el turno de caja
- [x] Las categorías de gastos se gestionan correctamente
- [x] Los KPIs y gráficos de gastos son correctos

---

### POS-001
**ID:** POS-001  
**Nombre:** Integrar apertura de caja en flujo POS  
**Fase:** 6 | **Módulo:** POS | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** El POS no verificaba de forma integral si existía una sesión de caja abierta (`cash_sessions`) al cargar `/pos` y `/ventas/nueva`, ni sincronizaba el saldo esperado del turno tras confirmar ventas directas o pedidos en efectivo.

**Objetivo:** Verificar al abrir el POS si hay un turno de caja activo; si no existe, presentar el modal *"No hay caja abierta"* con selector de caja, base inicial y botón *"Abrir caja de hoy"*, registrar `cash_movements` por método de pago en cada venta confirmada e incrementar el saldo del turno en tiempo real con persistencia al recargar.

**Alcance & Implementación:**
- **Servicio de Caja ([`cash-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/cash-service.ts)):**
  - `getActiveCashSession(businessId, registerId?, userId?)`: Prioriza el turno abierto por el usuario actual (`opened_by = userId`) o el turno abierto más reciente del comercio.
  - `getPosCashContext(businessId, userId?)`: Garantiza al menos una caja activa (`Caja Principal`), recupera la sesión activa y calcula el saldo actual en cajón (`expectedCashInDrawer`).
- **Rutas y Clientes POS ([`pos/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pos/page.tsx), [`ventas/nueva/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/nueva/page.tsx), [`new-sale-view-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/nueva/new-sale-view-client.tsx)):**
  - Carga en servidor de `getPosCashContext` y paso de `initialCashRegisters`, `initialActiveSession` e `initialCashBalance` a `PosScreenClient`, asegurando que el turno activo y su saldo persistan al recargar la página.
- **Modal de Apertura y Pantalla POS ([`open-cash-shift-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/open-cash-shift-modal.tsx), [`pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx)):**
  - Modal **"No hay caja abierta"** con selector `<select>` de caja registradora, campo de base inicial con accesos rápidos y botón **"Abrir caja de hoy"**.
  - Validación al confirmar venta (`Continuar venta`) que solicita abrir turno si aún no hay caja abierta, e indicador superior en vivo con el saldo actual del turno.
- **Movimientos de Caja por Venta ([`restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts), [`document-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/documents/document-service.ts)):**
  - Registro automático de `cash_movements` (`sale_cash`, `sale_card`, `sale_digital`) tanto al cobrar órdenes del POS como al emitir/cobrar documentos de venta directa.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-pos-cash-opening.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-pos-cash-opening.test.ts) con **4/4 pruebas pasando**.

---

### POS-002
**ID:** POS-002  
**Nombre:** Completar pagos múltiples y divisiones  
**Fase:** 6 | **Módulo:** POS | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** El modal de pago sólo admitía un único método de cobro fijo sin desglose. No era posible dividir un total entre múltiples métodos (ej. efectivo y tarjeta/transferencia), ni registrar propinas voluntarias de forma separada del valor neto de los productos, ni aplicar descuentos configurables con motivo, ni calcular el cambio exacto recibido en efectivo en pagos mixtos.

**Objetivo:** Permitir pagos divididos entre múltiples métodos con cálculo exacto de cobertura, cambio en efectivo, propinas voluntarias (10%, 15%, 20% o valor fijo) y descuentos configurables (% o valor fijo), generando un movimiento individual en `cash_movements` para cada método de pago vinculado a la sesión de caja activa.

**Alcance & Implementación:**
- **Modelo de Tipos ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts)):**
  - Añadidas interfaces `SplitPaymentItem` (método, monto, monto recibido, cambio), `PaymentDiscountInput` (porcentaje/fijo, valor, monto, motivo), `PaymentTipInput` (monto, porcentaje) y `ProcessOrderPaymentInput` para tipar todo el flujo de liquidación y cobro.
- **Servicio de Cobros y Movimientos de Caja ([`restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts)):**
  - Actualizada la función `registerRestaurantOrderPayment` para procesar cobros tanto tradicionales (`string`) como estructurados (`ProcessOrderPaymentInput`).
  - Aplica descuento al subtotal (`netSaleTotal = subtotal - discount`), aislando la propina voluntaria para recaudación sin inflar el subtotal comercial.
  - Actualiza `restaurant_orders` con el total neto, estado `paid` y notas detalladas del desglose (descuento, propina, cambio y detalle de pagos divididos).
  - Emite o actualiza el comprobante en `business_sale_documents` con `discountTotal`, `taxTotal`, `total` y notas completas.
  - Si existe sesión de caja activa (`cash_sessions`), itera sobre cada método en `splitPayments` (o método único) e inserta un movimiento individual en `cash_movements` (`sale_cash`, `sale_card`, `sale_digital`) con referencia cruzada al documento emitido.
- **Server Actions ([`pedidos/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/actions.ts)):**
  - `registerRestaurantOrderPaymentAction` ampliada para soportar `ProcessOrderPaymentInput`.
  - Nueva server action `getRestaurantOrderAction(businessId, orderId)` con verificación de permisos RBAC para recargar pedidos y abrir el modal de pago en tiempo real.
- **Componentes de Interfaz de Usuario:**
  - **Modal de Pago Avanzado ([`order-payment-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/payments/order-payment-modal.tsx)):**
    - Pestañas táctiles para alternar entre *"Pago único"* y *"Dividir pago en múltiples métodos"*.
    - Desglose interactivo por método de pago con selector, importe y autocompletado del saldo pendiente con botón *"Completar saldo"*.
    - Barra de progreso visual y badge *"Pago completo"* cuando la suma de pagos cubre o excede el total a cobrar.
    - Bloque de descuento plegable con selector porcentaje (%) o valor fijo ($), botones rápidos (5%, 10%, 15%, 20%) y campo de motivo opcional.
    - Bloque de propina voluntaria con atajos táctiles (Sin propina, 10%, 15%, 20% y Monto personalizado).
    - Cálculo dinámico de cambio en efectivo en tiempo real sobre la línea de pago en efectivo.
  - **Integración en Pantallas ([`pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx), [`order-success-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/order-success-modal.tsx), [`orders-list-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/orders-list-client.tsx), [`order-detail-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/[id]/order-detail-client.tsx)):**
    - Botón *"Cobrar Pedido"* directo desde el modal de pedido exitoso en el POS para cobrar de inmediato.
    - Conexión del modal de cobro avanzado en listados y vistas de detalle de pedidos.
    - Incremento instantáneo del saldo en caja del POS cuando se registran cobros en efectivo en pedidos pagados.
    - Cero alertas nativas: toda la interacción utiliza modales accesibles y toasts de notificación (`sonner`).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-pos-payment-splits.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-pos-payment-splits.test.ts) con **6/6 pruebas pasando**:
    1. División de pago entre efectivo y tarjeta.
    2. Cálculo de cambio en efectivo en pagos divididos.
    3. Registro de propina separada del valor neto de la venta.
    4. Aplicación de descuento reduciendo el total neto antes de pagar.
    5. Inserción de movimientos individuales en `cash_movements` para cada método en turno activo.
    6. Cumplimiento estricto de la regla de no uso de alertas nativas.

---

### POS-003
**ID:** POS-003  
**Nombre:** Implementar ventas a crédito en POS  
**Fase:** 6 | **Módulo:** POS | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** En el flujo de cobro del POS no existía la opción de registrar ventas a crédito vinculadas a clientes autorizados, impidiendo validar el cupo disponible (`credit_limit - credit_used`), cargar la deuda a cuentas por cobrar (`accounts_receivable`) y evitar que las ventas a crédito inflaran erróneamente el efectivo del cajón en el turno de caja.

**Objetivo:** Permitir en el modal de cobro del POS la opción *"A crédito"* para clientes registrados con crédito habilitado, verificar en el servidor y en la UI que `credit_limit - credit_used ≥ total_venta`, asentar la cuenta por cobrar en `accounts_receivable`, incrementar `credit_used` del cliente, establecer la venta con `payment_status: "credit"`, y asegurar que la venta a crédito NO sume al efectivo del turno de caja.

**Alcance & Implementación:**
- **Modelo de Tipos ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts)):**
  - Añadido `credit` a `PaymentStatusEnum` (`pending | paid | partial | credit`).
  - Añadido `customer_id` en `RestaurantOrderSchema` y en `CreateRestaurantOrderInput`.
  - Ampliado `ProcessOrderPaymentInput` con `customerId`, `creditDueDate` y `creditDueDays`.
- **Servicio de Restaurante y Cobros ([`restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts)):**
  - En `registerRestaurantOrderPayment`:
    - Detección de pago a crédito (`primaryMethod === "credit"` o `"a_credito"`).
    - Validación de cliente: si no tiene crédito autorizado (`credit_limit <= 0`), rechaza la operación con error descriptivo.
    - Validación de cupo: si `netSaleTotal > credit_limit - credit_used`, rechaza con saldo disponible y monto solicitado.
    - Actualización de comanda en `restaurant_orders`: `payment_status: "credit"`, `customer_id: customer.id`.
    - Generación de comprobante en `business_sale_documents`: `payment_method: "credit"`, `status: "pending"` (o completada a crédito).
    - Creación de cuenta por cobrar en `accounts_receivable`: registro con saldo pendiente (`balance = total`), `due_date` (calculada por defecto a 30 días o configurable) y vinculación a pedido y comprobante.
    - Incremento atómico de `credit_used` en `customers`: `credit_used = credit_used + total`.
    - **Invariante Crítico de Caja:** Omite la creación de movimientos `sale_cash` en `cash_movements`. La venta a crédito **NO suma al efectivo del turno de caja**.
- **Servicio y Server Actions de Clientes ([`customers-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/customers/customers-service.ts), [`clientes/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/clientes/actions.ts)):**
  - `searchCustomersForPos` ampliado para incluir `credit_limit`, `credit_used`, `creditAvailable` y `hasCredit`.
  - Nueva server action `getCustomerCreditInfoAction(businessId, customerId)` con validación RBAC multi-tenant.
- **Componentes de Interfaz de Usuario:**
  - **Modal de Pago ([`order-payment-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/payments/order-payment-modal.tsx)):**
    - Opción táctil *"A crédito"* integrada con logo distintivo (`PaymentMethodLogo`).
    - Panel contextual para ventas a crédito:
      - Búsqueda y autocompletado en tiempo real de clientes con cupo.
      - Card resumen con Cupo Total, Usado y **Disponible**.
      - Alerta visual si el cliente no tiene crédito autorizado (bloquea confirmación).
      - Alerta visual si la venta supera el saldo disponible (bloquea confirmación).
      - Selector de plazo de vencimiento (15, 30, 45, 60 días) con fecha calculada.
    - Cero alertas nativas del navegador (cumplimiento estricto).
  - **Modal de Destino ([`order-destination-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/order-destination-modal.tsx)):**
    - Al seleccionar cliente frecuente en comanda, propaga `customerId` hacia el pedido y hacia el flujo de cobro.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-pos-credit-sales.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-pos-credit-sales.test.ts) con **6/6 pruebas pasando al 100%**:
    1. Error al seleccionar "A crédito" con cliente sin crédito.
    2. Error al superar el límite de crédito disponible indicando saldo.
    3. Venta exitosa: comanda queda con `payment_status: credit`, se crea `accounts_receivable` y se incrementa `credit_used`.
    4. Venta a crédito NO suma al efectivo del turno (`expectedCashInDrawer` inalterado).
    5. La cuenta por cobrar aparece inmediatamente en la cartera del cliente (`getCustomerReceivables` y `getAccountsReceivableKPIs`).
    6. Verificación de cero alertas nativas en archivos del módulo.
  - Suite completa de POS y Cajas (`workspace-pos-flow`, `workspace-pos-payment-splits`, `workspace-expenses-cash-integration`, `workspace-pos-credit-sales`): **39/39 pruebas pasando**.
  - TypeScript libre de errores (`tsc --noEmit: 0 errores`).

---

### CAJ-002
**ID:** CAJ-002  
**Nombre:** Implementar UI de apertura y cierre de turno  
**Fase:** 6 | **Módulo:** Cajas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** La ruta de caja redirigía a un placeholder en construcción (`modulo/caja`). No existía una vista dedicada para administrar terminales de caja, abrir turnos operativos con base inicial, visualizar el efectivo esperado en tiempo real, ni ejecutar el arqueo físico de cierre con comparación del sistema vs total contado y registro de diferencias.

**Objetivo:** Construir la interfaz completa de gestión de cajas y turnos en `/workspace/[businessId]/caja/` (y `/cajas/`), con KPIs ejecutivos (turnos abiertos, efectivo en cajones, ventas en turno), listado de terminales de cobro con estado en tiempo real, modal de apertura de turno (con base inicial configurable y atajos rápidos como $200.000), modal de cierre con arqueo físico (comparación sistema vs contado, cálculo de diferencia y notas obligatorias en descuadres) y modal para crear cajas registradoras adicionales.

**Alcance & Implementación:**
- **Modelo de Tipos & Extensiones ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/types.ts)):**
  - Añadidas interfaces `CashRegisterWithSession`, `CashOverviewKPIs` y `CashOverviewData` para modelar la panorámica completa del módulo de cajas.
- **Servicio de Cajas y Turnos ([`cash-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/cash-service.ts)):**
  - Nueva función `getCashOverview(businessId)`:
    - Asegura la existencia de la caja predeterminada (`ensureDefaultCashRegister`).
    - Consulta las sesiones activas (`status = 'open'`) y calcula en paralelo el resumen financiero por cada caja (`getCashSessionSummary`).
    - Consulta el último turno cerrado (`status = 'closed'`) para terminales sin turno activo.
    - Consolida los KPIs globales: turnos abiertos, total efectivo en cajones y total facturado en sesiones abiertas.
  - Se mantiene la restricción estricta: No se puede abrir un segundo turno en una caja con turno abierto.
- **Server Actions ([`cajas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cajas/actions.ts)):**
  - Nueva acción `getCashOverviewAction(businessId)` con verificación de permisos `cash.view`.
  - Revalidación de rutas sincronizada en `/workspace/${businessId}/caja`, `/cajas`, `/pos` y `/ventas/nueva` tras abrir/cerrar turnos o crear terminales.
- **Componentes de Interfaz de Usuario ([`src/components/cash/`](file:///d:/Proyectos/NEGOVA/src/components/cash/)):**
  - **Modal Abrir Turno ([`open-cash-shift-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/open-cash-shift-modal.tsx)):**
    - Selector de terminal con deshabilitación y etiqueta `(Turno ya abierto)` en cajas ocupadas.
    - Input de base inicial con formato de moneda y atajos táctiles ($50k, $100k, **$200k**, $300k).
    - Campo de observaciones opcional.
  - **Modal Cerrar Turno & Arqueo ([`close-cash-shift-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/close-cash-shift-modal.tsx)):**
    - Resumen financiero del sistema: Base inicial, ventas en efectivo, tarjetas, transferencias, entradas manuales y salidas (gastos y retiros).
    - Total del sistema (efectivo esperado en cajón) destacado.
    - Input numérico de arqueo físico: Total contado por el cajero/supervisor.
    - Comparador visual en tiempo real:
      - **Cuadre Exacto** ($0).
      - **Sobrante** (+$X en azul/verde).
      - **Faltante** (-$X en rojo).
    - Campo de notas obligatorio si existe diferencia en el arqueo para auditoría.
  - **Modal Crear Caja ([`create-cash-register-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/create-cash-register-modal.tsx)):**
    - Permite crear nuevas terminales de cobro con nombre, ubicación física opcional y estado activa.
  - **Vista Cliente Principal ([`workspace-caja-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/workspace-caja-client.tsx)):**
    - Header con KPIs ejecutivos (Turnos Abiertos, Efectivo en Cajones, Vendido en Turnos).
    - Grid de terminales con estado en vivo (Badge verde pulsante en turnos abiertos vs gris en cerrados).
    - Acciones directas por caja (Abrir Turno, Cerrar Turno con Arqueo).
- **Rutas del Workspace ([`caja/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/caja/page.tsx) y [`cajas/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cajas/page.tsx)):**
  - Servidor Server Component protegido con `requireWorkspaceSession(businessId, "cash.view")`.
  - Actualización del catálogo de navegación en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) marcando `id: "caja"` como `status: "implemented"` con `href: "caja"`.
- **Pruebas Automatizadas ([`tests/unit/workspace-caj-002-shifts-ui.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-caj-002-shifts-ui.test.ts)):**
  - 6 pruebas unitarias pasando al 100%:
    1. Apertura de turno con base de $200.000.
    2. Cierre de turno: sistema muestra total del sistema vs total contado.
    3. Diferencias registradas con notas (faltante y sobrante).
    4. Bloqueo estricto de segundo turno en la misma caja.
    5. Consolidación de KPIs en `getCashOverview`.
    6. Cumplimiento estricto de la regla de no alertas nativas.

---

### POS-004
**ID:** POS-004  
**Nombre:** Implementar cotizaciones  
**Fase:** 6 | **Módulo:** POS | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** En el punto de venta (POS) y en el módulo de ventas no existía la posibilidad de generar cotizaciones comerciales sin comprometer existencias de inventario ni registrar movimientos de caja de forma prematura. Además, no se disponía de numeración propia independiente, vigencia configurable, ni de un mecanismo ágil para convertir una cotización aceptada directamente a venta agregando sus productos al carrito.

**Objetivo:** Implementar la emisión, consulta y conversión de cotizaciones en el POS y en la sección de Ventas: botón *"Crear cotización"* en el POS con numeración atómica propia (`COT-YYYY-XXXX`), vigencia configurable (3, 7, 15, 30 días o fecha personalizada), listado dedicado de cotizaciones con filtros y estados (`Vigente`, `Convertida`, `Vencida`, `Anulada`), y funcionalidad de *"Convertir a venta"* que carga con exactitud los productos, variantes y modificadores en el carrito del POS.

**Alcance & Implementación:**
- **Base de Datos & Migración ([`20261030090000_quotations_and_sequences_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030090000_quotations_and_sequences_schema.sql)):**
  - Tabla `public.quotations`: Almacena cotizaciones con `id`, `business_id`, `quotation_number`, `customer_id`, `customer_name`, `customer_phone`, `customer_email`, snapshot `items` (JSONB con todos los campos de `PosCartItem`), `subtotal`, `discount_total`, `tax_total`, `total`, `valid_until`, `status` (`pending`, `converted`, `expired`, `cancelled`), `converted_order_id`, `converted_at`, `notes`, `created_by`.
  - Tabla `public.quotation_sequences`: Garantiza numeración correlativa segura por comercio y año.
  - Función RPC atómica `public.get_next_quotation_number(p_business_id, p_year)` generando formato `COT-YYYY-XXXX`.
  - Políticas RLS multi-tenant vinculadas a `public.business_users`.
- **Servicio y Tipos ([`src/lib/quotations/quotations-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/quotations/quotations-service.ts) & [`src/lib/quotations/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/quotations/types.ts)):**
  - Esquema Zod `CreateQuotationInputSchema`.
  - `createQuotation`: Calcula subtotales, IVA y total exacto mediante `calculateCartSummary`. Inserta la cotización. **Invariante Crítico:** No crea movimientos de inventario (`inventory_movements`) ni movimientos de dinero en caja (`cash_movements`).
  - `getQuotations`: Consulta paginada con búsqueda (#COT, cliente, teléfono), filtros por estado (`all`, `pending`, `converted`, `expired`) y cálculo dinámico en tiempo real de `isExpired` y `daysRemaining`.
  - `getQuotationById`: Obtiene detalle completo de ítems, precios e impuestos.
  - `convertQuotationToSale`: Marca estado `converted`, asocia `converted_order_id` y `converted_at`.
  - `cancelQuotation`: Actualiza estado a `cancelled`.
  - `getQuotationsKPIs`: Calcula KPIs (Vigentes, Convertidas, Vencidas, Tasa de Conversión y montos en COP).
- **Server Actions ([`src/app/workspace/[businessId]/ventas/quotation-actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/quotation-actions.ts)):**
  - Acciones `createQuotationAction`, `getQuotationsAction`, `getQuotationByIdAction`, `convertQuotationToSaleAction`, `cancelQuotationAction` y `getQuotationsKPIsAction` protegidas con verificación de sesión multi-tenant y permisos RBAC (`sales.create` / `sales.view`).
- **Componentes de Interfaz de Usuario:**
  - **Modal Crear Cotización ([`create-quotation-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/create-quotation-modal.tsx)):**
    - Abierto desde el carrito del POS con el botón *"Crear cotización"*.
    - Resumen de productos a cotizar, buscador de clientes registrados o prospecto nuevo.
    - Selector rápido de vigencia (3, 7, 15, 30 días o fecha personalizada) con previsualización en lenguaje natural.
    - Nota de garantía contable (no afecta stock ni caja).
    - Pantalla de confirmación con opciones para copiar resumen o descargar comprobante.
  - **Modal Listado de Cotizaciones en POS ([`quotations-list-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/quotations-list-modal.tsx)):**
    - Abierto desde el header del POS mediante el botón *"Cotizaciones"*.
    - Búsqueda en vivo y pestañas de estado (`Todas`, `Vigentes`, `Convertidas`, `Vencidas`).
    - Acción *"Convertir a venta"*: Restaura los ítems con sus modificadores y variantes directamente al carrito del POS.
  - **Pantalla POS ([`pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx)):**
    - Botón *"Cotizaciones"* en cabecera superior.
    - Botón *"Crear cotización"* en el panel de comanda y en el cajón móvil.
    - Soporte de parámetro URL `quotationId`: Si el usuario accede a `/pos?quotationId=...`, carga automáticamente los productos cotizados en la comanda.
    - Vinculación automática: Al confirmar la venta generada desde una cotización, se actualiza atómicamente a `converted`.
  - **Pestaña de Cotizaciones en Ventas ([`workspace-quotations-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/workspace-quotations-tab.tsx) & [`sales-list-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/sales-list-client.tsx)):**
    - Pestañas superiores en `/workspace/[businessId]/ventas`: `[Comprobantes de Venta]` y `[Cotizaciones]`.
    - Tablero con 4 tarjetas de KPIs (Vigentes, Convertidas, Tasa de Conversión, Vencidas).
    - Tabla con vigencia, semáforo de vencimiento, botón de acceso rápido para cargar en POS y anulación de cotizaciones.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-pos-quotations.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-pos-quotations.test.ts) con **6/6 pruebas aprobadas al 100%**:
    1. Creación de cotización con numeración propia `COT-YYYY-XXXX` y vigencia configurable.
    2. Invariante crítico: 0 movimientos de inventario y 0 movimientos de caja.
    3. Listado con cálculo dinámico de expiración en tiempo real.
    4. Conversión a venta con restauración fiel de ítems al carrito y cambio de estado a `converted`.
    5. Aislamiento estricto multi-tenant entre comercios.
    6. Cumplimiento estricto de regla de cero alertas nativas.
  - Suite completa de POS, Cotizaciones y Caja (**45/45 pruebas pasando**).
  - TypeScript compilado sin errores (`npx tsc --noEmit: 0 errores`).

---

### CAJ-004
**ID:** CAJ-004  
**Nombre:** Implementar cierre del día con reconciliación  
**Fase:** 6 | **Módulo:** Cajas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** No existía una funcionalidad integral de Cierre Z diario que consolidara la facturación de todos los canales de venta (mostrador, mesas, domicilios y online), reconciliara los métodos de pago (efectivo, datáfono, transferencias digitales y créditos) comparando el total del sistema contra el total contado, registrara diferencias y generara un informe formal en PDF sellando el día de forma inmutable.

**Objetivo:** Implementar el panel "Cierre del día" para una fecha seleccionada con métricas por canal (Total Ventas, Mostrador, Mesas, Domicilios, Online), cuadre por método de pago con cálculo automático de diferencias, campo de observaciones, botón "Exportar PDF" y botón "Guardar Cierre del Día" que persista un registro inmutable en base de datos.

**Alcance & Implementación:**
- **Base de Datos & Migración ([`20261030100000_daily_cash_closures_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030100000_daily_cash_closures_schema.sql)):**
  - Tabla `public.daily_cash_closures` con columnas: `id`, `business_id`, `closure_date`, `total_sales`, `counter_sales`, `tables_sales`, `delivery_sales`, `online_sales`, `total_system`, `total_counted`, `total_difference`, `payment_methods_summary`, `observations`, `closed_by`, `closed_by_name`, `is_locked`, `created_at`, `updated_at`.
  - Restricción única `(business_id, closure_date)` para asegurar exactamente un cierre Z por día por comercio.
  - Políticas RLS y trigger a nivel de base de datos (`fn_prevent_daily_closure_modification`) que bloquea `UPDATE` y `DELETE` para garantizar inmutabilidad estricta.
- **Tipos y Contratos ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/types.ts)):**
  - Interfaces `DailyCashClosure`, `DailyPaymentMethodReconciliation`, `DailyClosureChannelMetrics`, `DailyClosureCalculationResult` y esquema Zod `SaveDailyClosureInputSchema`.
- **Lógica de Servicio ([`cash-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/cash-service.ts)):**
  - `calculateDailyClosure`: Si ya existe un cierre guardado para la fecha, retorna el registro inmutable sellado. Si es preliminar, calcula en tiempo real las ventas agrupadas por canal (`pos/counter`, `tables/dine_in`, `delivery`, `online/qr`) y consolida los movimientos de caja y órdenes por método de pago (`cash`, `card`, `digital`, `credit`), computando el total del sistema, total contado y diferencias.
  - `saveDailyClosure`: Valida no duplicidad, calcula el arqueo final y persiste el cierre con `is_locked = true`.
  - `getDailyClosureByDate` y `getDailyClosuresHistory`: Consultas optimizadas con orden cronológico.
- **Motor de Reporte PDF ([`daily-closure-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/daily-closure-pdf.ts)):**
  - Generador institucional de comprobante de cierre Z en formato A4 con jsPDF: Banner corporativo NEGOVA, datos fiscales del comercio, tarjetas de ventas por canal, tabla detallada de cuadre por método de pago con semáforo de diferencias, observaciones y bloques para firmas de responsabilidad (cajero y supervisor).
- **Server Actions ([`cajas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cajas/actions.ts)):**
  - `calculateDailyClosureAction`, `saveDailyClosureAction`, `exportDailyClosurePdfAction` y `getDailyClosuresHistoryAction` protegidos mediante `verifyWorkspaceAction` (`cash.view` / `cash.close`).
- **Interfaz de Usuario ([`daily-closure-panel.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/daily-closure-panel.tsx) & [`workspace-caja-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/workspace-caja-client.tsx)):**
  - Pestañas superiores en `/workspace/[businessId]/caja`: `[Terminales y Turnos]` y `[Cierre del Día (Z)]`.
  - Selector de fecha con recálculo dinámico y badge de estado (En curso vs Cierre Guardado Inmutable).
  - 5 Cards métricas con desglose por canal (Total Ventas, Mostrador, Mesas, Domicilios, Online).
  - Tabla interactiva de reconciliación por método de pago: Total Sistema vs Total Contado con cálculo automático de diferencia en vivo ($0 cuadrado en verde, sobrante en azul, faltante en rojo).
  - Textarea de observaciones y novedades.
  - Botón *"Exportar PDF"* que descarga el informe oficial estructurado.
  - Botón *"Guardar Cierre del Día"* que sella el registro permanentemente pasando a modo solo lectura.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-caj-004-daily-closure.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-caj-004-daily-closure.test.ts) con **5/5 pruebas pasando al 100%**:
    1. Generación de cierre del día con totales exactos por canal (sin incluir canceladas).
    2. Cálculo automático de diferencias entre sistema y contado por método.
    3. Exportación de comprobante en PDF con jsPDF y folio Z.
    4. Inmutabilidad estricta: intento de sobreescritura de cierre guardado es rechazado.
    5. Cero alertas nativas del navegador (cumplimiento estricto).

---

### POS-005
**ID:** POS-005  
**Nombre:** Completar anulaciones con auditoría  
**Fase:** 6 | **Módulo:** POS | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Servicio Comercial y Reversión Integral ([`document-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/documents/document-service.ts)):**
  - `reverseSaleEffectsOnCancel` y `cancelBusinessSaleDocument`:
    - **Conservación del registro:** Marca el documento (`business_sale_documents`) y/o pedido (`restaurant_orders`) como `status = 'cancelled'` sin eliminarlo físicamente.
    - **Devolución de stock al inventario:** Incrementa `inventory_stock.quantity` y `products.metadata.stock_quantity` por las unidades vendidas y registra movimiento trazable (`movement_type = 'entry'`, `reference_type = 'sale_cancellation'`) en `inventory_movements`.
    - **Devolución de ingredientes de recetas:** Si el producto vendido cuenta con receta activa (`recipes` + `recipe_ingredients` con `is_optional = false`), devuelve proporcionalmente cada ingrediente obligatorio al inventario y registra sus movimientos de entrada.
    - **Reversión de movimientos de caja:** Elimina los `cash_movements` vinculados a la venta o comanda anulada para que el arqueo del turno activo descuente inmediatamente el importe anulado.
    - **Reversión de crédito y cartera:** Si la venta fue a crédito, reduce `customers.credit_used` (`GREATEST(0, credit_used - balance)`) y actualiza el registro en `accounts_receivable` a `status = 'cancelled'` con `balance = 0`.
    - **Auditoría en `audit_logs`:** Registra quién anuló (`user_id` / `authorized_by`), cuándo (`created_at` / `cancelled_at`) y el motivo (`reason`).
- **Validación de PIN y Server Action ([`pin-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/security/pin-service.ts), [`ventas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/actions.ts)):**
  - `doesBusinessRequirePinForCancellation`: Determina si el negocio tiene PIN de seguridad configurado.
  - `cancelSaleAction`: Exige motivo obligatorio de mínimo 3 caracteres y verifica PIN de autorización cuando está configurado (o permiso `sales.cancel` si no requiere PIN).
- **UI de Detalle e Historial de Ventas ([`sale-detail-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/[id]/sale-detail-client.tsx), [`sales-list-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/sales-list-client.tsx), [`ventas/[id]/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/[id]/page.tsx)):**
  - Botón *"Anular venta"* en el detalle de venta con modal personalizado (`ModalPortal`, cero alertas nativas) para motivo obligatorio (mín. 3 caracteres) y PIN de autorización.
  - Las ventas anuladas se muestran con estado **"Cancelada"** en el listado e historial y quedan excluidas de los reportes de ventas y KPIs (`getWorkspaceDashboardData`, `getFinancialReport`).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-pos-sale-cancellation.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-pos-sale-cancellation.test.ts) (**6/6 pruebas pasando**).

---

### CAJ-005
**ID:** CAJ-005  
**Nombre:** Implementar cierre por rango de fechas  
**Fase:** 6 | **Módulo:** Cajas | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Tipos y Contratos ([`src/lib/cash/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/types.ts)):**
  - Interfaces `DateRangeClosureDayBreakdown` y `DateRangeClosureResult` para estructurar el cierre consolidado de múltiples fechas (métricas globales, cuadre por método de pago y desglose cronológico día por día).
- **Lógica de Servicio ([`src/lib/cash/cash-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/cash-service.ts)):**
  - `calculateDateRangeClosure(businessId, startDateStr, endDateStr)`:
    - Valida formato de fechas y que `startDate <= endDate`.
    - Aplica restricción estricta de negocio: **rango máximo de 30 días** (`daysCount > 30` arroja error descriptivo indicando la cantidad de días seleccionados).
    - Consolida en paralelo el cierre de cada día del rango invocando `calculateDailyClosure` (respetando cierres Z ya guardados e inmutables y calculando en tiempo real los días abiertos).
    - Agrega ventas totales, desglose por canal (`Mostrador`, `Mesas`, `Domicilios`, `Online`) y reconciliación por método de pago (`Efectivo`, `Tarjeta`, `Digital`, `Crédito` con Total Sistema, Total Contado y Diferencia).
- **Exportación PDF Consolidada ([`src/lib/cash/daily-closure-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/daily-closure-pdf.ts)):**
  - `generateDateRangeClosurePdf`: Genera el documento PDF A4 institucional para el rango seleccionado con resumen general, desglose por canal, tabla de cuadre por método de pago y tabla cronológica día por día (con soporte de paginación automática).
- **Server Actions ([`src/app/workspace/[businessId]/cajas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cajas/actions.ts)):**
  - `calculateDateRangeClosureAction` y `exportDateRangeClosurePdfAction` protegidas con RBAC multi-tenant (`cash.view`).
- **Interfaz de Usuario ([`src/components/cash/date-range-closure-panel.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/date-range-closure-panel.tsx) & [`src/components/cash/workspace-caja-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/cash/workspace-caja-client.tsx)):**
  - Nueva pestaña *"Cierre por Rango (Máx. 30 días)"* en `/workspace/[businessId]/caja`.
  - Botones de selección rápida (*"Últimos 7 días"*, *"Últimos 15 días"*, *"Últimos 30 días"*) y selectores de fecha inicial/final con validación inmediata en cliente y servidor si supera los 30 días.
  - Tarjetas ejecutivas de Resumen General, desglose por canal, tabla de cuadre por método de pago, desglose cronológico día por día y botón *"Exportar PDF"*.
  - Cero uso de alertas nativas (`window.alert`, `window.confirm`, `window.prompt`).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-caj-005-date-range-closure.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-caj-005-date-range-closure.test.ts) (**4/4 pruebas pasando al 100%**).

---

### MES-001
**ID:** MES-001  
**Nombre:** Implementar salas de restaurante  
**Fase:** 6 | **Módulo:** Mesas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** El módulo de mesas carecía de soporte para organizar las mesas físicas por ambientes o salas del restaurante (como "Terraza", "Interior", "Barra" o "VIP"), lo que impedía agrupar y supervisar visualmente la disponibilidad por zona.

**Objetivo:** Crear el esquema de salas (`restaurant_rooms`), vincular las mesas a una sala (`room_id`), incorporar la pestaña "Salas" y el modal "Crear Nueva Sala" (ubicación, nombre, descripción) en el módulo de Mesas, permitir asignar mesas a una sala y agrupar la vista de mesas por sala con estados visuales.

**Alcance & Implementación:**
- **Base de Datos & Migración ([`supabase/migrations/20261030110000_restaurant_rooms_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030110000_restaurant_rooms_schema.sql)):**
  - Tabla `public.restaurant_rooms` con `id`, `business_id`, `location_id REFERENCES locations`, `name`, `description`, `status` (`'active' | 'inactive'`), `sort_order`, `created_at`, `updated_at` y restricción `UNIQUE (business_id, name)`.
  - Columna `room_id UUID REFERENCES public.restaurant_rooms(id) ON DELETE SET NULL` añadida a `public.restaurant_tables`.
  - Índices de rendimiento y políticas RLS multi-tenant.
- **Tipos y Servicio de Restaurante ([`src/lib/restaurant/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts), [`src/lib/restaurant/restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts)):**
  - Esquemas `RestaurantRoomSchema`, `CreateRestaurantRoomSchema` e interfaz `RestaurantRoomWithTables` (`tablesCount`, `availableTablesCount`, `occupiedTablesCount`).
  - Funciones `getRestaurantRooms`, `getRestaurantRoomsWithTables` y `createRestaurantRoom` con validación de nombres únicos por negocio.
  - Enriquecimiento de `roomName` en `getRestaurantTablesWithOrders` y soporte de `room_id` en `createRestaurantTable` y `updateRestaurantTable`.
- **Server Actions ([`src/app/workspace/[businessId]/mesas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/actions.ts)):**
  - `getRestaurantRoomsAction`, `getRestaurantRoomsWithTablesAction` y `createRestaurantRoomAction` protegidas con RBAC multi-tenant (`tables.view`, `tables.create`, `tables.manage`).
- **Interfaz de Usuario ([`src/components/mesas/create-room-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/mesas/create-room-modal.tsx), [`src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx), [`src/app/workspace/[businessId]/mesas/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/page.tsx)):**
  - Pestaña **"Salas"** en `/workspace/[businessId]/mesas` con tarjetas por sala mostrando ubicación, descripción, contadores de mesas totales/libres/ocupadas, barra de porcentaje de ocupación y acciones rápidas.
  - Modal **"Crear Nueva Sala"** con atajos rápidos (*Terraza*, *Interior*, *Barra*, *VIP*, *Jardín*), selector de ubicación física y descripción.
  - Selector de Sala en los modales de **"Registrar Nueva Mesa"** y **"Editar Mesa"**.
  - Vista de **"Mesas"** agrupada por sala con encabezados de zona, indicadores de estados visuales (`X Libres`, `Y Ocupadas`) y filtros rápidos por sala.
  - Cumplimiento estricto de cero alertas nativas (`ModalPortal` y `sonner` toasts).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-mes-001-rooms.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-mes-001-rooms.test.ts) (**5/5 pruebas pasando al 100%**).

---

### MES-002
**ID:** MES-002  
**Nombre:** Implementar traslado de mesas  
**Fase:** 6 | **Módulo:** Mesas | **Prioridad:** P1  
**Estado:** Completada  

**Problema:** Cuando un comensal solicitaba cambiarse de mesa en el restaurante, no existía una acción para trasladar la comanda activa a otra mesa libre, obligando a cancelar o recrear el pedido manualmente.

**Objetivo:** Permitir trasladar el pedido activo de una mesa ocupada hacia una mesa libre, actualizando la referencia en la comanda y en ambas mesas y registrando el movimiento en `audit_logs`.

**Alcance & Implementación:**
- **Tipos y Servicio de Restaurante ([`src/lib/restaurant/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts), [`src/lib/restaurant/restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts)):**
  - Interfaz `TransferRestaurantTableInput` (`sourceTableId`, `targetTableId`, `notes`).
  - Función `transferRestaurantTable(businessId, sourceTableId, targetTableId, options)`:
    - Valida aislamiento multi-tenant (`business_id`), que la mesa origen esté ocupada con un pedido activo y que la mesa destino esté libre (`status === 'available'` y `current_order_id === null`).
    - Actualiza `table_id` en `restaurant_orders` hacia la mesa destino conservando intactos todos sus ítems (`restaurant_order_items`), estado (`status`), notas y totales.
    - Libera la mesa de origen (`status = 'available'`, `current_order_id = null`) y marca la mesa de destino como ocupada (`status = 'occupied'`, `current_order_id = activeOrderId`).
    - Registra el evento en `audit_logs` (`action: 'table.transfer'`, `entity: 'restaurant_table'`, `entity_id: sourceTableId`, con detalle de mesa origen, mesa destino, pedido y motivo/nota) además de `logAuditAction`.
- **Server Action ([`src/app/workspace/[businessId]/mesas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/actions.ts)):**
  - `transferRestaurantTableAction(businessId, sourceTableId, targetTableId, notes)` protegida con `verifyWorkspaceAction`.
- **Interfaz de Usuario ([`src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx)):**
  - Botón operativo **"Trasladar"** en cada mesa ocupada (tanto en vista *Plano Salón*, *Lista Rápida* como en el menú contextual de la mesa).
  - Modal personalizado **"Trasladar Mesa"** (`ModalPortal`, cero alertas nativas) con resumen de la comanda activa, selector filtrado exclusivamente con mesas disponibles y campo opcional de motivo/nota.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-mes-002-table-transfer.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-mes-002-table-transfer.test.ts) (**5/5 pruebas pasando al 100%**).



---

### MES-003
**ID:** MES-003  
**Nombre:** Completar cobro de mesa (propinas, descuentos preestablecidos)  
**Fase:** 6 | **Módulo:** Mesas | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Tipos ([`src/lib/restaurant/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts)):**
  - `PRESET_TABLE_DISCOUNTS` (Adulto Mayor 10%, Estudiante 15%, Convenio/Empleado 20%, Cliente Frecuente 5%) y `PRESET_TIP_PERCENTAGES` (5%, 10%, 15%).
  - `ProcessOrderPaymentInput.closeTableOrder`, `PaymentDiscountInput.presetId` y monto/porcentaje calculables en servidor.
  - `OrderFinancialBreakdown` y `TableSalesAndTipsReport` para reportes con propina separada.
- **Servicio ([`restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts)):**
  - `registerRestaurantOrderPayment`: resuelve descuentos preestablecidos o personalizados y propinas por porcentaje o monto en el servidor; devuelve `summary` (subtotal, descuento, venta neta, propina, total recaudado). Con `closeTableOrder` pasa el pedido a `delivered` y libera la mesa.
  - `closeTableOrderWithPayment`: identifica la orden activa de la mesa (aislamiento multi-tenant), registra el pago (único o mixto) y deja la mesa en `available` con `current_order_id = null`.
  - `extractOrderFinancialBreakdown` y `getTableSalesAndTipsReport`: venta neta, propinas, descuentos y total recaudado por separado.
- **Reportes financieros ([`expenses-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/expenses/expenses-service.ts)):** `getExpenseKPIs` / `getFinancialReport` exponen `totalTips` y `totalDiscounts` separados de `totalSales` (la propina no infla los ingresos por ventas).
- **Server Actions ([`mesas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/actions.ts)):** `getTableActiveOrderDetailsAction`, `closeTableOrderWithPaymentAction` y `getTableSalesAndTipsReportAction` con RBAC.
- **UI:**
  - Modal "Cerrar Órdenes" ([`close-table-order-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/mesas/close-table-order-modal.tsx)): seleccionar la mesa y ver el total y el consumo, descuentos preestablecidos o personalizados, propina 5/10/15% o personalizada, pago único o mixto con control de cobertura y cambio en efectivo, y el botón **"Confirmar Pago"**.
  - Plano de mesas ([`tables-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx)): botón "Cerrar Órdenes (N)" en la cabecera y botón "Cobrar" en cada mesa ocupada (vista de plano y lista).
  - El modal de pago del POS ([`order-payment-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/payments/order-payment-modal.tsx)) incorpora los mismos descuentos preestablecidos y la propina del 5%.
  - No usa alertas nativas del navegador.
- **Pruebas:** [`tests/unit/workspace-mes-003-table-checkout.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-mes-003-table-checkout.test.ts) (**6/6**); regresión de POS, crédito, ventas, salas, gastos, anulaciones y cajas (**53/53**).

---

### KDS-001
**ID:** KDS-001  
**Nombre:** Implementar monitor de cocina (KDS)  
**Fase:** 6 | **Módulo:** KDS | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Ruta dedicada y pantalla completa:**
  - Nueva ruta `/workspace/[businessId]/cocina` ([`page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/page.tsx)), reemplazando el antiguo placeholder `/modulo/cocina`.
  - Integración en navegación principal ([`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts)) como módulo implementado bajo Operación para negocios gastronómicos.
  - Acceso directo rápido desde el header de Gestión de Pedidos ([`orders-list-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/orders-list-client.tsx)).
- **Monitor en tiempo real ([`kds-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/kds-screen-client.tsx)):**
  - Vista Fullscreen optimizada para pantallas táctiles y monitores de cocina (toggle con API Fullscreen).
  - Pestañas operativas con conteo dinámico: **Pendiente** (`received`), **Preparando** (`in_preparation`), **Listo** (`ready`), **Entregado** (`delivered`) y **Todas**.
  - Filtro por tipo de orden: Mesas (`dine_in`), Para llevar (`takeout`) y Domicilio (`delivery`), más búsqueda textual.
  - Tarjetas de órdenes con número de comanda destacado, tipo de orden, nombre de mesa/cliente, reloj de creación y lista completa de productos, cantidades, variantes, modificadores y notas de preparación destacadas.
  - Botones de acción directos:
    - En Pendiente: botón "Iniciar Preparación" (pasa a `in_preparation`).
    - En Preparando: botón "Marcar Listo" (pasa a `ready`) y botón para regresar a Pendiente.
    - En Listo: botón "Entregar Pedido" (pasa a `delivered`) y botón para regresar a Preparando.
    - En Entregado: indicador de entrega y opción para reabrir.
- **Tiempos y alertas visuales ([`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts)):**
  - Ticker de tiempo transcurrido en vivo con actualización automática cada segundo.
  - Alerta amarilla (`warning`) para comandas > 15 min.
  - Alerta roja parpadeante (`critical`) para comandas > 30 min (`animate-pulse`).
- **Suscripción Realtime & Alertas Sonoras:**
  - Canal Supabase Realtime escuchando `restaurant_orders` por `business_id` en tiempo real.
  - Alerta sonora automática al recibir nuevas comandas ([`order-sound-player.ts`](file:///d:/Proyectos/NEGOVA/src/lib/audio/order-sound-player.ts)) con control de silenciado / activación.
  - Sincronización y fallback de polling cada 15s.
- **Server Actions & Servicio:**
  - `getKdsOrdersAction` y `updateKdsOrderStatusAction` en [`actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/actions.ts).
  - Función `getKdsOrders` en [`restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts) con ordenamiento FIFO de pedidos activos y mesas resueltas.
- **Prohibición de alertas nativas:** Cero uso de `window.alert`, `window.confirm`, `window.prompt` o `Alert.alert`. Notificaciones mediante `toast` (sonner).
- **Pruebas unitarias:** [`tests/unit/workspace-kds-001-screen.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-kds-001-screen.test.ts) (**16/16** passing) y suite de regresión (**46/46** passing).

---

### KDS-002
**ID:** KDS-002  
**Nombre:** Implementar tiempos de preparación y alertas  
**Fase:** 6 | **Módulo:** KDS | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Servicio y Configuración ([`src/lib/restaurant/restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts), [`src/lib/restaurant/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts)):**
  - Funciones `getKdsAlertConfig` y `saveKdsAlertConfig` para persistir y consultar `warningMinutes` (alerta amarilla) y `criticalMinutes` (alerta roja) en `businesses.settings.kds_alerts`, con fallback a valores predeterminados (15 min / 30 min).
  - Validación de negocio: umbral crítico estrictamente mayor al de advertencia.
- **Server Actions ([`src/app/workspace/[businessId]/cocina/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/actions.ts)):**
  - `getKdsAlertConfigAction` (protegida con `orders.view`) y `saveKdsAlertConfigAction` (protegida con `orders.update`) con revalidación de rutas `/cocina` y `/pedidos`.
- **Monitor de Cocina KDS ([`src/app/workspace/[businessId]/cocina/kds-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/kds-screen-client.tsx)):**
  - Botón de **"Umbrales"** en la cabecera que muestra los tiempos activos y abre el modal de configuración de tiempos de alerta (`ModalPortal`, cero alertas nativas) con plantillas rápidas (*Rápido 8m/15m*, *Estándar 15m/30m*, *Gourmet 20m/40m*).
  - Tarjetas de comandas con estilos dinámicos según el tiempo transcurrido y los umbrales configurados:
    - Normal: slate neutro y badge con icono de reloj.
    - Demorado: borde y fondo ámbar con badge `AlertTriangle`.
    - Crítico: borde rojo, fondo rose con badge `Flame` parpadeante (`animate-pulse`).
  - Chips de resumen interactivos en cabecera: "Demorados (+Xm)" y "Críticos (+Ym)" con filtrado directo al hacer clic.
- **Módulo "Mis Órdenes" ([`src/app/workspace/[businessId]/pedidos/orders-list-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/orders-list-client.tsx)):**
  - Dos tarjetas de indicadores de alerta dinámicas: **Comandas Demoradas** (> X min) y **Comandas Críticas** (> Y min) con contadores en tiempo real y filtrado interactivo.
  - En la Cola Operativa (Kanban): tarjetas de comanda con pills de alerta `⚠️ Demorado (XX:XX)` o `🔥 Crítico (XX:XX)` y anillos de color distintivos.
  - En la Tabla de Historial: columna de *Estado Operativo* enriquecida con badges de demora y estado crítico para pedidos activos.
  - En el modal de detalle de comanda: visualización destacada del nivel de alerta y tiempo transcurrido.
  - Ticker en vivo cada 15s para actualizar estados de alerta sin recargar página.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-kds-002-alerts.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-kds-002-alerts.test.ts) (**8/8 pruebas pasando al 100%**).

---

### KDS-003
**ID:** KDS-003  
**Nombre:** Implementar vista de tickets abiertos  
**Fase:** 6 | **Módulo:** KDS | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Servicio y Enriquecimiento de Datos ([`src/lib/restaurant/restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts), [`src/lib/restaurant/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/types.ts)):**
  - Tipos `OpenTicketDetails`, `OpenTicketsSummary` y `KdsOpenTicketsResponse`.
  - Función `getKdsOpenTickets(businessId)` que consulta todos los pedidos no cobrados (`payment_status != 'paid'` y `status != 'cancelled'`), cruzando con mesas (`restaurant_tables`), salas (`restaurant_rooms`) y perfiles de usuario (`profiles`) para resolver cajero o camarero.
  - Cálculo de comensales automático: por capacidad de mesa asignada o parsing de notas.
  - Clasificación en vivo de alertas de preparación: normal, demorado (`warning`) y crítico (`critical`) según los umbrales configurados en `KDS-002`.
- **Server Actions ([`src/app/workspace/[businessId]/cocina/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/actions.ts)):**
  - Acción `getKdsOpenTicketsAction(businessId)` protegida con permisos RBAC multi-tenant (`orders.view`).
- **Interfaz de Usuario ([`open-tickets-panel.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/open-tickets-panel.tsx), [`kds-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/kds-screen-client.tsx), [`cocina/tickets/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/cocina/tickets/page.tsx)):**
  - Pestaña / Vista conmutable "Tickets Abiertos" en el monitor KDS y ruta dedicada `/cocina/tickets`.
  - 3 KPIs superiores ejecutivos:
    - **Total Abiertos:** conteo total de tickets activos no pagados y monto acumulado por cobrar.
    - **Demorados:** conteo de comandas en advertencia (> umbral amarillo) y monto acumulado.
    - **Críticos:** conteo de comandas en estado crítico (> umbral rojo) y monto acumulado.
  - Tarjetas de ticket con badges de canal (`POS / Presencial`, `Menú QR`, `WhatsApp / Domicilio`), tipo de servicio, nombre de mesa y sala, comensales, cliente, teléfono, cajero responsable y tiempo transcurrido en vivo.
  - Enlaces de acción rápida: botón a **"Mis Órdenes"** (`/pedidos/[id]`) y botón **"Cobrar / Factura"** (`/mesas?mesaId=...` o modal de pago).
  - Cumplimiento estricto: Cero alertas nativas del navegador.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-kds-003-open-tickets.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-kds-003-open-tickets.test.ts) (**7/7 pruebas pasando al 100%**).

---

### DOM-001
**ID:** DOM-001  
**Nombre:** Implementar editor de zonas de entrega  
**Fase:** 7 | **Módulo:** Domicilios | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Base de Datos & Migración ([`supabase/migrations/20261030120000_delivery_zones_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261030120000_delivery_zones_schema.sql)):**
  - Tabla `public.delivery_zones` con `id`, `business_id`, `name`, `description`, `tariff` (tarifa base de envío), `min_order` (pedido mínimo), `estimated_time_min` (tiempo estimado), `priority` (resolución de solapamientos), `color`, `geometry` (JSONB con tipo radio o polígono de GeoJSON/puntos), `status` (`active` | `inactive`), `created_at`, `updated_at`.
  - Índices y políticas RLS multi-tenant basadas en pertenencia a `business_users`.
- **Motor Geoespacial y Tipos ([`src/lib/delivery/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/types.ts)):**
  - Algoritmo de distancia Haversine (`calculateHaversineDistanceMeters`) para zonas circulares con centro y radio en metros.
  - Algoritmo Ray-Casting (`isPointInsidePolygon`) para zonas poligonales delimitadas por coordenadas geográficas (`lat`, `lng`).
  - Función `findMatchingDeliveryZone`: evalúa coordenadas de entrega contra las zonas activas del comercio, resuelve por mayor prioridad en solapamientos y retorna la tarifa y tiempo estimado correspondientes.
- **Servicio y Server Actions ([`src/lib/delivery/delivery-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/delivery-service.ts), [`src/app/workspace/[businessId]/pedidos/domicilios/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/domicilios/actions.ts)):**
  - CRUD completo: `getDeliveryZones`, `createDeliveryZone`, `updateDeliveryZone`, `deleteDeliveryZone`, `validateDeliveryAddressZone` con RBAC (`deliveries.view`, `deliveries.manage`).
- **Interfaz de Usuario ([`src/components/delivery/`](file:///d:/Proyectos/NEGOVA/src/components/delivery/)):**
  - Pestaña **"Zonas de Entrega"** en `/pedidos/domicilios` ([`delivery-zones-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/components/delivery/delivery-zones-tab.tsx)).
  - Mapa interactivo con Leaflet/SVG ([`interactive-zone-map.tsx`](file:///d:/Proyectos/NEGOVA/src/components/delivery/interactive-zone-map.tsx)): herramientas táctiles para *"Dibujar polígono"* y *"Dibujar radio"*, previsualización de colores y centroides.
  - Modal **"Nueva Zona / Editar Zona"** ([`zone-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/delivery/zone-form-modal.tsx)): nombre, descripción, tarifa, pedido mínimo, tiempo estimado, prioridad, color y estado activa con validaciones accesibles (`ModalPortal`).
  - Integración en el flujo de creación de pedidos ([`order-destination-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/order-destination-modal.tsx)): verifica si la dirección del cliente cae en alguna zona activa, aplica automáticamente la tarifa de despacho calculada y alerta con advertencia si se encuentra fuera de cobertura.
  - Cumplimiento estricto: cero alertas nativas.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-dom-001-zones.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dom-001-zones.test.ts) (**12/12 pruebas pasando al 100%**).

---

### DOM-002
**ID:** DOM-002  
**Nombre:** Implementar configuración completa de domicilios  
**Fase:** 7 | **Módulo:** Domicilios | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Configuración y Tipos ([`src/lib/delivery/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/types.ts)):**
  - Definición de tipos `DeliveryTariffMode` (`fixed`, `distance`, `zones`), `DeliveryPayer` (`customer`, `business`, `split_50_50`), `DeliveryAssignmentMode` (`manual`, `automatic`, `rotative`), `DeliveryTimingAlertsConfig`, `DeliveryGoalsBonusesConfig` y `DeliveryBusinessConfig`.
  - Configuración por defecto `DEFAULT_DELIVERY_BUSINESS_CONFIG`: tarifa fija de $5.000 COP, cliente asume el costo, alerta visual de retraso a los 30 min, meta diaria de 15 pedidos, bono nocturno configurable.
  - Normalizador tolerante `normalizeDeliveryBusinessConfig` compatible con registros heredados (`{ enabled, fee }`).
  - Motor puro de cálculo de tarifa `calculateDeliveryFeeForOrder`: calcula el cobro al cliente, el subsidio del negocio, el umbral de envío gratis y el reparto equitativo 50/50.
- **Capa de Persistencia y Servicio ([`src/lib/delivery/delivery-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/delivery/delivery-service.ts)):**
  - Métodos `getDeliveryBusinessConfig(businessId)` y `updateDeliveryBusinessConfig(businessId, input, actorId)`.
  - Persistencia transaccional en `businesses.settings.delivery` con auditoría de cambios registrada.
- **Server Actions con RBAC ([`src/app/workspace/[businessId]/pedidos/domicilios/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/pedidos/domicilios/actions.ts)):**
  - `getDeliveryConfigAction(businessId)` con verificación de permisos `orders.view`.
  - `updateDeliveryConfigAction(businessId, input)` con verificación de permisos `orders.manage` e invalidación de caché en `/pedidos/domicilios`, `/pos` y `/pedidos`.
- **Integración con Creación de Pedidos ([`src/lib/restaurant/restaurant-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/restaurant-service.ts)):**
  - `createRestaurantOrder` consulta la configuración de domicilios del negocio y aplica automáticamente las tarifas calculadas según el modo (`fixed`, `distance`, `zones`), umbrales de compra mínima y asignación de pagador (`payer`).
- **Interfaz de Usuario ([`src/components/delivery/delivery-config-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/components/delivery/delivery-config-tab.tsx)):**
  - Pestaña **"Configuración"** en el módulo `/pedidos/domicilios` con navegación por subsecciones y estado del servicio:
    1. **Tarifa por domicilio:** Selector de modalidad (Fija, Por Distancia, Por Zona con tarifa de contingencia), monto editable y atajos rápidos ($3.000, $5.000, $8.000, etc.).
    2. **Distribución del costo (Quién paga):** Cliente 100%, Negocio 100% (envío gratis asumido) o Compartido 50/50, más umbral de pedido para envío gratuito.
    3. **Modo de asignación:** Manual, Automática al repartidor más cercano o Rotativa / Round-Robin equitativo.
    4. **Tiempos y alertas operativas:** Tiempo límite para aceptar pedido, umbral de minutos para alerta visual y opción de reasignación automática por inactividad.
    5. **Metas y bonificaciones:** Meta diaria de despachos, bonificación por cumplimiento y recargo nocturno por franja horaria.
  - Alerta dinámica pulsante `⚠️ Demorado (X min)` en las tarjetas de pedidos activos ([`deliveries-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/delivery/deliveries-client.tsx)) cuando se supera el tiempo máximo configurado (e.g. 30 minutos).
  - Integración en POS ([`order-destination-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/order-destination-modal.tsx)) reflejando en tiempo real la tarifa por defecto, indicador de pagador y validación de pedido mínimo.
  - Notificaciones elegantes con `sonner`; regla de cero alertas nativas estrictamente cumplida.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-dom-002-config.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dom-002-config.test.ts) (**11/11 pruebas pasando al 100%**).

---

### DOM-003
**ID:** DOM-003  
**Nombre:** Implementar vista por repartidor  
**Fase:** 7 | **Módulo:** Domicilios | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Pestaña "Por Repartidor":** Componente reactivo [`driver-view-tab.tsx`](file:///d:/Proyectos/NEGOVA/src/components/delivery/driver-view-tab.tsx) integrado en la pantalla principal de domicilios.
- **Agrupación y Despacho:** Agrupa pedidos activos por repartidor asignado y columna destacada para pedidos sin asignar (`Sin asignar`).
- **Monitoreo en Tiempo Real:** Cálculo dinámico de tiempo transcurrido (`useLiveElapsedTimer`) con actualización continua de segundos y minutos.
- **Acciones y Reasignación:** Botones rápidos de asignación/reasignación de motorizado y actualización de estado de entrega (`assigned`, `on_the_way`, `delivered`).
- **Pruebas Automatizadas:** Suite unitaria [`tests/unit/workspace-dom-003-driver-view.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dom-003-driver-view.test.ts) (9/9 pruebas pasando al 100%).

---

### REP-001
**ID:** REP-001  
**Nombre:** Implementar dashboard de KPIs de ventas  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Tipos y Contratos ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Definición de tipos estructurados `SalesDashboardData`, `ReportsDateRange`, `ReportsDatePreset`, `SalesKpiSummary`, `SalesChannelMeta`, `SalesChannelType`, `TopProductItem`, `DailySalesBarItem`, y `TrendSalesLineItem`.
- **Servicio Analítico ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Función `getSalesDashboardMetrics(businessId, dateRange, businessTimezone)`.
  - Agrupa y concilia `business_sale_documents` activos junto a `restaurant_orders`.
  - Calcula ventas del día, semana, mes, ticket promedio del periodo, desglose por canal (`mostrador`, `mesa`, `domicilio`, `digital_menu`), Top 5 productos por facturación y volumen, gráfico de barras de los últimos 7 días con días en español y gráfico de tendencia acumulada a 30 días.
  - Genera indicador de estado vacío cuando no existen ventas registradas.
- **Server Action con Permisos ([`src/app/workspace/[businessId]/dashboard/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/dashboard/actions.ts)):**
  - `getSalesDashboardMetricsAction(businessId, dateRange)` protegido con `verifyWorkspaceAction(businessId, 'reports:read')`.
  - Compatibilidad de permisos en [`permissions.ts`](file:///d:/Proyectos/NEGOVA/src/lib/auth/permissions.ts) y [`workspace-context.ts`](file:///d:/Proyectos/NEGOVA/src/lib/auth/workspace-context.ts) mapeando `reports:read` con `reports.view`.
- **Vistas e Interfaz ([`src/app/workspace/[businessId]/dashboard/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/dashboard/)):**
  - Página SSR con validación multi-tenant en [`page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/dashboard/page.tsx).
  - Componente cliente [`sales-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/dashboard/sales-dashboard-client.tsx):
    - 4 tarjetas KPI (Ventas del Día, Ventas de la Semana, Ventas del Mes, Ticket Promedio / Ventas del Período).
    - Selector de rango de fechas: Hoy, Ayer, Últimos 7 días, Este mes, Rango personalizado con date-picker.
    - Gráfico de barras interactivo (Recharts) con ventas por día (últimos 7 días).
    - Gráfico de área/línea interactivo (Recharts) con tendencia acumulada (últimos 30 días).
    - Desglose visual por canales de venta con barras de progreso y porcentajes.
    - Ranking de Top 5 productos más vendidos con facturación y unidades.
    - Estado vacío ilustrado con llamada a la acción si el comercio no tiene ventas aún.
- **Navegación y Acceso Central:**
  - Actualización en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) marcando módulo `reportes` como implementado hacia `/dashboard`.
  - Botón de acceso directo en la cabecera de [`workspace/[businessId]/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/page.tsx).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-001-sales-dashboard.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-001-sales-dashboard.test.ts) (**9/9 pruebas pasando al 100%**, benchmark < 3s para 1000 comprobantes verificado en < 160ms, y 0 alertas nativas).

### REP-002
**ID:** REP-002  
**Nombre:** Implementar reporte de ventas con exportación  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Contratos de Dominio ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Tipos `SalesReportFilterParams`, `SalesReportRow`, `SalesReportSummary`, y `SalesReportData`.
- **Servicio Analítico ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Función `getSalesReportData(businessId, filterParams, businessTimezone)` que consolida comprobantes comerciales (`business_sale_documents`), comandas (`restaurant_orders`), perfiles de usuarios (`profiles`) e información comercial del negocio.
  - Soporte de filtros multidimensionales: rango de fechas (presets: hoy, ayer, 7 días, este mes o personalizado), canal de venta (`mostrador`, `mesa`, `domicilio`, `digital_menu`), método de pago (`cash`, `card`, `transfer`, `credit`, `split`), cajero/empleado responsable, estado de la transacción (`completed`, `cancelled`), y búsqueda de texto por documento o cliente.
  - Extracción y normalización de motivos de cancelación para ventas anuladas (`notes` o `audit_logs`).
  - Cálculo estricto de totales para el resumen inferior: `totalGross`, `totalTax`, `totalDiscount`, `totalNet` y `transactionCount`.
- **Motor de Generación PDF ([`src/lib/reports/sales-report-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/sales-report-pdf.ts)):**
  - Generador A4 apaisado (*landscape*) institucional con jsPDF.
  - Membrete comercial con nombre del negocio, NIT, dirección, teléfono y logotipo oficial si existe.
  - 5 tarjetas resumen financieras y tabla paginada con alternancia de filas, badges coloreados de estado/canal, motivo de anulación y numeración de páginas.
- **Motor de Exportación Excel / CSV ([`src/lib/reports/sales-report-csv.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/sales-report-csv.ts)):**
  - Generación de CSV con Byte Order Mark (BOM `\uFEFF`) para compatibilidad directa con caracteres en español y símbolos en Microsoft Excel sin problemas de codificación.
  - Incluye todas las 12 columnas sin truncar y fila final de totales consolidados.
- **Server Actions con RBAC ([`src/app/workspace/[businessId]/reportes/ventas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/ventas/actions.ts)):**
  - `getSalesReportAction`, `exportSalesReportPdfAction` y `exportSalesReportCsvAction` protegidas mediante `verifyWorkspaceAction(businessId, "reports:read")` y `"reports.view"`.
- **Vistas SSR y UI Cliente ([`src/app/workspace/[businessId]/reportes/ventas/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/ventas/)):**
  - `page.tsx`: Carga SSR inicial asegurada con `requireWorkspaceSession(businessId, "reports.view")`.
  - `sales-report-client.tsx`: Interfaz interactiva de consulta con barra de filtros completa, estados de carga, selector de presets y fechas personalizadas, tabla de resultados con badges de canal y estado (mostrando motivo si la venta fue anulada), botones directos de descarga PDF y Excel, y resumen inferior con 5 KPIs sincronizados.
- **Regla Estricta Global:**
  - Cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`, `Alert.alert`). Notificaciones manejadas con `sonner` (`toast.success`, `toast.error`, `toast.loading`).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-002-sales-report.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-002-sales-report.test.ts) (**8/8 pruebas pasando al 100%**, cubriendo filtros, totales de resumen, exportación PDF con membrete/logo, CSV con BOM y todas las columnas, ventas anuladas con motivo y verificación estricta de 0 alertas nativas).

---

### REP-003
**ID:** REP-003  
**Nombre:** Implementar reporte de empleados  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Datos y Tipos Canónicos ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Definición de interfaces `EmployeeReportFilterParams`, `EmployeeReportMetricItem`, `EmployeeReportSummary` y `EmployeeReportData`.
  - Atributos por colaborador: `userId`, `name`, `email`, `roleCode`, `roleName`, `salesCount`, `totalSalesAmount`, `averageTicketAmount`, `shiftsCount`, `totalHoursWorked`, `totalTipsAmount`, `locations`, `rank`, `salesPercentage` y `status`.
- **Capa de Servicio y Agregación Multi-tenant ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Función `getEmployeeReportData(businessId, filterParams, businessTimezone)`:
    - Consulta en paralelo `business_users`, `profiles`, `roles`, `locations`, `cash_registers`, `cash_sessions`, `business_sale_documents`, `restaurant_orders` y `businesses`.
    - **Criterio 1:** Lista todos los empleados activos del negocio (`business_users` con `status = 'active'`), garantizando que incluso colaboradores sin ventas figuren con $0 y métricas coherentes.
    - **Criterio 2:** Las ventas por empleado coinciden exactamente con la suma de `business_sale_documents` donde `created_by` = empleado (en el rango de fechas seleccionado y excluyendo ventas anuladas/canceladas).
    - **Criterio 3:** Ranking ordenado estrictamente de mayor a menor por monto total vendido (`totalSalesAmount`), con desempate por cantidad de ventas.
    - Agregación precisa de sesiones de caja (`shiftsCount`), cálculo de horas trabajadas entre apertura y cierre, y consolidación de propinas recibidas (`extractTipFromOrder`).
- **Generadores de Exportación Profesional:**
  - **PDF ([`src/lib/reports/employee-report-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/employee-report-pdf.ts)):** Documento formal en A4 horizontal con membrete institucional del comercio, período visible, bloque de 6 tarjetas de resumen de totales del equipo, podio y tabla completa de ranking de empleados con badges y paginación.
  - **Excel / CSV ([`src/lib/reports/employee-report-csv.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/employee-report-csv.ts)):** Archivo CSV estructurado con Byte Order Mark UTF-8 (`\uFEFF`) para apertura directa en Microsoft Excel en español/Windows, 13 columnas completas y fila final de totales y promedios consolidados.
- **Server Actions Seguras ([`src/app/workspace/[businessId]/reportes/empleados/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/empleados/actions.ts)):**
  - `getEmployeeReportAction`, `exportEmployeeReportPdfAction` y `exportEmployeeReportCsvAction` autorizadas mediante `verifyWorkspaceAction(businessId, "reports:read")` y `"reports.view"`.
- **Interfaz de Usuario y Navegación ([`src/app/workspace/[businessId]/reportes/empleados/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/empleados/)):**
  - Barra de pestañas unificada [`ReportNavTabs`](file:///d:/Proyectos/NEGOVA/src/components/reports/report-nav-tabs.tsx) para alternar al instante entre *Dashboard de Ventas*, *Reporte de Ventas* y *Reporte de Empleados*.
  - `page.tsx`: Carga SSR inicial con validación multi-tenant `requireWorkspaceSession(businessId, "reports.view")`.
  - `employee-report-client.tsx`:
    - Podio visual de desempeño (Top 3 en ventas con distintivos de Oro, Plata y Bronce).
    - Filtros por rango de fecha (Hoy, Ayer, Últimos 7 días, Este mes, Personalizado con date pickers), selector de Ubicación / Sede, selector de Rol y búsqueda por nombre o correo.
    - Cuadrícula de 4 tarjetas KPI con métricas agregadas del equipo.
    - Tabla responsiva detallada con badges de ranking, avatar, rol, ventas, monto, barra de participación porcentual, ticket promedio, turnos, horas, propinas y estado activo.
    - Botones de descarga directa para PDF y Excel con feedback de estado (`Loader2`, Sonner toast). Cero alertas nativas.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-003-employee-report.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-003-employee-report.test.ts) (**8/8 pruebas pasando al 100%**, cubriendo todos los criterios de aceptación, filtros, podio, exportación PDF/Excel y verificación de 0 alertas nativas).

---

### REP-004
**ID:** REP-004  
**Nombre:** Implementar reporte de inventario  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Dominio y Tipos Canónicos ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Definición de interfaces `InventoryStockReportRow`, `InventoryMovementReportRow`, `InventoryLowStockReportRow`, `InventoryReportSummary`, `InventoryReportFilterParams` y `InventoryReportData`.
- **Capa de Servicio y Agregación Multi-tenant ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Función `getInventoryReportData(businessId, filterParams, businessTimezone)`:
    - **Criterio 1:** Las existencias mostradas coinciden exactamente con `inventory_stock` por producto y ubicación.
    - **Criterio 2:** El valor total del inventario = $\Sigma(\text{quantity} \times \text{cost})$ de todos los productos en existencias.
    - **Criterio 3:** Los movimientos reflejan la trazabilidad documental de referencia (`formatMovementReference`) vinculando compras, ventas en POS, arqueos físicos/ajustes y transferencias con su respectivo usuario y fecha local.
    - **Criterio 4:** Identificación y cálculo de stock bajo (`quantity <= min_stock`) y agotado (`quantity <= 0`), con cálculo de déficit y costo estimado de reposición.
- **Generadores de Exportación Profesional:**
  - **PDF ([`src/lib/reports/inventory-report-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/inventory-report-pdf.ts)):** Documento formal en A4 horizontal con membrete institucional del negocio, 4 tarjetas de resumen de existencias, tablas formateadas según la vista activa (existencias, movimientos o stock bajo) con totales y paginación.
  - **Excel / CSV ([`src/lib/reports/inventory-report-csv.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/inventory-report-csv.ts)):** Archivo CSV estructurado con Byte Order Mark UTF-8 (`\uFEFF`) para apertura directa en Microsoft Excel en español/Windows, con columnas completas y fila final de totales.
- **Server Actions Seguras ([`src/app/workspace/[businessId]/reportes/inventario/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/inventario/actions.ts)):**
  - `getInventoryReportAction`, `exportInventoryReportPdfAction` y `exportInventoryReportCsvAction` autorizadas mediante `verifyWorkspaceAction(businessId, "reports:read")`, `"reports.view"` e `"inventory.view"`.
- **Interfaz de Usuario y Navegación ([`src/app/workspace/[businessId]/reportes/inventario/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/inventario/)):**
  - Pestaña de Inventario integrada en [`ReportNavTabs`](file:///d:/Proyectos/NEGOVA/src/components/reports/report-nav-tabs.tsx) para navegación fluida entre todos los reportes.
  - `page.tsx`: Carga SSR inicial con validación multi-tenant `requireWorkspaceSession(businessId, "reports.view")`.
  - `inventory-report-client.tsx`:
    - 4 tarjetas KPI (Valor Total del Inventario, Unidades en Existencia, Stock Bajo, Sin Stock / Agotados).
    - Barra de filtros con selector de ubicación, categoría, estado de stock, rango de fechas de movimientos, tipo de movimiento y búsqueda rápida por nombre o SKU.
    - 3 vistas completas por pestañas: **Existencias Actuales**, **Movimientos del Período** y **Productos con Stock Bajo**.
    - Badges visuales de alerta para productos con stock bajo o agotado.
    - Descarga directa en un clic de PDF y Excel con feedback de estado. Cero alertas nativas.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-004-inventory-report.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-004-inventory-report.test.ts) (**9/9 pruebas pasando al 100%**, cubriendo todos los criterios de aceptación, cálculo de valor total, trazabilidad de referencias, filtros, exportación PDF/Excel y verificación estricta de 0 alertas nativas).

---

### REP-005
**ID:** REP-005  
**Nombre:** Implementar reportes de gastos y compras  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P1  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Dominio y Tipos Canónicos ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Definición de interfaces `ExpenseReportRow`, `ExpenseCategoryDistribution`, `ExpenseMonthlyBarItem`, `ExpenseReportSummary`, `PurchaseReportItemDetail`, `PurchaseReportRow`, `TopSupplierPurchaseItem`, `PurchaseReportSummary`, `ExpensesAndPurchasesFilterParams` y `ExpensesAndPurchasesReportData`.
- **Capa de Servicio y Agregación Multi-tenant ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Función `getExpensesAndPurchasesReportData(businessId, filterParams, businessTimezone)`:
    - **Criterio 1:** Los montos de gastos coinciden exactamente con `public.expenses`, calculando `totalExpenses` con los registros activos/completados y distinguiendo visualmente los anulados.
    - **Criterio 2:** Las compras reflejan las órdenes de compra confirmadas (`public.purchases` con `status = 'confirmed'`), sumando subtotal, impuestos y total neto.
    - **Criterio 3:** El gráfico de distribución por categoría suma exactamente 100.0%, normalizando porcentajes y asignando paleta cromática diferenciada.
    - Cálculo de promedio diario por día calendario del período, identificación de categoría principal con participación porcentual, agrupación de gastos mensuales para los últimos 6 meses cronológicos, ranking de Top 5 proveedores por monto y cálculo de cuentas por pagar pendientes desde `public.accounts_payable`.
    - Vinculación documental de ítems de compra (`purchase_items`) a cada orden para auditoría completa.
- **Generadores de Exportación Profesional:**
  - **PDF ([`src/lib/reports/expenses-purchases-report-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/expenses-purchases-report-pdf.ts)):** Documento formal A4 horizontal con membrete institucional del comercio, tarjetas KPI de gastos y compras, tabla de gastos con método de pago y **detalle de productos comprados en la tabla de compras** (Criterio 4).
  - **Excel / CSV ([`src/lib/reports/expenses-purchases-report-csv.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/expenses-purchases-report-csv.ts)):** Archivo CSV estructurado con Byte Order Mark UTF-8 (`\uFEFF`) para compatibilidad directa con Microsoft Excel en español/Windows, detalle de productos comprados y filas finales de totales consolidados.
- **Server Actions Seguras ([`src/app/workspace/[businessId]/reportes/gastos/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/gastos/actions.ts)):**
  - `getExpensesAndPurchasesReportAction`, `exportExpensesAndPurchasesPdfAction` y `exportExpensesAndPurchasesCsvAction` autorizadas mediante `verifyWorkspaceAction(businessId, "reports.view")`, `"reports:read"`, `"expenses.view"` y `"purchases.view"`.
- **Interfaz de Usuario y Navegación ([`src/app/workspace/[businessId]/reportes/gastos/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/gastos/)):**
  - Pestaña *Gastos y Compras* añadida a [`ReportNavTabs`](file:///d:/Proyectos/NEGOVA/src/components/reports/report-nav-tabs.tsx) y registrada en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts).
  - `page.tsx`: Carga SSR inicial protegida con validación multi-tenant `requireWorkspaceSession(businessId, "reports.view")`.
  - `expenses-report-client.tsx`:
    - Pestañas conmutables entre *Reporte de Gastos Operativos* y *Reporte de Compras a Proveedores*.
    - Barra de filtros con presets de fecha (Hoy, Ayer, 7 Días, Este Mes, Personalizado), dropdown de Categoría, dropdown de Proveedor y buscador textual.
    - En Gastos: 4 tarjetas KPI, Gráfico de Torta de distribución por categoría (Recharts PieChart, suma 100%), Gráfico de Barras histórico de 6 meses (Recharts BarChart) y tabla detallada con medios de pago y estados.
    - En Compras: 4 tarjetas KPI, Top 5 Proveedores con barras de progreso de volumen, y tabla detallada con badges de productos comprados e importes.
    - Botones de descarga directa en PDF y Excel con feedback de estado (`Loader2`, Sonner toast). Cero alertas nativas.
---

### NAV-001
**ID:** NAV-001  
**Nombre:** Añadir búsqueda global al workspace  
**Fase:** 1 | **Módulo:** Navegación | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Dominio y Contratos de Búsqueda ([`src/lib/search/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/search/types.ts)):**
  - Definición de tipos `SearchResultCategory`, `WorkspaceSearchResultItem`, `WorkspaceGlobalSearchResult`.
  - Normalización de metadatos (títulos, subtítulos, badges contextuales, URLs relativas al `businessId`).
- **Capa de Búsqueda Multi-tenant de Alto Rendimiento ([`src/lib/search/workspace-search-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/search/workspace-search-service.ts)):**
  - Implementación de `searchWorkspaceEntities(businessId, query, options)`:
    - Consultas concurrentes (`Promise.all`) a 3 entidades clave:
      1. `products`: Búsqueda por coincidencia parcial insensible a mayúsculas/minúsculas en `name` o `sku`, con distintivo de disponibilidad/agotado.
      2. `customers`: Búsqueda por `full_name`, `document_number`, `phone` o `email`.
      3. `restaurant_orders`: Búsqueda por número de orden (`#104`, etc.) o nombre de cliente comensal.
    - Medición estricta de tiempo de respuesta (`performance.now()`) garantizando resolución en `<500ms`.
- **Acción de Servidor Segura ([`src/app/workspace/[businessId]/search-actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/search-actions.ts)):**
  - `searchWorkspaceGlobalAction(businessId, query)` autenticada y verificada mediante `verifyWorkspaceAction(businessId, "none")` (disponible para todos los usuarios activos del negocio con aislamiento estricto por `business_id`).
- **Componente Command Palette ([`src/components/workspace/workspace-command-palette.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-command-palette.tsx)):**
  - Renderizado en raíz del DOM mediante `ModalPortal` (`@/components/ui/modal-portal`) para evitar colisiones de `z-index` con headers o drawers.
  - Búsqueda en módulos y submódulos de navegación locales de forma instantánea (0ms).
  - Búsqueda remota debounced (120ms) hacia la Server Action para productos, clientes y comandas.
  - Navegación completa por teclado accesible: flechas Arriba/Abajo con scroll automático al elemento activo, `Enter` para ejecutar navegación inmediata y `Escape` para cerrar.
  - Navegación directa con URLs optimizadas:
    - Módulos: rutas canónicas directas.
    - Productos: `/workspace/[businessId]/productos?search=[query]`.
    - Clientes: `/workspace/[businessId]/clientes/[id]`.
    - Pedidos: `/workspace/[businessId]/pedidos/[id]`.
  - Indicador de latencia en el pie de la paleta (`⏱ Xms`).
- **Integración en Shell del Workspace ([`src/components/workspace/workspace-shell.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-shell.tsx)):**
  - Listener global de teclado para `Ctrl+K` y `⌘+K` (`Cmd+K`).
  - Botón de búsqueda rápida en el header con icono y atajo visual `⌘K`.
  - Inclusión de `<WorkspaceCommandPalette />` en el bloque de modales del shell.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-nav-001-search.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-nav-001-search.test.ts) (**7/7 pruebas pasando al 100%**, cubriendo atajo `Ctrl+K`/`⌘+K`, búsqueda de productos y navegación a ficha, búsqueda de clientes y navegación a `/clientes/[id]`, búsqueda de pedidos por número y cliente, benchmark de latencia `<500ms` y verificación estricta de 0 alertas nativas).

---

### NAV-002
**ID:** NAV-002  
**Nombre:** Ampliar accesos rápidos del header  
**Fase:** 1 | **Módulo:** Navegación | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Componente de Accesos Directos ([`src/components/workspace/workspace-header-quick-access.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-header-quick-access.tsx)):**
  - Botonera de acceso rápido configurable e inteligente en la barra superior del workspace.
  - Resolución dinámica de módulos prioritarios (POS, Mesas, Cocina KDS, Domicilios, Nueva Venta y Caja) según el tipo de comercio y permisos del usuario.
  - Badge numérico en tiempo real para pedidos nuevos pendientes de confirmación (`received`) con polling optimizado y sincronización por eventos del navegador (`negova:order-status-updated`).
- **Integración en Shell ([`src/components/workspace/workspace-shell.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-shell.tsx)):**
  - Montado en la barra superior junto al botón de búsqueda global (`Ctrl+K`) y notificaciones.

---

### NAV-003
**ID:** NAV-003  
**Nombre:** Crear widget de suscripción en sidebar  
**Fase:** 1 | **Módulo:** Navegación | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Widget de Suscripción y Cuotas ([`src/components/workspace/workspace-sidebar-subscription-widget.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-sidebar-subscription-widget.tsx)):**
  - Lectura de sesión multi-tenant: `session.planId`, `session.enabledFeatures`, `session.planLimits`, `productCount` y `trialRemainingDays`.
  - Indicador visual del plan activo (Plan Inicio, Plan Crece, Plan Negocio) con distintivo de color corporativo.
  - Badge contextual de período de prueba (`{trialRemainingDays}d prueba`) o badge de estado `Activo`.
  - Monitor de uso de productos en catálogo: conteo actual vs cuota máxima (`{productCount} / {maxProducts} ({percentage}%)`) con barra de progreso reactiva y alerta visual para utilización $\ge 90\%$ (`bg-rose-500`).
  - Soporte transparente para cuotas ilimitadas (`∞`).
  - Botón de llamado a la acción "Actualizar plan" con enlace directo a `/planes`.
  - Soporte completo para modo colapsado (`isCollapsed = true`), mostrando icono compacto con tooltip informativo y badge pulsante.
- **Integración en Navegación Global ([`src/components/workspace/workspace-shell.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-shell.tsx)):**
  - Inyección en el pie del menú lateral mediante la prop `sidebarFooterWidget` consumida por [`AppSidebar`](file:///d:/Proyectos/NEGOVA/src/components/layout/app-sidebar.tsx) y [`AppMobileSidebar`](file:///d:/Proyectos/NEGOVA/src/components/layout/app-mobile-sidebar.tsx).
- **Servicio Backend ([`src/lib/subscriptions/subscriptions-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/subscriptions/subscriptions-service.ts)):**
  - Función `getBusinessSubscriptionDetails` para consultar estado, fecha de expiración y cálculo de días restantes con fallback seguro en caso de contingencia.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-nav-003-subscription-widget.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-nav-003-subscription-widget.test.tsx) (**9/9 pruebas pasando al 100%**, cubriendo renderizado de planes, días de prueba, cuota ilimitada, alerta al 90%, modo colapsado, integración con AppSidebar, servicio de suscripciones y verificación de 0 alertas nativas).

---

### CAT-008
**ID:** CAT-008  
**Nombre:** Añadir scanner de código de barras  
**Fase:** 1 | **Módulo:** Catálogo | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Servicio de Detección y Resolución de Códigos ([`src/lib/products/barcode-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/products/barcode-service.ts)):**
  - Función `findProductByBarcode(products, scannedCode)` que busca por prioridad:
    1. Coincidencia exacta de `metadata.barcode`.
    2. Coincidencia en `variant.barcode` para variantes de producto.
    3. Coincidencia de fallback con `metadata.sku`.
    4. Coincidencia en `variant.sku` para variantes.
  - Normalización insensible a mayúsculas/minúsculas y espacios.
  - Función `validateBarcodeFormat(code)` para reconocimiento de estándares EAN-13, EAN-8, UPC-A, Code 128 y SKU alfanuméricos.
- **Feedback Acústico Profesional ([`src/lib/audio/beep.ts`](file:///d:/Proyectos/NEGOVA/src/lib/audio/beep.ts)):**
  - Módulo sintetizador de audio puro mediante Web Audio API (`AudioContext`).
  - Beep de éxito tipo caja registradora (1950Hz, 120ms) y tono de advertencia doble (320Hz/240Hz, 250ms).
  - 100% autónomo, sin dependencias de red ni ficheros de audio externos.
- **Hook para Pistolas Lectoras Físicas USB / Bluetooth ([`src/hooks/use-barcode-scanner.ts`](file:///d:/Proyectos/NEGOVA/src/hooks/use-barcode-scanner.ts)):**
  - Detección de ráfagas rápidas de teclado (<40ms entre caracteres) emitidas por periféricos HID de código de barras.
  - Distinción entre escritura humana normal y escaneo de lector físico.
  - Disparo de callback `onScan(barcode)` con terminación en `Enter`.
- **Componente Modal de Escáner por Cámara ([`src/components/scanner/barcode-scanner-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/scanner/barcode-scanner-modal.tsx)):**
  - Renderizado mediante `ModalPortal` (`@/components/ui/modal-portal`) con backdrop blur y accesibilidad completa (`role="dialog"`, tecla Escape).
  - Integración de API estándar de detección de códigos de barras W3C (`window.BarcodeDetector`).
  - Visor con retícula animada, línea láser pulsante y feedback visual de código capturado.
  - Controles de alternancia de cámara (frontal / trasera) y linterna/flash (`torch`).
  - Entrada manual de respaldo para dispositivos sin cámara o digitación asistida.
- **Integración en POS ([`src/components/pos/pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx)):**
  - Escucha activa continua mediante `useBarcodeScanner` para periféricos conectados en caja.
  - Botón visible "Escanear" en la barra de herramientas del catálogo para abrir escaneo por cámara.
  - Adición inmediata al carrito con un clic/escaneo si el producto no tiene variantes.
  - Despliegue del modal de selección de variantes y modificadores si el producto requiere configuración previa.
  - Soporte de búsqueda en tiempo real por SKU, código de barras del producto y códigos de barras de variantes.
- **Integración en Catálogo y Formulario de Productos:**
  - [`product-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/product-form-modal.tsx): Botón "Escanear con cámara" junto al campo de código de barras para auto-llenado al crear o editar productos.
  - [`products-manager-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/products-manager-client.tsx): Botón de escaneo rápido y filtro reactivo por código de barras / SKU en la tabla del catálogo.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-cat-008-barcode-scanner.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-cat-008-barcode-scanner.test.ts) (**17/17 pruebas aprobadas al 100%**), cubriendo coincidencias exactas EAN-13, SKU, variantes, validación de formatos, integración en UI de POS y Catálogo, roles accesibles y cumplimiento estricto de cero alertas nativas.

---

### DS-002
**ID:** DS-002  
**Nombre:** Aplicar estados de carga/error/vacío consistentes  
**Fase:** 1 | **Módulo:** Diseño | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Auditoría e Integración Global en Módulos:**
  - Auditoría exhaustiva en rutas de workspace: `/dashboard`, `/productos` (catálogo y pestañas de inventario: existencias, ubicaciones, movimientos, stock bajo), `/gastos`, `/proveedores`, `/recetas` (recetas e ingredientes), `/cocina` (KDS) y `/clientes`.
  - Reemplazo de spinners ad-hoc o divs improvisados por componentes canónicos del Design System.
- **Evolución de Primitivas Canónicas ([`src/components/ui/`](file:///d:/Proyectos/NEGOVA/src/components/ui/)):**
  - [`data-table.tsx`](file:///d:/Proyectos/NEGOVA/src/components/ui/data-table.tsx):
    - Soporte integrado para `errorState?: ErrorStateProps` renderizando [`ErrorState`](file:///d:/Proyectos/NEGOVA/src/components/ui/error-state.tsx).
    - `TableSkeleton` automático cuando `isLoading = true`.
    - `EmptyState` automático y personalizable con acción primaria cuando no hay filas.
  - [`error-state.tsx`](file:///d:/Proyectos/NEGOVA/src/components/ui/error-state.tsx):
    - Accesibilidad mejorada con `role="alert"`.
    - Soporte para acción primaria de reintento (`onRetry`, `retryLabel`) y acción secundaria de navegación (`secondaryActionHref`, `secondaryActionLabel`).
  - [`error.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/error.tsx):
    - Rediseñado para utilizar el componente canónico [`ErrorState`](file:///d:/Proyectos/NEGOVA/src/components/ui/error-state.tsx) con soporte para reintento y navegación.
- **Estandarización y Documentación ([`DESIGN_SYSTEM.md`](file:///d:/Proyectos/NEGOVA/DESIGN_SYSTEM.md)):**
  - Formalizado en la Sección 11.3 como requisito para todos los módulos existentes y nuevos desarrollos: skeletons específicos durante transiciones asíncronas, empty states con llamado a la acción primaria, y error states con botón de reintento.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-ds-002-states.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-ds-002-states.test.tsx) (**16/16 pruebas aprobadas al 100%**), verificando skeletons (`TableSkeleton`, `CardSkeleton`, `KpiSkeleton`), `EmptyState`, `ErrorState`, `DataTable`, páginas y clientes de módulos, y cumplimiento estricto de cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`).

---

### DS-003
**ID:** DS-003  
**Nombre:** Optimizar responsive para módulos POS y Mesas  
**Fase:** 1 | **Módulo:** Diseño | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Módulo POS ([`src/components/pos/pos-screen-client.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/pos-screen-client.tsx)):**
  - **Cuadrícula Adaptativa de Catálogo:**
    - Implementación de grid dinámico fluido: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3.5`.
    - Garantiza 2 columnas nítidas en smartphones (<640px), 3 columnas en pantallas medianas, 4 columnas en tablets (768px-1024px) y equilibrio ergonómico en laptops y desktops junto al panel de venta.
  - **Herramientas y Búsqueda Táctil:**
    - Input de búsqueda táctil con `min-h-[42px]` y botón accesible de limpieza rápida `X`.
    - Botones de "Escanear" y "Solo disponibles" optimizados para toque táctil con `min-h-[42px]`.
    - Carrusel de píldoras de categorías con scroll horizontal suave (`overflow-x-auto no-scrollbar scroll-smooth`) y botones táctiles (`min-h-[38px]`).
  - **Tarjetas de Producto Táctiles:**
    - Botón de adición rápida `Plus` ampliado a `w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl` con feedback visual táctil (`active:scale-95`).
  - **Ticket de Venta / Carrito Adaptativo:**
    - Panel lateral fijo en desktop (`lg:` en adelante) con `w-[290px] xl:w-[330px] 2xl:w-[360px]`.
    - Barra inferior persistente en móviles (`lg:hidden fixed bottom-0 left-0 right-0 z-30`) con conteo de productos, total en COP, botón táctil de apertura y safe-area inset (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`).
    - Drawer táctil colapsable (`isMobileCartOpen`) para smartphones con controles de incremento/decremento y eliminación de ítems de toque ampliado (`min-w-[36px] min-h-[36px]`), y botón primario de venta de `min-h-[48px]`.
- **Módulo Mesas ([`src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx)):**
  - **Selector de Salas en Móviles:**
    - Remoción de la limitación `hidden md:flex`. Ahora el selector de salas cuenta con scroll horizontal suave accesible en cualquier pantalla (`flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 max-w-full`).
  - **Alternador de Vista Disponible en Móviles:**
    - Switcher `Plano Salón` vs `Lista Rápida` ahora disponible en pantallas móviles (`inline-flex` en vez de `hidden sm:inline-flex`), con etiquetas responsivas.
  - **Botonera Operativa Adaptativa para Mesas:**
    - En teléfonos móviles (`< sm`), los 4 botones de acción de mesa ocupada se disponen en una cuadrícula táctil 2x2 (`grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:justify-between sm:gap-2`), evitando textos truncados y garantizando área de toque cómoda (`min-h-[40px]`).
    - Botón de mesa libre para toma de comanda POS con área táctil cómoda (`min-h-[44px]`).
  - **Modo Lista Rápida Optimizado:**
    - Botones de acción (QR, Comanda, Cobrar, Trasladar, Liberar) con dimensiones mínimas táctiles de `min-h-[38px] min-w-[38px]`.
  - **Modales con Scroll Seguro en Viewports Compactos:**
    - Modales de creación de mesa, edición de mesa, traslado y QR actualizados con `max-h-[92vh] flex flex-col` y formularios con `overflow-y-auto` para evitar desbordamientos en pantallas pequeñas u orientación horizontal.
- **Modales Asociados:**
  - Optimización en [`modifier-selection-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/modifier-selection-modal.tsx), [`order-destination-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/pos/order-destination-modal.tsx) y [`order-payment-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/payments/order-payment-modal.tsx) con botones táctiles mínimos de 44px (`min-h-[44px]`), layouts reversibles responsivos (`flex-col-reverse sm:flex-row`) y soporte para `env(safe-area-inset-bottom)`.
- **Regla Estricta Global:**
  - Cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`, `Alert.alert`), utilizando diálogos modales canónicos y notificaciones con `sonner`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-ds-003-pos-tables-responsive.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-ds-003-pos-tables-responsive.test.ts) (**17/17 pruebas pasando al 100%**).

---

### MEN-001
**ID:** MEN-001  
**Nombre:** Añadir búsqueda de texto en menú QR público  
**Fase:** 1 | **Módulo:** Menú QR | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Input de Búsqueda Superior y Accesible:**
  - Input de búsqueda cliente-side integrado en la barra de navegación sticky superior de todas las plantillas del menú digital:
    - [`UrbanaMenuTemplate`](file:///d:/Proyectos/NEGOVA/src/components/menu/urbana-template.tsx)
    - [`ComercialMenuTemplate`](file:///d:/Proyectos/NEGOVA/src/components/menu/comercial-template.tsx)
    - [`EleganteMenuTemplate`](file:///d:/Proyectos/NEGOVA/src/components/menu/elegante-template.tsx)
    - [`VisualMenuTemplate`](file:///d:/Proyectos/NEGOVA/src/components/menu/visual-template.tsx)
  - Accesibilidad `aria-label="Buscar productos por nombre"`, icono `Search` interactivo y botón de limpieza rápida `X`.
  - Auto-conmutación a vista completa para buscar fluidamente a través de todo el catálogo al escribir.
- **Filtrado Cliente-Side Inteligente ([`src/lib/menu/category-grouping.ts`](file:///d:/Proyectos/NEGOVA/src/lib/menu/category-grouping.ts)):**
  - Función `filterMenuProducts` potenciada con normalización diacrítica de acentos/tildes y no distinción de mayúsculas/minúsculas (`"cafe"` encuentra `"Café Latte"`, `"limon"` encuentra `"Limonada"`, `"HAMBURGUESA"` encuentra `"Hamburguesa"`).
  - Coincidencia tanto por nombre de producto como por descripción de platillo.
  - Exclusión estricta de productos no autorizados para el canal (`available_in_qr = false`).
- **Estado Vacío Estandarizado:**
  - Despliegue del mensaje exacto requerido `"No encontramos productos con ese nombre"` cuando la búsqueda no arroja coincidencias.
  - Botón primario integrado de "Limpiar búsqueda" para restaurar inmediatamente la visualización completa del menú.
- **Regla Estricta Global:**
  - Cumplimiento estricto de cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`, `Alert.alert`).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-men-001-qr-menu-search.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-men-001-qr-menu-search.test.tsx) (**14/14 pruebas aprobadas al 100%**).

---

### MEN-002
**ID:** MEN-002  
**Nombre:** Completar validación de modificadores mínimos/máximos en UI  
**Fase:** 1 | **Módulo:** Menú QR | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Validación Canónica de Modificadores en Menú QR ([`src/components/menu/product-detail-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/menu/product-detail-modal.tsx)):**
  - Integración de las funciones de validación canónicas [`validateModifierGroupSelection`](file:///d:/Proyectos/NEGOVA/src/lib/pos/types.ts) y [`validateAllModifierGroups`](file:///d:/Proyectos/NEGOVA/src/lib/pos/types.ts).
  - Normalización de claves por identificador y nombre de grupo (`group.id || group.name`).
  - Validación en tiempo real del cumplimiento de mínimos requeridos (`min_select` y `required`) y límites máximos (`max_select`).
  - Soporte para grupos de selección única (`max_select === 1`) con comportamiento de radio button (reemplaza la opción anterior) y grupos de selección múltiple con control de cupo.
- **Feedback Visual y Alertas al Usuario:**
  - **Badges por grupo:** Distintivo dinámico `Obligatorio` (color ámbar) cuando el grupo requiere selección y no se ha alcanzado el mínimo, y `✓ Listo` (color esmeralda) una vez completado.
  - **Indicador de conteo:** Contador visual de selecciones actuales vs máximo permitido (`X / Y`).
  - **Alertas por grupo:** Despliegue de mensaje de error específico (`AlertCircle`) debajo del grupo que no cumpla las condiciones requeridas.
  - **Prevención de exceso:** Si el usuario intenta seleccionar más opciones de las permitidas en un grupo múltiple, el sistema lo indica inmediatamente mediante notificación visual de advertencia (`toast.warning`) y atenúa las opciones restantes (`opacity-60`).
- **Control del Botón de Acción ("+ Agregar al Pedido" / "Pedir por WhatsApp"):**
  - El botón `+ Agregar al Pedido` se deshabilita automáticamente (`disabled={!validation.isValid}`) con opacidad reducida (`disabled:opacity-50 disabled:cursor-not-allowed`) mientras existan grupos obligatorios pendientes o selecciones fuera de rango.
  - Despliegue de un banner informativo visible encima de la barra inferior con el mensaje de error correspondiente (`validation.error`).
  - El botón de pedido directo por WhatsApp también respeta la validación, impidiendo enviar pedidos con opciones obligatorias faltantes.
- **Regla Estricta Global:**
  - Cero alertas nativas (`window.alert`, `window.confirm`, `window.prompt`, `Alert.alert`), utilizando notificaciones de `sonner` y banners de UI.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-men-002-modifiers-validation.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-men-002-modifiers-validation.test.tsx) (**12/12 pruebas aprobadas al 100%**).

---

### RES-001
**ID:** RES-001  
**Nombre:** Implementar módulo de reservas  
**Fase:** 6 | **Módulo:** Reservas | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Datos y Migración Versionada ([`supabase/migrations/20261101180000_reservations_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261101180000_reservations_schema.sql)):**
  - Creación de tabla `public.reservations` con soporte para comensales (`party_size`), fecha (`date`), hora (`time`), sala (`room_id`), mesa (`table_id`), estados (`pending`, `confirmed`, `checked_in`, `seated`, `cancelled`, `no_show`, `completed`) y orígenes (`direct`, `phone`, `web`, `whatsapp`, `walk_in`).
  - Atributos extendidos: requerimientos especiales (`special_requests`), alergias (`allergies`), notas internas (`notes`), consumo mínimo sugerido (`min_spend`) y depósito o seña (`deposit_amount`).
  - Índices optimizados sobre `(business_id, date)`, `(business_id, status)`, `room_id`, y `table_id`.
  - Habilitación de Row Level Security (RLS) multi-tenant vinculada a `public.business_users`.
- **Capa de Dominio y Tipos Canónicos ([`src/lib/reservations/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/types.ts)):**
  - Definición de esquemas Zod `CreateReservationSchema` y `UpdateReservationSchema` con validación estricta de formato de fecha, hora y comensales mínimos.
  - Metadatos visuales normalizados: `RESERVATION_STATUS_META` (badges, colores por estado) y `RESERVATION_ORIGIN_META`.
- **Capa de Servicios y Lógica de Negocio ([`src/lib/reservations/reservations-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/reservations-service.ts)):**
  - Operaciones completas: `getReservations`, `getReservationById`, `createReservation`, `updateReservation`, `assignReservationTable`, `updateReservationStatus`, `deleteReservation`.
  - Motor de métricas e indicadores en tiempo real `getReservationMetrics`: cálculo de Reservas Hoy, Próximos 7 Días, Walk-ins, comensales totales y tasa de Ocupación (%) basada en mesas reservadas sobre la capacidad instalada.
- **Server Actions con Autorización Granular ([`src/app/workspace/[businessId]/reservas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/actions.ts)):**
  - `getReservationsAction`, `getReservationMetricsAction`, `createReservationAction`, `updateReservationAction`, `assignReservationTableAction`, `updateReservationStatusAction`, `deleteReservationAction`, `getRestaurantRoomsAndTablesAction` protegidas mediante `verifyWorkspaceAction` (`orders.view`, `tables.view`, `orders.create`, `tables.manage`, etc.) e invalidación de caché en `/reservas` y `/mesas`.
- **Interfaz de Usuario y Vistas Especializadas ([`src/app/workspace/[businessId]/reservas/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/)):**
  - **Página SSR:** [`page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/page.tsx) con verificación multi-tenant y carga inicial concurrente de reservas, métricas, salas y mesas.
  - **Dashboard Reactivo:** [`reservations-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/reservations-dashboard-client.tsx):
    - 4 tarjetas KPI superiores (Reservas Hoy, Próximos 7 Días, Walk-ins, Ocupación de Mesas con barra de progreso).
    - Barra de controles: selector interactivo de fecha con atajos día anterior/siguiente/hoy, buscador textual rápido por cliente/teléfono/notas, y filtros por sala y estado.
    - **Vista 1 — Calendario:** Cuadrícula mensual completa con conteo de reservas por día, distinción del día de hoy y panel lateral interactivo con las reservas del día seleccionado y acciones rápidas.
    - **Vista 2 — Lista:** Tabla estructurada con hora, cliente, teléfono, origen, número de comensales, ubicación (sala/mesa o botón de asignación), notas/alergias en badges de advertencia, estado y acciones de Check-in, Sentar, Editar y Cancelar.
    - **Vista 3 — Asignar Mesas:** Bandeja de reservas pendientes por asignar mesa y mapa de ocupación por salas con tarjetas visuales de mesas disponibles y ocupadas.
  - **Modal "Nueva / Editar Reserva":** [`reservation-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/reservation-form-modal.tsx) con pestañas de Info Básica, Detalles Operativos, Notas / Alergias y Facturación Opcional (depósito/consumo mínimo).
  - **Modal "Asignar Mesa":** [`assign-table-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/assign-table-modal.tsx) con filtrado por salas y selección de mesas activas.
  - **Modal de Confirmación:** Diálogo accesible `ConfirmModal` para cancelación segura de reservas. Cero alertas nativas.
- **Navegación del Workspace:**
  - Integrado en [`src/config/workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) con ruta directa `/reservas`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-res-001-reservations.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-res-001-reservations.test.ts) (**11/11 pruebas aprobadas al 100%**).


---

### RES-001
**ID:** RES-001  
**Nombre:** Implementar módulo de reservas  
**Fase:** 6 | **Módulo:** Reservas | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Migración de Base de Datos ([`20261101180000_reservations_schema.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261101180000_reservations_schema.sql)):**
  - Creación de tabla `public.reservations`:
    - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
    - `customer_name TEXT NOT NULL`, `phone TEXT`, `email TEXT`
    - `party_size INTEGER NOT NULL DEFAULT 2 CHECK (party_size > 0)`
    - `date DATE NOT NULL`, `time TIME NOT NULL`
    - `room_id UUID REFERENCES restaurant_rooms(id) ON DELETE SET NULL`
    - `table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL`
    - `status TEXT NOT NULL DEFAULT 'confirmed'` (`pending`, `confirmed`, `checked_in`, `seated`, `cancelled`, `no_show`, `completed`)
    - `origin TEXT NOT NULL DEFAULT 'direct'` (`direct`, `phone`, `web`, `whatsapp`, `walk_in`)
    - `special_requests TEXT`, `allergies TEXT`, `notes TEXT`
    - `min_spend NUMERIC(14,2) DEFAULT 0`, `deposit_amount NUMERIC(14,2) DEFAULT 0`
  - Índices optimizados por fecha, estado, sala y mesa.
  - Habilitación de Row Level Security (RLS) multi-tenant con políticas completas (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) vinculadas a `business_users`.
- **Servicio y Tipado TypeScript ([`src/lib/reservations/`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/)):**
  - [`types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/types.ts): Esquemas Zod [`CreateReservationSchema`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/types.ts) y [`UpdateReservationSchema`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/types.ts), tipos de metadatos de estado y orígenes.
  - [`reservations-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reservations/reservations-service.ts):
    - `getReservations`: Consulta con joins a salas y mesas con soporte para filtros de fecha, sala, estado y búsqueda.
    - `createReservation`: Creación con resolución automática de sala a partir de la mesa si aplica.
    - `updateReservation`: Modificación de campos y comensales.
    - `assignReservationTable`: Asignación rápida de mesas a reservas.
    - `updateReservationStatus`: Transiciones de estado (Check-in, Sentar, No Asistió, Cancelar).
    - `getReservationMetrics`: Cálculo de KPIs de Reservas Hoy, Próximos 7 Días, Walk-ins y Tasa de Ocupación proyectada.
- **Server Actions con RBAC ([`src/app/workspace/[businessId]/reservas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/actions.ts)):**
  - Verificación estricta de permisos de pedidos/mesas (`orders.view`, `orders.create`, `orders.update`, `orders.cancel`, `tables.manage`) mediante `verifyWorkspaceAction`.
  - Revalidación automática de rutas `/reservas` y `/mesas`.
- **Interfaz de Usuario y Vistas Especializadas ([`src/app/workspace/[businessId]/reservas/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/)):**
  - **4 Indicadores Principales (KPIs):**
    1. **Reservas Hoy:** Conteo del día, confirmadas y en check-in.
    2. **Próximos 7 Días:** Demanda semanal proyectada.
    3. **Walk-ins:** Clientes llegados sin reserva previa.
    4. **Ocupación:** Porcentaje de ocupación de salón y conteo de comensales.
  - **3 Vistas Operativas:**
    1. **Vista Calendario:** Cuadrícula mensual interactiva con días clicables, conteo visual de reservas y panel lateral diario con slots de tiempo.
    2. **Vista Lista:** Tabla completa con filtros por fecha, sala y estado, buscador en tiempo real y botones de acción rápida ("Check-in", "Sentar", "Asignar Mesa", "Editar").
    3. **Vista Asignar Mesas:** Bandeja de reservas pendientes de ubicar y cuadrícula de salas y mesas mostrando las asignaciones en salón.
  - **Modales del Design System:**
    - [`reservation-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/reservation-form-modal.tsx): 4 secciones estructuradas (1. Información básica, 2. Fecha y ubicación, 3. Notas y alergias, 4. Facturación opcional), presets de horas (12:00, 20:00, etc.) y comensales rápidos (2, 4, 6, 8, 10).
    - [`assign-table-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reservas/assign-table-modal.tsx): Asignación ergonómica por sala con identificación de mesas recomendadas por capacidad.
    - Integración de [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx) para cancelaciones seguras.
- **Navegación e Integración Cruzada:**
  - Módulo registrado en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) bajo `operacion` para negocios gastronómicos.
  - Indexado globalmente en [`workspace-command-palette.tsx`](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-command-palette.tsx).
  - Acceso directo añadido en el header del módulo de Mesas ([`tables-dashboard-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx)).
- **Regla Global:** Cero alertas nativas (`window.alert`, `window.confirm`, etc.).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-res-001-reservations.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-res-001-reservations.test.ts) (**8/8 pruebas aprobadas al 100%**).

---

### REP-007
**ID:** REP-007  
**Nombre:** Implementar reporte de domicilios  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Ruta Oficial:** `/workspace/[businessId]/reportes/domicilios`
- **Modelo de Dominio y Contratos TypeScript ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Definición de interfaces `DeliveryReportFilterParams`, `DeliveryDriverMetricItem`, `DeliveryZoneMetricItem`, `DeliveryReportOrderItem`, `DeliveryReportSummary` y `DeliveryReportData`.
- **Capa de Agregación y Métricas de Rendimiento ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Función `getDeliveryReportData(businessId, filterParams, businessTimezone)`:
    - **Criterio 1:** Conteo y montos vinculados a órdenes de domicilio de `restaurant_orders` (donde `order_type = 'delivery'` o `delivery_status` está presente), totalizando entregas exitosas, en tránsito, asignadas, pendientes y canceladas/rechazadas.
    - **Criterio 2:** Cálculo del tiempo promedio de entrega en minutos exactos (`Math.round(totalTimeMinutes / deliveredCount)`), midiendo la duración desde la aceptación/creación del pedido hasta la confirmación de entrega (`delivered_at`).
    - **Criterio 3:** Ranking de repartidores ordenados de mayor a menor (`b.completedDeliveries - a.completedDeliveries || b.totalAssigned - a.totalAssigned`) con tasa de efectividad, propinas acumuladas y calificación promedio.
    - **Criterio 4:** Agrupación y métricas por zona de cobertura con tolerancia total: si no hay zonas configuradas en `delivery_zones` (DOM-001 opcional), los pedidos se agrupan ordenadamente bajo "Sin Zona Asignada" sin errores de ejecución.
- **Motores de Exportación:**
  - **Excel / CSV ([`src/lib/reports/delivery-report-csv.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/delivery-report-csv.ts)):** Exportación estructurada en CSV con Byte Order Mark UTF-8 (`\uFEFF`) para visualización instantánea en Excel en español, incluyendo resumen ejecutivo de KPIs, ranking de repartidores, análisis de zonas y listado pormenorizado de órdenes con tiempos calculados.
  - **PDF ([`src/lib/reports/delivery-report-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/delivery-report-pdf.ts)):** Documento PDF en formato A4 apaisado con membrete corporativo, tarjetas de KPIs, tabla de repartidores ordenada descendentemente y tabla de zonas de entrega.
- **Server Actions con RBAC ([`src/app/workspace/[businessId]/reportes/domicilios/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/domicilios/actions.ts)):**
  - `getDeliveryReportAction`, `exportDeliveryReportPdfAction` y `exportDeliveryReportCsvAction` protegidas mediante `verifyWorkspaceAction(businessId, "reports.view")` (con fallback secundario a `"orders.view"`).
- **Interfaz de Usuario Interactiva ([`src/app/workspace/[businessId]/reportes/domicilios/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/domicilios/)):**
  - `page.tsx`: Carga SSR inicial con prefetching de métricas para visualización instantánea.
  - `delivery-report-client.tsx`:
    - 5 Tarjetas KPI: Total Entregas (y % de éxito), Tiempo Promedio de Entrega (en min), Facturación por Domicilio, Repartidor Estrella (más entregas) y Zona Principal (más demanda).
    - Barra de filtros reactiva: Selector de rango de fechas con presets ("Hoy", "Ayer", "7 Días", "Este Mes", "Personalizado"), filtro por repartidor, filtro por zona y filtro por estado.
    - 3 Pestañas de análisis: "Ranking por Repartidor", "Análisis por Zonas" y "Registro de Pedidos".
    - Botones de descarga directa en PDF y Excel con spinner y toasts de estado.
    - Componentes canónicos de UI (`EmptyState`, `Badge`, `Card`, etc.) sin alertas nativas.
- **Navegación:** Registrado en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) e indexado para búsqueda global.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-007-delivery-report.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-007-delivery-report.test.ts) (**10/10 pruebas aprobadas al 100%**).

---

### REP-006
**ID:** REP-006  
**Nombre:** Implementar análisis de horas pico  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Modelo de Dominio y Tipos Canónicos ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Interfaces `HeatmapCell`, `DayPeakHourSummary`, `PeakHoursGlobalSummary`, `PeakHoursFilterParams`, `PeakHoursMetricMode`, `PeakHoursReportData`.
- **Capa de Agregación y Lógica Analítica ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Implementación de `getPeakHoursReportData(businessId, filterParams, businessTimezone)`:
    - **Criterio 1:** Generación exacta de matriz de 7 días (Lunes a Domingo) × 18 franjas horarias (6:00 AM a 11:00 PM), totalizando 126 celdas con datos reales consolidados de `business_sale_documents` y canales de `restaurant_orders`.
    - **Criterio 2:** Cálculo dinámico de intensidades relativas (`countIntensity` y `amountIntensity`) del 0.0 al 1.0 respecto al pico máximo del período, identificando con precisión la celda líder (Pico Global).
    - **Criterio 3:** Detección de estados vacíos (`hasData = false`) cuando no existen ventas en el período o canal seleccionado.
    - **Criterio 4:** Agrupación y cálculo del resumen por día de la semana (`daySummaries`) identificando la hora pico de cada día, total de ventas, facturación y tasa de concentración porcentual.
- **Server Action Segura ([`src/app/workspace/[businessId]/reportes/horas-pico/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/horas-pico/actions.ts)):**
  - `getPeakHoursReportAction` autorizada mediante `verifyWorkspaceAction(businessId, "reports:read")` y `"reports.view"`.
- **Interfaz de Usuario y Mapa de Calor ([`src/app/workspace/[businessId]/reportes/horas-pico/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/horas-pico/)):**
  - `page.tsx`: Carga SSR con validación multi-tenant e hidratación inicial.
  - `peak-hours-client.tsx`:
    - 4 Tarjetas KPI: Hora Pico Global (día y hora), Día Más Concurrido, Volumen Total del Período y Promedio por Hora Activa.
    - Selector interactivo de modo: Toggle entre *# Ventas / Transacciones* y *Monto Facturado ($)*, adaptando la intensidad cromática y valores en tiempo real.
    - Barra de filtros: Presets de fecha (7 días, 30 días, este mes, 90 días, personalizado) y selector de canal (Todos, Mostrador, Salón/Mesa, Domicilios, Menú QR).
    - Mapa de calor reactivo (7 × 18): Cuadrícula optimizada para 1024px+ con scroll horizontal táctil para móviles, escala de gradiente térmico con acento de marca `#ED500A`, indicador pulsante en el pico global y tooltip detallado por celda (ventas, facturación, ticket promedio).
    - Tabla resumen de horas pico por día de la semana con resaltado del día líder y porcentajes de concentración horaria.
    - Estado vacío ilustrado (`EmptyState`) ante períodos sin ventas.
    - Regla de oro: Cero alertas nativas.
- **Navegación:**
  - Pestaña "Horas Pico" integrada en [`ReportNavTabs`](file:///d:/Proyectos/NEGOVA/src/components/reports/report-nav-tabs.tsx) y registrada en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-006-peak-hours.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-006-peak-hours.test.ts) (**7/7 pruebas aprobadas al 100%**).

---

### DOM-004
**ID:** DOM-004  
**Nombre:** Implementar seguimiento de pedido para cliente  
**Fase:** 7 | **Módulo:** Domicilios | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Ruta Pública:** `/seguimiento/[trackingCode]` (sin necesidad de autenticación).
- **Generación de Código:** Generación determinista de códigos `TRK-XXXXXX` al despachar/crear pedidos a domicilio en `delivery_orders`.
- **Vista Pública de Seguimiento ([`src/app/seguimiento/[trackingCode]/`](file:///d:/Proyectos/NEGOVA/src/app/seguimiento/[trackingCode]/)):**
  - Barra de progreso interactiva en tiempo real: Confirmado → Preparando → En camino → Entregado.
  - Actualización automática de estado sin recargar la página.
  - Privacidad estricta: No expone datos sensibles (PIN de entrega, datos privados del repartidor ni montos internos).
  - Enlace directo a WhatsApp para compartir con el cliente.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-dom-004-order-tracking.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dom-004-order-tracking.test.tsx) (**11/11 pruebas aprobadas al 100%**).

---

### REP-008
**ID:** REP-008  
**Nombre:** Implementar reporte de recetas y costos  
**Fase:** 8 | **Módulo:** Reportes | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Ruta Oficial:** `/workspace/[businessId]/reportes/recetas`
- **Modelo de Dominio y Contratos TypeScript ([`src/lib/reports/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/types.ts)):**
  - Interfaces `RecipeMarginStatus` (`"critical" | "warning" | "healthy"`), `RecipeProductCostItem`, `IngredientConsumptionItem`, `RecipeReportSummary`, `RecipeReportFilterParams`, `RecipeReportData`.
- **Capa de Costeo y Análisis Analítico ([`src/lib/reports/reports-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/reports-service.ts)):**
  - Implementación de `getRecipeReportData(businessId, filterParams, businessTimezone)`:
    - **Criterio 1:** El costo unitario de la receta coincide con la suma de $(\text{cantidad\_ingrediente} \times \text{costo\_ingrediente}) / \text{portions}$ para cada producto.
    - **Criterio 2:** El margen bruto se calcula como $(\text{precio\_venta} - \text{costo\_receta}) / \text{precio\_venta} \times 100$, y en monto como $\text{precio\_venta} - \text{costo\_receta}$.
    - **Criterio 3:** Los productos con margen $< 30\%$ se destacan visualmente con badge de advertencia (`warning`), y con margen negativo con badge de pérdida (`critical`). Los productos se ordenan por margen bruto ascendente (los menos rentables primero).
    - **Criterio 4:** El consumo del período se calcula multiplicando la cantidad del ingrediente en la receta dividida por sus porciones por las unidades vendidas en comandas (`restaurant_orders`) y documentos de venta (`business_sale_documents`).
    - **Criterio 5:** Proyección de ritmo diario de quema (`dailyBurnRate`) y días restantes hasta agotamiento (`currentStock / dailyBurnRate`), con ranking de ingredientes que se agotarán primero.
- **Motores de Exportación Institucional:**
  - **Excel / CSV ([`src/lib/reports/recipe-report-csv.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/recipe-report-csv.ts)):** Generación en CSV con BOM UTF-8 (`\uFEFF`), compatible con Microsoft Excel, incluyendo resumen ejecutivo de KPIs, tabla de escandallo de recetas y tabla de consumo de ingredientes.
  - **PDF ([`src/lib/reports/recipe-report-pdf.ts`](file:///d:/Proyectos/NEGOVA/src/lib/reports/recipe-report-pdf.ts)):** Generación formal en PDF A4 apaisado con membrete institucional del comercio, 4 tarjetas KPI, tabla de escandallos con resaltado de márgenes críticos y tabla de insumos con badges de agotamiento.
- **Server Actions Seguras ([`src/app/workspace/[businessId]/reportes/recetas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/recetas/actions.ts)):**
  - `getRecipeReportAction`, `exportRecipeReportPdfAction` y `exportRecipeReportCsvAction` autorizadas con RBAC multi-tenant (`reports:read` / `reports.view` / `recipes.view`).
- **Interfaz de Usuario Reactiva ([`src/app/workspace/[businessId]/reportes/recetas/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/reportes/recetas/)):**
  - `page.tsx`: Carga SSR con validación multi-tenant e hidratación inicial.
  - `recipe-report-client.tsx`:
    - 4 Tarjetas KPI: Recetas Activas, Margen Bruto Promedio (%), Alertas de Margen Crítico (< 30% / Pérdida) y Costo Total Consumido en el período.
    - Barra de filtros: Presets de fecha ("Hoy", "Ayer", "7 Días", "30 Días", "Este Mes", "Personalizado"), filtro por categoría de producto, selector de estado de margen (Todos, <30%, Negativo, Saludable) y buscador en tiempo real.
    - Pestaña 1: "Costos por Producto (Escandallos)" con alertas visuales de margen y badges de estado.
    - Pestaña 2: "Consumo de Ingredientes" con ranking de agotamiento rápido ($\le 7$ días) y detalle de ritmo diario.
    - Botones de exportación directa a PDF y Excel con feedback de carga.
    - Regla de oro: Cero alertas nativas del navegador.
- **Navegación:** Registrado en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) y en [`report-nav-tabs.tsx`](file:///d:/Proyectos/NEGOVA/src/components/reports/report-nav-tabs.tsx).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-rep-008-recipe-report.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-rep-008-recipe-report.test.ts) (**15/15 pruebas aprobadas al 100%**).


---

### CONF-001 - Configuración de Unidades y Conversiones (Fase 9, Módulo Config)

- **Estado:** Completada
- **Migración PostgreSQL:**
  - Archivo: [`supabase/migrations/20261101200000_measurement_units_and_conversions.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261101200000_measurement_units_and_conversions.sql)
  - Tabla `public.measurement_units` (`id`, `business_id`, `name`, `abbreviation`, `type`, `is_base`, `conversion_factor`, `base_unit_id`, `is_system`, timestamps).
  - Tipos soportados: `weight`, `volume`, `length`, `count`.
  - Unidades base iniciales: `kg` (1.0), `lt` (1.0), `m` (1.0), `un` (1.0) y derivadas de sistema `g` (0.001), `ml` (0.001), `cm` (0.01), `porc` (1.0).
  - Trigger `trg_business_created_seed_units` y función `seed_business_measurement_units(business_id)` para aprovisionamiento automático.
  - Políticas RLS por `business_id` para aislamiento multi-tenant.
- **Tipos y Capa de Dominio:**
  - [`src/lib/units/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/units/types.ts): Esquemas Zod `CreateMeasurementUnitSchema`, `UpdateMeasurementUnitSchema` e interfaces TypeScript.
  - [`src/lib/units/units-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/units/units-service.ts):
    - `seedDefaultMeasurementUnits(businessId)`: Inserción inicial garantizada.
    - `getMeasurementUnits(businessId, filterType)`: Consulta con auto-semilla y joins de unidad base.
    - `createMeasurementUnit(businessId, input)`: Creación de unidades personalizadas (ej. `lb` = 0.4536 kg).
    - `updateMeasurementUnit(businessId, unitId, input)`: Edición con bloqueo de factor en unidades base.
    - `checkUnitUsage(businessId, unitAbbreviation)`: Consulta de dependencias en `recipe_ingredients.unit` y `products.unit`.
    - `deleteMeasurementUnit(businessId, unitId)`: Validación preventiva contra eliminación de unidades de sistema, base o en uso.
    - `convertMeasurementQuantity(fromUnit, toUnit, quantity)`: Motor de conversión matemática con 6 decimales de precisión.
- **Server Actions:**
  - [`src/app/workspace/[businessId]/configuracion/unidades/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/unidades/actions.ts):
    - `getMeasurementUnitsAction`, `createMeasurementUnitAction`, `updateMeasurementUnitAction`, `deleteMeasurementUnitAction`, `checkUnitUsageAction`.
    - Protección con `verifyWorkspaceAction(businessId, "business_settings.view" / "business_settings.update")`.
    - Registro de auditoría non-blocking y revalidación de caché.
- **Interfaz de Usuario:**
  - Ruta oficial: [`src/app/workspace/[businessId]/configuracion/unidades/page.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/unidades/page.tsx).
  - Componente cliente: [`units-config-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/unidades/units-config-client.tsx):
    - 4 Tarjetas de resumen (Total Unidades, Unidades Base, Del Sistema, Personalizadas).
    - Pestañas por magnitud (Todas, Peso, Volumen, Longitud, Conteo).
    - Buscador reactivo por nombre o abreviación.
    - Tabla con etiquetas visuales de tipo, factor con fórmula (`1 lb → 0.4536 kg`), badges de estado y botones de acción.
    - Modal de confirmación de eliminación con diagnóstico de uso en tiempo real (Cero alertas nativas).
  - Modal de formulario: [`unit-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/unidades/unit-form-modal.tsx):
    - Selector interactivo de magnitud con iconos.
    - Selector de unidad base y factor con previsualización en vivo.
- **Integraciones:**
  - Módulo de configuración: Tarjeta de acceso directo en [`workspace-configuracion-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx).
  - Recetas e insumos: [`RecetasPage`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/page.tsx), [`IngredientFormModal`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/ingredient-form-modal.tsx) y [`RecipeFormModal`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/recetas/recipe-form-modal.tsx) consumen las unidades del comercio.
  - Catálogo de productos: Campo de unidad de medida integrado en [`product-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/productos/product-form-modal.tsx).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-conf-001-units.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-conf-001-units.test.ts) (**15/15 pruebas aprobadas al 100%**).

---

### CONF-002
**ID:** CONF-002  
**Nombre:** Completar configuración de impresión y estaciones  
**Fase:** 9 | **Módulo:** Config | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Ruta Oficial:** `/workspace/[businessId]/configuracion/impresion`
- **Modelo de Dominio y Contratos TypeScript ([`src/lib/printing/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/printing/types.ts)):**
  - Tipos: `PrinterType` (`thermal_80mm`, `thermal_58mm`, `sheet_letter`), `PrinterConnectionType` (`usb`, `network`, `bluetooth`), `PrintingArea` (`caja`, `cocina`, `barra`, `despacho`), `PrintDriverType` (`browser`, `qz_tray`).
  - Interfaces canónicas: `PrinterConfig`, `PrintingStation`, `TicketTemplateConfig`, `KitchenCommandTemplateConfig`, `CashDrawerConfig`, `PrintingSettings`.
- **Capa de Servicio y Persistencia Multi-tenant ([`src/lib/printing/printing-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/printing/printing-service.ts)):**
  - Persistencia segura en `businesses.settings.printing` con valores predeterminados y aislamiento por `business_id`.
  - Integración con la tabla `public.cash_registers` para poblar cajas activas disponibles.
  - Sincronización bidireccional de datos fiscales y logotipos con `business_document_configs`.
  - Generadores de datos simulados `getSampleTicketMock` y `getSampleKitchenCommandMock`.
- **Simulador Interactivo de Papel Térmico ([`src/components/printing/ticket-live-preview.tsx`](file:///d:/Proyectos/NEGOVA/src/components/printing/ticket-live-preview.tsx)):**
  - Renderizado fotorrealista de papel térmico (80 mm y 58 mm) con bordes rasgados y tipografía monoespaciada de alta legibilidad.
  - Conmutador en vivo entre **Ticket Comercial** y **Comanda de Cocina**.
  - **Criterio 2:** La plantilla de ticket muestra datos reales del comercio (nombre comercial, NIT, dirección, teléfono, pie de página, mensaje de agradecimiento).
  - **Criterio 3:** Actualización reactiva instantánea al subir o modificar el logotipo del negocio en el simulador.
  - **Criterio 4:** La comanda de cocina **no muestra precios** pero **sí resalta modificadores** (`[+]`, `[-]`, términos de cocción) y notas operativas.
- **Formularios Modales del Design System:**
  - [`printer-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/printing/printer-form-modal.tsx): Registro y edición de impresoras (nombre, tipo 80mm/58mm/carta, conexión USB/Red IP/Bluetooth, estado activa/inactiva).
  - [`station-form-modal.tsx`](file:///d:/Proyectos/NEGOVA/src/components/printing/station-form-modal.tsx): Creación y edición de estaciones de trabajo, **vinculando impresoras a cajas registradoras físicas** (`cash_registers`) o áreas de salón/cocina (**Criterio 1**), con automatizaciones de impresión y número de copias.
- **Cajón Monedero y Controlador de Impresión:**
  - Apertura automática al registrar cobros en efectivo con código de pulso ESC/POS configurable (`ESC p 0 25 250`).
  - Conexión a impresora asignada vía puerto RJ11 y botón de prueba de apertura de gaveta.
  - Selector de controlador: Nativo de navegador (`window.print()`, recomendado) con soporte de `QZ Tray` y fallback automático.
- **Server Actions con RBAC ([`src/app/workspace/[businessId]/configuracion/impresion/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/impresion/actions.ts)):**
  - `getPrintingSettingsAction`, `savePrintingSettingsAction`, `uploadPrinterLogoAction`, `testPrinterPulseAction` autorizadas mediante `verifyWorkspaceAction(businessId, "business_settings.view" / "business_settings.update")`.
- **Integración y Navegación:**
  - Registrado en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) e indexado para Command Palette (`Ctrl+K`).
  - Tarjeta de acceso directo en la pestaña de Comprobantes de [`workspace-configuracion-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx).
- **Regla Global:** Cero alertas nativas; uso exclusivo de [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx) y notificaciones toast de Sonner.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-conf-002-printing-stations.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-conf-002-printing-stations.test.ts) (**13/13 pruebas aprobadas al 100%**).

---

### CONF-003
**ID:** CONF-003  
**Nombre:** Implementar gestión de plantillas de notificación  
**Fase:** 9 | **Módulo:** Config | **Prioridad:** P2  
**Estado:** Completada  

**Alcance & Implementación:**
- **Ruta Oficial:** `/workspace/[businessId]/configuracion/notificaciones`
- **Modelo de Dominio y Contratos TypeScript ([`src/lib/notifications/types.ts`](file:///d:/Proyectos/NEGOVA/src/lib/notifications/types.ts)):**
  - Interfaces `NotificationEventId` (`qr_order_created`, `delivery_status_changed`, `low_stock_reached`, `cash_shift_closed`, `account_receivable_overdue`), `NotificationChannelType` (`whatsapp`, `email`, `push`), `NotificationChannelConfig`, `NotificationEventConfig`, `NotificationSettings` y `NOTIFICATION_AVAILABLE_ROLES`.
- **Capa de Servicios y Persistencia ([`src/lib/notifications/notification-settings-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/notifications/notification-settings-service.ts)):**
  - Plantillas predeterminadas profesionales para gastronomía y comercio en Colombia/Latinoamérica.
  - Función `renderTemplatePreview` para interpolación dinámica de variables (`{cliente}`, `{total}`, `{productos}`, `{orden}`, `{negocio}`, `{mesa}`, `{repartidor}`, etc.).
  - Funciones `getNotificationSettings`, `saveNotificationSettings` y `resetNotificationEventToDefault` con persistencia en `businesses.settings.notifications`.
- **Server Actions Seguras ([`src/app/workspace/[businessId]/configuracion/notificaciones/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/notificaciones/actions.ts)):**
  - `getNotificationSettingsAction`, `updateNotificationEventAction`, `saveAllNotificationSettingsAction`, `resetNotificationEventAction`.
  - Validación de roles y permisos multi-tenant (`business_settings.view` y `business_settings.update`).
  - Registro de auditoría con `logAuditAction` (`entityType: "notification_settings"`).
- **Interfaz de Usuario Reactiva ([`src/app/workspace/[businessId]/configuracion/notificaciones/`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/notificaciones/)):**
  - `page.tsx`: Carga SSR con validación multi-tenant e hidratación de datos.
  - `notifications-config-client.tsx`:
    - Filtro de eventos por categoría (Todos, Pedidos QR, Domicilios, Inventario, Caja, Cartera).
    - Tarjetas de eventos con toggle general de activación (activa/desactiva sin perder la configuración).
    - Editor de plantillas por canal (WhatsApp, Email con asunto, App Push).
    - Barra interactiva de inserción de variables: al hacer clic en una etiqueta (`{cliente}`, `{total}`, `{productos}`), se inserta exactamente en la posición del cursor en el área de texto.
    - Previsualización en tiempo real:
      - Burbuja realista de WhatsApp con metadatos y timestamp.
      - Tarjeta de correo electrónico con remitente y asunto.
      - Tarjeta de notificación en app / push.
    - Asignación de roles internos destinatarios (Propietario, Administrador, Cajero, Mesero, Cocina, Repartidor) y opción de notificar al cliente.
    - Modal de confirmación para restablecer plantillas con [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx).
    - **Regla Global:** Cero alertas nativas del navegador (`window.alert`, etc.).
- **Integración y Navegación:**
  - Registrado en [`workspace-navigation.ts`](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts) (`configuracion_notificaciones`).
  - Tarjeta de acceso rápido en [`workspace-configuracion-client.tsx`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx).
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-conf-003-notifications-templates.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-conf-003-notifications-templates.test.ts) (**11/11 pruebas aprobadas al 100%**).


















---

### SUB-002: Implementar widget de plan/límites en UI

- **Estado:** Completada
- **Fase:** 9 | **Módulo:** Suscripciones | **Prioridad:** P2
- **Alcance Desarrollado:**
  1. **Widget de Suscripción en Sidebar ([src/components/workspace/workspace-sidebar-subscription-widget.tsx](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-sidebar-subscription-widget.tsx)):**
     - Ubicado en la parte inferior del sidebar del workspace, con soporte colapsado y expandido.
     - Muestra el nombre del plan actual con badge distintivo (ej. "Plan Profesional", "Plan Inicio", "Plan Crece", "Plan Negocio").
     - Barras de progreso de uso para recursos clave:
       - **Productos:** "Productos: 45 / 500 (9%)".
       - **Empleados:** "Empleados: 8 / 15 (53%)".
     - Alerta visual en barra:
       - &lt; 80%: Color corporativo estándar.
       - &gt;= 80%: Color de advertencia amarillo / ámbar (`bg-amber-500`).
       - &gt;= 100%: Color rojo (`bg-rose-500`) con texto "Límite alcanzado".
     - Badge en la cabecera del widget con indicador "80%+ límite" o "Límite alcanzado".
     - Tooltips enriquecidos mediante atributos HTML `title` al hacer hover sobre cada barra, detallando ítems utilizados, límite total y cupo disponible restante.
     - Enlace directo "Mejorar plan" hacia la gestión de planes y suscripciones.
  2. **Integración en Shell y Layout ([src/components/workspace/workspace-shell.tsx](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-shell.tsx), [src/app/workspace/[businessId]/layout.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/layout.tsx)):**
     - Consulta en paralelo de empleados y colaboradores activos (`business_users`) transmitida reactivamente al Shell.
     - Redirección de actualización de suscripción a la sección de configuración del negocio.
  3. **Tabla Completa de Límites en Configuración ([src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx)):**
     - Sección "Tu plan y límites de uso" con la "Tabla de límites y uso actual".
     - Columnas: Recurso/Capacidad, Uso Actual, Límite, Consumo y Estado.
     - Filas con indicadores para:
       - Productos en catálogo.
       - Empleados y colaboradores.
       - Sucursales y sedes físicas.
     - Badges de estado dinámicos: `Límite alcanzado` (rojo), `80%+ límite` (ámbar), `Disponible` (verde esmeralda).
  4. **Política de Cero Alertas Nativas:**
     - 100% libre de `window.alert`, `window.confirm`, `window.prompt` y `Alert.alert`.
- **Pruebas Automatizadas:**
  - Suite unitaria [tests/unit/workspace-sub-002-subscription-widget.test.tsx](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-sub-002-subscription-widget.test.tsx) (**7/7 pruebas aprobadas al 100%**).
  - Suite de regresión previa [tests/unit/workspace-nav-003-subscription-widget.test.tsx](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-nav-003-subscription-widget.test.tsx) (**9/9 pruebas aprobadas al 100%**).

---

### SUB-001 - Límites de Plan en Servidor para Todos los Recursos (Fase 9, Módulo Suscripciones)

- **Estado:** Completada
- **Migración PostgreSQL:**
  - Archivo: [`supabase/migrations/20261101210000_plan_limits_and_subscription_enforcement.sql`](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261101210000_plan_limits_and_subscription_enforcement.sql).
  - Tabla `public.plan_limits` con los límites canónicos para: `products_limit`, `employees_limit`, `locations_limit`, `registers_limit`, `recipes_limit`, `sales_limit_per_month`, `customers_limit`.
  - Políticas RLS y semillas canónicas para `starter`/`inicio`, `professional`/`crece` y `enterprise`/`negocio`/`pro` (-1 para ilimitado).
- **Servicio Centralizado de Límites:**
  - Archivo: [`src/lib/subscriptions/plan-limits-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/subscriptions/plan-limits-service.ts).
  - Matriz canónica `PLAN_RESOURCE_LIMITS`:
    - **STARTER / INICIO:** `{ products: 50, employees: 3, locations: 1, registers: 1, recipes: 20, sales: 300, customers: 100 }`.
    - **PROFESSIONAL / CRECE:** `{ products: 500, employees: 15, locations: 3, registers: 5, recipes: 200, sales: 3000, customers: 1000 }`.
    - **ENTERPRISE / NEGOCIO:** `{ products: -1, employees: -1, locations: -1, registers: -1, recipes: -1, sales: -1, customers: -1 }`.
  - Normalización de planes (`normalizePlanCode`) soportando tanto terminología en inglés (`starter`, `professional`, `enterprise`) como en español (`inicio`, `crece`, `negocio`).
  - Funciones de control: `checkPlanLimit(businessId, resource)`, `assertPlanLimit(businessId, resource)`, `getResourceCurrentCount(businessId, resource)`, `getBusinessPlanOverview(businessId)`.
  - Formato estandarizado de respuesta de error:
    `"Has alcanzado el límite de {recurso} en tu plan ({planName}). Límite: {maxLimit}. Mejora tu plan para continuar."`.
- **Protección Server-Side en Todas las Entidades:**
  - **Empleados:** [`src/app/workspace/[businessId]/usuarios/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/usuarios/actions.ts) y [`src/lib/auth/users-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/auth/users-service.ts) bloquean el alta cuando ya se alcanzó la cuota de empleados (ej. empleado #4 en Starter).
  - **Ubicaciones / Sucursales:** [`src/lib/inventory/inventory-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/inventory/inventory-service.ts) `createLocation` valida con `assertPlanLimit(businessId, "locations")`.
  - **Cajas Registradoras:** [`src/lib/cash/cash-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/cash/cash-service.ts) `createCashRegister` valida con `assertPlanLimit(businessId, "registers")`.
  - **Recetas:** [`src/lib/recipes/recipe-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/recipes/recipe-service.ts) `createRecipe` valida con `assertPlanLimit(businessId, "recipes")`.
  - **Productos:** [`src/lib/products/products-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/products/products-service.ts) `checkProductPlanLimit` conectado con `checkPlanLimit(businessId, "products")`.
  - **Ventas / Documentos del Mes:** [`src/app/workspace/[businessId]/ventas/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/actions.ts) `createSaleAction` valida `checkPlanLimit(businessId, "sales")`.
  - **Clientes:** [`src/lib/customers/customers-service.ts`](file:///d:/Proyectos/NEGOVA/src/lib/customers/customers-service.ts) `createCustomer` valida `checkPlanLimit(businessId, "customers")`.
- **Pruebas Automatizadas:**
  - Suite unitaria [`tests/unit/workspace-sub-001-plan-limits.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-sub-001-plan-limits.test.ts) (**13/13 pruebas aprobadas al 100%**).

---

### NOM-001: Completar módulo de nómina y hacerlo accesible

- **Estado:** Completada
- **Fase:** 4 | **Módulo:** Nómina | **Prioridad:** P2
- **Alcance Desarrollado:**
  1. **Flujo de Aprobación de Períodos de Nómina ([src/lib/payroll/payroll-service.ts](file:///d:/Proyectos/NEGOVA/src/lib/payroll/payroll-service.ts)):**
     - Función `approvePayrollPeriod(periodId, actorUserId, context)`: valida la existencia del período, verifica que no esté pagado previamente y realiza la transición formal de estado de `"calculated"` a `"approved"`.
     - Auditoría automatizada con `logAuditAction` (`action: "payroll_period_approved"`).
     - Server Actions: `approveWorkspacePayrollPeriodAction` en [`src/app/workspace/[businessId]/personal/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/personal/actions.ts) y reexportada en [`src/app/workspace/[businessId]/nomina/actions.ts`](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/nomina/actions.ts), protegida por `verifyUserPermission("payroll.calculate", { businessId })`.
  2. **Integración Financiera con Módulo de Gastos (`expenses`):**
     - En `registerPayrollReceiptPayment`:
       - Al asentar el pago del comprobante de nómina, crea automáticamente el egreso con categoría oficial `"Nómina y Honorarios"` y `expense_type: "operational"`, con status `"completed"`, impidiendo duplicados.
       - Asocia `payment_method`, `receipt_number` y referencia de trazabilidad para consolidación en reportes financieros.
       - En caso de anulación del comprobante (`cancelPayrollReceipt`), cancela automáticamente el egreso financiero vinculado en Gastos (`status: "cancelled"`).
       - Cierre automático del período: cuando todos los comprobantes individuales de un período son pagados, el período transiciona automáticamente a estado `"paid"`.
  3. **Interfaz de Usuario y Experiencia en Nómina ([src/app/workspace/[businessId]/nomina/workspace-nomina-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/nomina/workspace-nomina-client.tsx)):**
     - Selector de período con badges dinámicos de estado: *Calculado (Pendiente Aprobación)* (ámbar), *Aprobado para Pago* (azul), *Pagado* (verde esmeralda).
     - Botón de acción **"Aprobar Período"** con modal de confirmación no bloqueante (`ConfirmModal`, `variant="default"`).
     - Modal de comprobante de pago con desglose pormenorizado: salario base, bonificaciones/horas extras, anticipos, deducciones y total neto pagado.
  4. **Política Estricta de Cero Alertas Nativas:**
     - 100% libre de `window.alert`, `window.confirm`, `window.prompt` y `Alert.alert`.
- **Pruebas Automatizadas:**
  - Suite unitaria dedicada [`tests/unit/workspace-nom-001-payroll.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-nom-001-payroll.test.ts) (**7/7 pruebas aprobadas al 100%**).
  - Suite de personal y nómina [`tests/unit/staff-payroll.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/staff-payroll.test.ts) (**7/7 pruebas aprobadas al 100%**).
  - Suite de página de nómina [`tests/unit/workspace-nomina-page.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-nomina-page.test.ts) (**8/8 pruebas aprobadas al 100%**).




---

### CONF-004: Implementar 2FA

- **Estado:** Completada
- **Fase:** 9 | **Módulo:** Config | **Prioridad:** P3
- **Alcance Desarrollado:**
  1. **Migración de Base de Datos ([supabase/migrations/20261101220000_two_factor_auth_and_recovery_codes.sql](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261101220000_two_factor_auth_and_recovery_codes.sql)):**
     - Añadidas columnas a `public.users`: `is_2fa_enabled` (boolean), `two_factor_factor_id` (text), `two_factor_verified_at` (timestamptz).
     - Creada tabla `public.user_mfa_recovery_codes` para códigos de respaldo de un solo uso con almacenamiento seguro en hash SHA-256 (`code_hash`), marca de consumo (`used_at`), índices optimizados y políticas RLS.
  2. **Motor Core 2FA & TOTP ([src/lib/auth/two-factor-service.ts](file:///d:/Proyectos/NEGOVA/src/lib/auth/two-factor-service.ts)):**
     - Implementación pura en TypeScript del estándar RFC 6238 / RFC 4226 (Base32 + HMAC-SHA1 + dynamic truncation) con ventana de tolerancia a desfase de reloj (+/- 30s).
     - Generación y hasheo SHA-256 de 8 códigos de respaldo legibles (`XXXX-XXXX`) sin caracteres confusos.
     - Consumo atómico de códigos de respaldo marcando `used_at = now()`.
     - Políticas de obligatoriedad a nivel de negocio (`businesses.settings.security.require_2fa_for_admins`).
  3. **Server Actions Seguras ([src/app/workspace/[businessId]/configuracion/seguridad/actions.ts](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/seguridad/actions.ts)):**
     - `getSecurityConfigAction`, `start2faEnrollmentAction`, `confirm2faEnrollmentAction`, `disable2faAction`, `regenerateRecoveryCodesAction`, `updateBusiness2faEnforcementAction`.
     - Validación estricta multi-tenant con `verifyWorkspaceAction` y registro de auditoría (`logAuditAction`).
  4. **Interfaz de Usuario Reactiva ([src/app/workspace/[businessId]/configuracion/seguridad/](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/seguridad/)):**
     - `page.tsx`: Carga SSR con hidratación de datos y verificación de permisos.
     - `security-config-client.tsx`:
       - Estado de 2FA del usuario con badges (`Activo y Protegido` o `Desactivado`).
       - Modal Wizard de Enrolamiento: Código QR de alta resolución, clave manual con copiado en un clic, 8 códigos de respaldo con copiado y descarga en `.txt`, input numérico de 6 dígitos.
       - Panel de Códigos de Respaldo con conteo de disponibles y regeneración.
       - Desactivación protegida mediante [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx).
       - Sección para propietarios/administradores: Toggle "Requerir 2FA para administradores".
       - Cero alertas nativas del navegador.
  5. **Integración con Flujo de Inicio de Sesión ([src/app/(auth)/actions.ts](file:///d:/Proyectos/NEGOVA/src/app/(auth)/actions.ts), [src/app/(auth)/login/page.tsx](file:///d:/Proyectos/NEGOVA/src/app/(auth)/login/page.tsx)):**
     - Exigencia automática de 2FA al iniciar sesión si el usuario lo tiene activo o si el negocio lo hace obligatorio para roles administrativos.
     - Entrada de código de 6 dígitos de Google Authenticator.
     - Alternativa "¿No tienes acceso a tu app? Usar respaldo" para validar y consumir códigos de recuperación de 8 caracteres.
  6. **Integración de Navegación ([src/config/workspace-navigation.ts](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts), [src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx)):**
     - Módulo registrado como `configuracion_seguridad` y tarjeta de acceso rápido en el panel de configuración general.
- **Pruebas Automatizadas:**
  - Suite unitaria [tests/unit/workspace-conf-004-two-factor-auth.test.ts](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-conf-004-two-factor-auth.test.ts) (**9/9 pruebas aprobadas al 100%**).

---

### CONF-005: Crear página de enlaces tipo Linktree

- **Estado:** Completada
- **Fase:** 9 | **Módulo:** Digital | **Prioridad:** P3
- **Alcance Desarrollado:**
  1. **Servicio Central de Enlaces ([src/lib/links/links-service.ts](file:///d:/Proyectos/NEGOVA/src/lib/links/links-service.ts), [src/lib/links/types.ts](file:///d:/Proyectos/NEGOVA/src/lib/links/types.ts)):**
     - Generación automática de 5 enlaces predeterminados listos para usar:
       - 1. **Ver menú:** `/menu/[slug]` (ícono `utensils`).
       - 2. **Pedir domicilio:** `/menu/[slug]?tab=delivery` (ícono `shopping-bag`).
       - 3. **WhatsApp:** enlace directo preformateado `https://wa.me/...` (ícono `message-circle`).
       - 4. **Instagram:** enlace de perfil social (ícono `instagram`).
       - 5. **Google Maps:** enlace de geolocalización de la sucursal (ícono `map-pin`).
     - Soporte para temas visuales preconfigurados: `slate`, `dark`, `emerald`, `indigo`, `rose`, `amber`, `gradient_sunset`, `gradient_ocean`.
     - Persistencia multi-tenant segura en `businesses.settings.links_page` con sincronización del campo `slug` del comercio.
     - Filtrado estricto en la entrega pública: omite enlaces inactivos (`isActive: false`) y ordena de forma ascendente según `order`.
  2. **Server Actions de Workspace ([src/app/workspace/[businessId]/configuracion/pagina-enlaces/actions.ts](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/pagina-enlaces/actions.ts)):**
     - `getBusinessLinksPageConfigAction`: consulta autorizada con permiso `business_settings.view`.
     - `saveBusinessLinksPageConfigAction`: validación de unicidad de slug, actualización de branding y enlaces con permiso `business_settings.update`, revalidación de rutas y registro de auditoría.
     - `resetPredefinedLinksAction`: restablece los 5 enlaces oficiales recomendados en un clic.
  3. **Panel de Configuración con Mockup en Tiempo Real ([src/app/workspace/[businessId]/configuracion/pagina-enlaces/](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/pagina-enlaces/)):**
     - `page.tsx`: SSR autenticado con carga inicial protegida.
     - `links-page-config-client.tsx`:
       - Edición de nombre comercial, slug personalizado, descripción/bio y logo.
       - Selector de paletas y temas visuales con previsualización en miniatura.
       - Gestor interactivo de enlaces: reordenar arriba/abajo, selector de ícono (11 variantes), toggle activo/oculto, edición de título y URL.
       - Mockup interactivo de smartphone que refleja en tiempo real los cambios estéticos y de enlaces.
       - Modales de confirmación accesibles con [`ConfirmModal`](file:///d:/Proyectos/NEGOVA/src/components/ui/confirm-modal.tsx) y notificaciones toast con `sonner`. Cero alertas nativas.
  4. **Página Pública Optimizada ([src/app/links/[slug]/page.tsx](file:///d:/Proyectos/NEGOVA/src/app/links/[slug]/page.tsx), [src/app/negocio/[slug]/page.tsx](file:///d:/Proyectos/NEGOVA/src/app/negocio/[slug]/page.tsx)):**
     - Rutas accesibles de forma pública tanto en `/links/[slug]` como en `/negocio/[slug]`.
     - Carga ultra ligera en menos de 50 ms (Server Component nativo de Next.js, sin bundles pesados de cliente).
     - Responsive con botones táctiles centrados, animaciones micro-interactivas al presionar y pie de página "Potenciado por NEGOVA".
     - El botón de menú digital navega directamente al menú QR del comercio (`/menu/[slug]`).
  5. **Integración con Navegación y Panel General ([src/config/workspace-navigation.ts](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts), [src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx)):**
     - Registrado como módulo `configuracion_pagina_enlaces` con tarjeta de acceso rápido "Página de Enlaces (Bio Links)" en la cabecera de configuración general.
- **Pruebas Automatizadas:**
  - Suite unitaria dedicada [tests/unit/workspace-conf-005-links-page.test.ts](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-conf-005-links-page.test.ts) (**11/11 pruebas aprobadas al 100%**).
  - Verificación de regresión en configuración (59/59 pruebas aprobadas al 100% en `CONF-001` a `CONF-005`).



---

### HELP-001: Implementar centro de ayuda en workspace

- **Estado:** Completada
- **Fase:** 9 | **Módulo:** Soporte | **Prioridad:** P3
- **Alcance Desarrollado:**
  1. **Catálogo Centralizado de Guías y Contenido ([src/config/workspace-help-content.ts](file:///d:/Proyectos/NEGOVA/src/config/workspace-help-content.ts)):**
     - Artículos cortos estructurados con pasos secuenciales, tiempo estimado de lectura, consejos clave (`tip`) y módulos asociados para:
       - **POS:** Cómo registrar ventas, elegir modificadores y cobrar en efectivo o mixto.
       - **Caja y Turnos:** Apertura de base, registro de ingresos/egresos y arqueo ciego de cierre de día.
       - **Catálogo y Productos:** Alta de productos, variantes, códigos de barras y alertas de stock mínimo.
       - **Mesas y Salón:** Apertura de comandas por sala, envío a cocina y traslados de mesa.
       - **Cocina (KDS):** Operación táctil en cocina con alertas de urgencia por colores (<10m, 10-20m, >20m).
       - **Domicilios:** Asignación de mensajeros, zonas y verificación con código PIN.
       - **Clientes y Cartera:** Límites de crédito, ventas a crédito y recibos de abono.
       - **Reportes:** Filtros de fechas, mapa de calor de horas pico y exportación Excel/PDF.
       - **Configuración:** Vinculación de impresoras térmicas (80mm/58mm) y activación de 2FA.
     - Sección de preguntas frecuentes (FAQs) con acordeón interactivo y categorización.
     - Videos tutoriales con embeds y transcripción.
     - Función `resolveHelpContextFromPath` para mapeo contextual automático desde cualquier URL del workspace.
  2. **Botón Flotante '?' Contextual ([src/components/workspace/workspace-help-floating-button.tsx](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-help-floating-button.tsx), [src/components/workspace/workspace-shell.tsx](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-shell.tsx)):**
     - Ubicado de forma fija en la esquina inferior derecha de todas las páginas del workspace.
     - Al estar en `/workspace/[businessId]/pos`, redirige directamente a `/workspace/[businessId]/ayuda?context=pos`.
     - Tooltip interactivo al hacer hover indicando el módulo activo.
     - Atajo de teclado global `?` (Shift+/) para abrir el centro de ayuda.
  3. **Formulario de Soporte y Server Action ([src/app/workspace/[businessId]/ayuda/actions.ts](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ayuda/actions.ts)):**
     - Server action `submitSupportTicketAction` con validación Zod.
     - Registro persistente en la tabla `public.support_tickets` de PostgreSQL con generación de ticket (`TICK-YYYYMMDD-XXXX`), asignación de prioridad, categoría y origen.
     - Envío de alerta al equipo de soporte vía Resend y registro de auditoría (`logAuditAction`).
  4. **Interfaz Reactiva ([src/app/workspace/[businessId]/ayuda/](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ayuda/)):**
     - `page.tsx`: Carga SSR con validación multi-tenant e hidratación de contexto.
     - `workspace-help-client.tsx`:
       - Buscador instantáneo por palabras clave en guías, FAQs y tutoriales.
       - Selector de módulos y vista detallada de instrucciones paso a paso.
       - Acordeón interactivo para FAQs con animaciones fluidas.
       - Modal para reproducción de videos tutoriales.
       - Formulario de soporte con confirmación visual del número de ticket y copiado rápido.
       - Enlace directo al chat de soporte de WhatsApp.
       - Cero alertas nativas del navegador (`window.alert`, etc.).
  5. **Integración con Navegación ([src/config/workspace-navigation.ts](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts)):**
     - Registrado como módulo `ayuda` accesible desde el menú principal del workspace y con acceso cruzado desde la vista de soporte.
- **Pruebas Automatizadas:**
  - Suite unitaria [tests/unit/workspace-help-001-help-center.test.tsx](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-help-001-help-center.test.tsx) (**9/9 pruebas aprobadas al 100%**).

---

### DIAN-001: Configurar facturación electrónica DIAN

- **Estado:** Completada
- **Fase:** 9 | **Módulo:** Facturación | **Prioridad:** P3
- **Alcance Desarrollado:**
  1. **Motor Normativo y Servicio Core DIAN ([src/lib/dian/dian-service.ts](file:///d:/Proyectos/NEGOVA/src/lib/dian/dian-service.ts), [src/lib/dian/types.ts](file:///d:/Proyectos/NEGOVA/src/lib/dian/types.ts)):**
     - Algoritmo oficial de Dígito de Verificación (DV) DIAN con factores primos y ponderación módulo 11.
     - Cálculo estricto del CUFE (Código Único de Factura Electrónica) mediante hash SHA-384 según especificación del Anexo Técnico DIAN.
     - Cálculo de CUDE (Código Único de Documento Electrónico) para Notas Crédito referenciando el CUFE de la factura original.
     - Generación de código QR y URL de validación pública hacia el catálogo DIAN (`catalogo-vpfe.dian.gov.co` y `catalogo-vpfe-hab.dian.gov.co`).
     - Almacenamiento seguro multi-inquilino de configuraciones en `businesses.settings.dian_billing` con fallback en memoria.
     - Emisión de facturas de prueba en sandbox / modo habilitación con incremento automático de consecutivos.
     - Emisión de Notas Crédito automáticas al anular ventas previamente autorizadas.
  2. **Server Actions de Workspace ([src/app/workspace/[businessId]/configuracion/facturacion-electronica/actions.ts](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/facturacion-electronica/actions.ts)):**
     - `getDianBillingConfigAction`: Lectura de configuración con verificación de permiso `business_settings.view`.
     - `saveDianBillingConfigAction`: Guardado seguro de datos de emisor, resolución y credenciales con `business_settings.update`.
     - `sendTestInvoiceToDianAction`: Envío de factura de habilitación y generación de CUFE de prueba.
     - `getElectronicDocumentsListAction`: Consulta de facturas y notas crédito emitidas con soporte de filtros.
  3. **Interfaz de Usuario y Gestión ([src/app/workspace/[businessId]/configuracion/facturacion-electronica/](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/facturacion-electronica/)):**
     - Componente interactivo `dian-config-client.tsx` con 4 pestañas especializadas:
       - **Datos del Emisor:** NIT, DV, Razón Social, Nombre Comercial, Dirección, Ciudad, Departamento, Régimen Tributario y Responsabilidad Fiscal (O-13, O-15, O-23, O-47, R-99-PN).
       - **Resolución DIAN:** Número de resolución, prefijo autorizado, rango (desde - hasta), consecutivo actual y fechas de vigencia.
       - **Conexión con Proveedor:** Selección de motor (`negova_dian`, `alegra`, `siigo`, `facturapi`), ambiente (test/producción), Software ID, PIN y TestSet ID.
       - **Historial de Documentos:** Listado en tiempo real de comprobantes electrónicos con insignias de estado, CUFE truncado con botón copiar y enlace al catálogo DIAN.
     - Modal de confirmación para emisión de prueba con resultado interactivo (`ConfirmModal`, cero alertas nativas).
  4. **Integración con Ventas y Punto de Venta ([src/app/workspace/[businessId]/ventas/actions.ts](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/actions.ts), [src/app/workspace/[businessId]/ventas/[id]/sale-detail-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/[id]/sale-detail-client.tsx), [src/app/workspace/[businessId]/ventas/sales-list-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/ventas/sales-list-client.tsx)):**
     - Al registrar una venta con `generateElectronicInvoice: true`, se emite automáticamente la factura electrónica, se genera el CUFE y se anexa al documento de venta.
     - Al anular una venta con factura electrónica, se emite inmediatamente la Nota Crédito correspondiente con CUDE referenciando el CUFE original.
     - Indicador visual `DIAN FEV` en el listado de ventas y banner con CUFE copiable y enlace al portal DIAN en el detalle de la venta.
  5. **Navegación del Workspace ([src/config/workspace-navigation.ts](file:///d:/Proyectos/NEGOVA/src/config/workspace-navigation.ts), [src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx](file:///d:/Proyectos/NEGOVA/src/app/workspace/[businessId]/configuracion/workspace-configuracion-client.tsx)):**
     - Registro del módulo `configuracion_facturacion_electronica` en el catálogo centralizado.
     - Tarjeta de acceso directo "Facturación DIAN" en el dashboard de configuración del workspace.
- **Pruebas Automatizadas:**
  - Suite unitaria [tests/unit/workspace-dian-001-electronic-billing.test.ts](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-dian-001-electronic-billing.test.ts) (**10/10 pruebas aprobadas al 100%**).


---

### TEST-002: Pruebas de aislamiento multiempresa

- **Estado:** Completada
- **Fase:** 10 | **Módulo:** Testing | **Prioridad:** P3
- **Alcance Desarrollado:**
  1. **Auditoría Exhaustiva de Seguridad Multi-Tenant ([docs/architecture/RLS_MULTI_TENANT_AUDIT.md](file:///d:/Proyectos/NEGOVA/docs/architecture/RLS_MULTI_TENANT_AUDIT.md)):**
     - Inventario completo de 57 tablas con columna `business_id`, confirmando habilitación de `ROW LEVEL SECURITY` (RLS) en el 100% de ellas.
     - Identificación y corrección de políticas permisivas heredadas que omitían la cláusula `TO service_role` en `public.business_sale_documents`, `public.customers`, `public.customer_addresses` y tablas accesorias.
     - Documentación del modelo de defensa en tres capas: PostgreSQL RLS Engine, Server Actions (`verifyWorkspaceAction`) y Superficie Pública Sanitizada.
  2. **Migración Versionada de Endurecimiento RLS ([supabase/migrations/20261102000000_rls_multi_tenant_hardening.sql](file:///d:/Proyectos/NEGOVA/supabase/migrations/20261102000000_rls_multi_tenant_hardening.sql)):**
     - Políticas restrictivas explícitas `TO service_role` para operaciones del sistema y trabajadores en segundo plano.
     - Políticas de aislamiento por tenant (`tenant_sale_documents_read`, `tenant_customers_read`, `tenant_customer_addresses_read`, `tenant_business_users_read`) para el rol `authenticated`, validadas contra la pertenencia activa en `public.business_users`.
     - Optimización de rendimiento RLS con `(SELECT auth.uid())` para prevenir re-evaluaciones por fila en planes de consulta PostgreSQL.
  3. **Estandarización de Códigos de Estado en Server Actions ([src/lib/auth/workspace-context.ts](file:///d:/Proyectos/NEGOVA/src/lib/auth/workspace-context.ts)):**
     - Normalización de respuestas en `verifyWorkspaceAction` devolviendo `statusCode` y `status`:
       - `401`: Petición no autenticada / sesión ausente o expirada.
       - `400`: `businessId` con formato UUID corrupto o inválido.
       - `404`: Negocio inexistente.
       - `403`: Usuario sin membresía activa en el negocio, o sin el permiso granular RBAC requerido.
       - `200`: Petición autorizada con contexto hidratado.
  4. **Suite Integral de Pruebas Automatizadas Multiempresa ([tests/integration/workspace-test-002-multitenant-isolation.test.ts](file:///d:/Proyectos/NEGOVA/tests/integration/workspace-test-002-multitenant-isolation.test.ts)):**
     - Setup con creación en vivo de 2 negocios aislados (Negocio A y Negocio B) y 2 usuarios autenticados con clientes Supabase independientes.
     - Verificación por tabla crítica:
       - `products`: Usuario A puede leer sus productos pero recibe 0 filas de Negocio B; inyección en Negocio B denegada por política `WITH CHECK`.
       - `categories`: Usuario A no puede ver ni modificar categorías de Negocio B.
       - `restaurant_orders`: Usuario A no puede ver pedidos de salón ni pedidos a domicilio de Negocio B.
       - `customers`: Cartera de clientes de Negocio B totalmente inaccesible para Usuario A.
       - `business_users`: Empleados y miembros de Negocio B inaccesibles para Usuario A.
       - `inventory_stock`: Niveles de stock y costos confidenciales de Negocio B inaccesibles para Usuario A.
       - `cash_sessions`: Turnos y saldos de caja de Negocio B inaccesibles para Usuario A.
       - `business_sale_documents`: Ventas aisladas estrictamente por pertenencia de negocio.
     - Verificación de Server Actions: comprobación de rechazo 401 sin sesión y 400 por UUID inválido.
     - Verificación de Rutas Públicas:
       - Menú QR de Negocio A sólo expone catálogo de Negocio A (cero contaminación de categorías o productos de Negocio B).
       - Seguimiento público de domicilios: validación estricta por código único `TRK-XXXXXX`, retorno `null` ante códigos alterados o inexistentes, y sanitización garantizada de PINs internos y notas de entrega.
- **Pruebas Automatizadas:**
  - Suite de integración [tests/integration/workspace-test-002-multitenant-isolation.test.ts](file:///d:/Proyectos/NEGOVA/tests/integration/workspace-test-002-multitenant-isolation.test.ts) (**15/15 pruebas aprobadas al 100%**).

---

### TEST-003: Pruebas de regresión de módulos existentes

- **Estado:** Completada
- **Fase:** 10 | **Módulo:** Testing | **Prioridad:** P3
- **Alcance Desarrollado:**
  1. **Menú QR Público ([src/components/menu/](file:///d:/Proyectos/NEGOVA/src/components/menu/)):**
     - Verificación del renderizado estático y dinámico de las 4 plantillas oficiales: `UrbanaMenuTemplate`, `ComercialMenuTemplate`, `EleganteMenuTemplate` y `VisualMenuTemplate`.
     - Preservación de la identidad visual, temas y estilos de cuadrícula/tarjetas sin degradación.
     - Funcionamiento del carrito de compras con modificadores y cálculo matemático de adicionales por unidad y subtotales.
     - Checkout y generación estructurada del enlace y mensaje de WhatsApp con datos de cliente, desglose de modificadores y formato monetario.
  2. **Gestión de Mesas y Salón ([src/lib/restaurant/](file:///d:/Proyectos/NEGOVA/src/lib/restaurant/)):**
     - Generación y verificación de tokens QR firmados criptográficamente (`generateTableQrToken`, `verifyTableQrToken`).
     - Revocación estricta de códigos QR al incrementar la versión, invalidando de inmediato códigos anteriores.
     - Aislamiento total: rechazo de tokens alterados, de otras mesas o de comercios ajenos.
     - Apertura y cálculo de hash de orden en mesa (`computeOrderPayloadHash`).
  3. **Productos y Categorías ([src/lib/products/](file:///d:/Proyectos/NEGOVA/src/lib/products/)):**
     - Validación con esquemas Zod (`CreateProductSchema`) con validación de precios no negativos y URLs de imagen.
     - Búsqueda en tiempo real cliente-side insensible a mayúsculas y tildes, con exclusión garantizada de productos no habilitados para QR.
     - Aplicación de cuotas operativas y límites de productos por plan (`PLAN_PRODUCT_LIMITS`: Inicio = 50, Crece = 200, Pro = Ilimitado).
  4. **Portal de Repartidor y Entrega Segura ([src/lib/delivery/](file:///d:/Proyectos/NEGOVA/src/lib/delivery/)):**
     - Generación y verificación de tokens criptográficos aleatorios en `base64url` con hashing SHA-256 para enlaces seguros de despacho.
     - Verificación con PIN de entrega de 4 dígitos (`[PIN:XXXX:attempts]`) y censura del código en las notas visibles para el repartidor.
     - Protección anti-brute-force: bloqueo irreversible tras 5 intentos fallidos (`isLocked = true`).
  5. **Roles y Permisos Granulares ([src/lib/auth/](file:///d:/Proyectos/NEGOVA/src/lib/auth/)):**
     - Catálogo canónico de permisos por módulo (`ALL_PERMISSION_MODULES`).
     - Overrides de permisos individuales: dos auxiliares del mismo negocio pueden tener conjuntos de permisos distintos (`grantedPermissions` y `revokedPermissions`).
     - Filtrado de seguridad: los auxiliares nunca pueden recibir permisos exclusivos de dueño (`business_settings.update`, `business_users.disable`).
     - Reflejo instantáneo de revocaciones y asignaciones en la consulta de permisos efectivos.
  6. **Integridad de Migraciones SQL y Script de Regresión ([package.json](file:///d:/Proyectos/NEGOVA/package.json)):**
     - Verificación de que el 100% de las migraciones SQL en `supabase/migrations/` utilizan sentencias idempotentes y no destructivas (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
     - Creación y estandarización del script `npm run test:regression`, ejecutando la suite completa de 60 pruebas de regresión.
- **Pruebas Automatizadas:**
  - Suite integral [tests/unit/workspace-test-003-regression.test.tsx](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-test-003-regression.test.tsx) (**25/25 pruebas aprobadas al 100%**).
  - Comando `npm run test:regression`: ejecuta 5 suites clave ([`workspace-test-003-regression.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-test-003-regression.test.tsx), [`workspace-men-001-qr-menu-search.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-men-001-qr-menu-search.test.tsx), [`table-qr-security.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/table-qr-security.test.ts), [`workspace-delivery-verification-pin.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-delivery-verification-pin.test.ts), [`individual-permissions.test.ts`](file:///d:/Proyectos/NEGOVA/tests/unit/individual-permissions.test.ts)), totalizando **60/60 pruebas aprobadas al 100%**.
