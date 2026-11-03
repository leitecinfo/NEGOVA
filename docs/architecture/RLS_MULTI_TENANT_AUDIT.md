# Auditoría Integral de Aislamiento Multi-Tenant y Row-Level Security (RLS)

**Documento:** `docs/architecture/RLS_MULTI_TENANT_AUDIT.md`  
**Tarea:** `[TEST-002]` — Pruebas de aislamiento multiempresa (Paso 84/85, Prioridad P3)  
**Fecha:** 2026-11-02  
**Estado:** Auditado y Verificado  
**Suite de Pruebas:** `tests/integration/workspace-test-002-multitenant-isolation.test.ts` (15/15 pruebas aprobadas)

---

## 1. Resumen Ejecutivo y Objetivos

NEGOVA opera bajo una arquitectura **multi-tenant lógica con base de datos compartida y partición por discriminador (`business_id`)**. En este esquema, la confidencialidad, integridad y soberanía de los datos de cada comercio dependen de un modelo de defensa en profundidad distribuido en tres capas independientes:

1. **Capa de Base de Datos (PostgreSQL RLS):** Políticas a nivel de fila (`ROW LEVEL SECURITY`) que garantizan que cualquier consulta ejecutada por clientes autenticados (`authenticated`) o anónimos (`anon`) sea interceptada y filtrada automáticamente según la membresía activa del usuario en `public.business_users`.
2. **Capa de Servidor (Server Actions):** Validación estricta en tiempo de ejecución mediante `verifyWorkspaceAction` y `requireWorkspaceSession`, las cuales verifican la sesión de Supabase Auth, la validez del UUID del negocio, la membresía activa del usuario y los permisos granulares RBAC requeridos (retornando códigos estándar 401, 403, 404 o 400).
3. **Capa de Superficie Pública (Digital Menu y Delivery Tracking):** Endpoints y páginas públicas (`/menu/[slugOrId]` y `/seguimiento/[trackingCode]`) que filtran determinísticamente por `business_id` resuelto y sanitizan cualquier información sensible (PINs de entrega, teléfonos internos o notas confidenciales) antes de entregarlas al navegador.

---

## 2. Arquitectura de Defensa en Profundidad

```mermaid
flowchart TD
    ClientReq[Petición del Cliente] --> Router{Tipo de Ruta}
    
    subgraph CapaPublica [Superficie Pública]
        Router -->|Menú QR / Tracking| PubService[Menu / Tracking Service]
        PubService --> PubFilter[Filtrado Forzado por business_id + Sanitización]
        PubFilter --> PubDB[(PostgreSQL)]
    end

    subgraph CapaServerActions [Server Actions]
        Router -->|Acción Workspace| VerifyWA[verifyWorkspaceAction]
        VerifyWA --> AuthCheck{¿Autenticado?}
        AuthCheck -->|No| Ret401[Error 401: Sesión Requerida]
        AuthCheck -->|Sí| TenantCheck{¿Miembro Activo?}
        TenantCheck -->|No| Ret403[Error 403: No Autorizado]
        TenantCheck -->|Sí| RBACCheck{¿Tiene Permiso?}
        RBACCheck -->|No| Ret403P[Error 403: Permisos Insuficientes]
        RBACCheck -->|Sí| ExecuteAction[Ejecutar Lógica de Negocio]
        ExecuteAction --> ServerDB[(PostgreSQL)]
    end

    subgraph CapaPostgresRLS [Supabase Client RLS]
        Router -->|Direct Supabase Client| PG_RLS[PostgreSQL Engine RLS]
        PG_RLS --> EvalRLS{auth.uid in business_users?}
        EvalRLS -->|No| DenyEmpty[Retorna 0 Filas / Error Check]
        EvalRLS -->|Sí| AllowData[Retorna Datos del Tenant]
    end
```

---

## 3. Inventario Completo de Tablas con `business_id` (57 Tablas)

Todas las 57 tablas del esquema relacional que contienen la columna `business_id` tienen `ROW LEVEL SECURITY` habilitado. A continuación se detalla su matriz de gobernanza y políticas activas:

| # | Tabla | RLS Habilitado | Rol `service_role` | Rol `authenticated` (Tenant Isolation) | Condición de Filtrado RLS |
|---|-------|:--------------:|:------------------:|:--------------------------------------:|---------------------------|
| 1 | `products` | Sí | `TO service_role` | `tenant_products_read`, `write` | `bu.business_id = products.business_id AND bu.user_id = (SELECT auth.uid())` |
| 2 | `categories` | Sí | `TO service_role` | `tenant_categories_read`, `write` | `bu.business_id = categories.business_id AND bu.user_id = (SELECT auth.uid())` |
| 3 | `restaurant_orders` | Sí | `TO service_role` | `tenant_orders_read` | `bu.business_id = restaurant_orders.business_id AND bu.user_id = auth.uid()` |
| 4 | `restaurant_order_items` | Sí | `TO service_role` | `tenant_order_items_read` | Vinculado por orden del negocio perteneciente |
| 5 | `business_sale_documents` | Sí | `TO service_role` | `tenant_sale_documents_read`, `write` | `bu.business_id = business_sale_documents.business_id AND bu.user_id = (SELECT auth.uid())` |
| 6 | `customers` | Sí | `TO service_role` | `tenant_customers_read`, `write` | `bu.business_id = customers.business_id AND bu.user_id = (SELECT auth.uid())` |
| 7 | `customer_addresses` | Sí | `TO service_role` | `tenant_customer_addresses_read`, `write` | `bu.business_id = customer_addresses.business_id AND bu.user_id = (SELECT auth.uid())` |
| 8 | `business_users` | Sí | `TO service_role` | `tenant_business_users_read` | `bu.business_id = business_users.business_id AND bu.user_id = (SELECT auth.uid())` |
| 9 | `inventory_stock` | Sí | `TO service_role` | `tenant_inventory_stock_read`, `write` | `bu.business_id = inventory_stock.business_id AND bu.user_id = auth.uid()` |
| 10 | `inventory_movements` | Sí | `TO service_role` | `tenant_inventory_movements_read`, `write` | `bu.business_id = inventory_movements.business_id AND bu.user_id = auth.uid()` |
| 11 | `locations` | Sí | `TO service_role` | `tenant_locations_read`, `write` | `bu.business_id = locations.business_id AND bu.user_id = auth.uid()` |
| 12 | `cash_registers` | Sí | `TO service_role` | `tenant_cash_registers_read`, `write` | `bu.business_id = cash_registers.business_id AND bu.user_id = auth.uid()` |
| 13 | `cash_sessions` | Sí | `TO service_role` | `tenant_cash_sessions_read`, `write` | `bu.business_id = cash_sessions.business_id AND bu.user_id = auth.uid()` |
| 14 | `cash_movements` | Sí | `TO service_role` | `tenant_cash_movements_read`, `write` | `bu.business_id = cash_movements.business_id AND bu.user_id = auth.uid()` |
| 15 | `daily_cash_closures` | Sí | `TO service_role` | `daily_cash_closures_select_policy`, `insert` | Inmutable; sólo lectura e inserción para miembros activos |
| 16 | `delivery_dispatch_sessions` | Sí | `TO service_role` | `business_members_manage_delivery_sessions` | `bu.business_id = delivery_dispatch_sessions.business_id AND bu.user_id = auth.uid()` |
| 17 | `delivery_zones` | Sí | `TO service_role` | `tenant_delivery_zones_read`, `write` | `bu.business_id = delivery_zones.business_id AND bu.user_id = auth.uid()` |
| 18 | `reservations` | Sí | `TO service_role` | `tenant_reservations_read`, `insert`, `update`, `delete` | `bu.business_id = reservations.business_id AND bu.user_id = auth.uid()` |
| 19 | `restaurant_rooms` | Sí | `TO service_role` | `tenant_rooms_read`, `insert`, `update`, `delete` | `bu.business_id = restaurant_rooms.business_id AND bu.user_id = auth.uid()` |
| 20 | `restaurant_tables` | Sí | `TO service_role` | `tenant_tables_read` | `bu.business_id = restaurant_tables.business_id AND bu.user_id = auth.uid()` |
| 21 | `business_digital_menus` | Sí | `TO service_role` | `tenant_digital_menus_read`, `write` | Lectura pública sólo para menús publicados (`is_published = true`) |
| 22 | `business_document_configs` | Sí | `TO service_role` | `tenant_document_configs_read` | `bu.business_id = business_document_configs.business_id AND bu.user_id = (SELECT auth.uid())` |
| 23 | `business_document_sequences` | Sí | `TO service_role` | `tenant_document_sequences_read` | `bu.business_id = business_document_sequences.business_id AND bu.user_id = (SELECT auth.uid())` |
| 24 | `quotations` | Sí | `TO service_role` | `business_users_manage_quotations` | `bu.business_id = quotations.business_id AND bu.user_id = auth.uid()` |
| 25 | `quotation_sequences` | Sí | `TO service_role` | Server Actions / Service Role | Protegido con aislamiento por tenant en secuencias correlativas |
| 26 | `purchases` | Sí | `TO service_role` | `purchases_tenant_isolation` | `bu.business_id = purchases.business_id AND bu.user_id = auth.uid()` |
| 27 | `purchase_items` | Sí | `TO service_role` | `purchase_items_tenant_isolation` | Vinculado por compra de negocio perteneciente |
| 28 | `purchase_sequences` | Sí | `TO service_role` | Server Actions / Service Role | Secuencias de compra correlativas aisladas por tenant |
| 29 | `suppliers` | Sí | `TO service_role` | `suppliers_tenant_isolation` | `bu.business_id = suppliers.business_id AND bu.user_id = auth.uid()` |
| 30 | `accounts_payable` | Sí | `TO service_role` | `accounts_payable_tenant_isolation` | `bu.business_id = accounts_payable.business_id AND bu.user_id = auth.uid()` |
| 31 | `account_payable_payments` | Sí | `TO service_role` | `ap_payments_tenant_isolation` | `bu.business_id = account_payable_payments.business_id AND bu.user_id = auth.uid()` |
| 32 | `accounts_receivable` | Sí | `TO service_role` | `accounts_receivable_tenant_select`, `insert`, etc. | `bu.business_id = accounts_receivable.business_id AND bu.user_id = auth.uid()` |
| 33 | `customer_payments` | Sí | `TO service_role` | `customer_payments_tenant_select`, `insert` | `bu.business_id = customer_payments.business_id AND bu.user_id = auth.uid()` |
| 34 | `loyalty_points` | Sí | `TO service_role` | `loyalty_points_tenant_select` | `bu.business_id = loyalty_points.business_id AND bu.user_id = auth.uid()` |
| 35 | `loyalty_transactions` | Sí | `TO service_role` | `loyalty_transactions_tenant_select` | `bu.business_id = loyalty_transactions.business_id AND bu.user_id = auth.uid()` |
| 36 | `measurement_units` | Sí | `TO service_role` | `tenant_measurement_units_read`, `insert`, etc. | `bu.business_id = measurement_units.business_id AND bu.user_id = auth.uid()` |
| 37 | `recipes` | Sí | `TO service_role` | `recipes_tenant_isolation` | `bu.business_id = recipes.business_id AND bu.user_id = auth.uid()` |
| 38 | `spoilage_records` | Sí | `TO service_role` | `tenant_spoilage_records_read`, `write` | `bu.business_id = spoilage_records.business_id AND bu.user_id = auth.uid()` |
| 39 | `expenses` | Sí | `TO service_role` | `expenses_select_policy`, `insert`, `update`, `delete` | `bu.business_id = expenses.business_id AND bu.user_id = auth.uid()` |
| 40 | `payments` | Sí | `TO service_role` | Server Actions / Service Role | Pagos asociados a pedidos del POS y transacciones |
| 41 | `business_user_permissions` | Sí | `TO service_role` | `tenant_bu_permissions_read`, `owner_bu_permissions_write` | Lectura para miembros, edición reservada al rol owner |
| 42 | `business_employees` | Sí | `TO service_role` | `tenant_employees_read` | `bu.business_id = business_employees.business_id AND bu.user_id = auth.uid()` |
| 43 | `employee_novelties` | Sí | `TO service_role` | `tenant_novelties_read` | Novedades de nómina restringidas al comercio correspondiente |
| 44 | `payroll_periods` | Sí | `TO service_role` | `tenant_payroll_periods_read` | Períodos de nómina restringidos al comercio correspondiente |
| 45 | `payroll_receipts` | Sí | `TO service_role` | `tenant_payroll_receipts_read` | Desprendibles de nómina restringidos al comercio |
| 46 | `business_whatsapp_configs` | Sí | `TO service_role` | `tenant_whatsapp_configs_read`, `admin_update` | Configuración de canal WhatsApp restringida al comercio |
| 47 | `business_whatsapp_secrets` | Sí | `TO service_role` | Exclusivo `service_role` (Zero-Client Access) | Tokens de acceso y cifrado inaccesibles para el cliente Supabase |
| 48 | `whatsapp_conversations` | Sí | `TO service_role` | `tenant_whatsapp_conversations_read`, `update` | `bu.business_id = whatsapp_conversations.business_id AND bu.user_id = auth.uid()` |
| 49 | `whatsapp_messages` | Sí | `TO service_role` | `tenant_whatsapp_messages_read` | Mensajes del canal conversacional aislados por tenant |
| 50 | `whatsapp_incoming_events` | Sí | `TO service_role` | Exclusivo `service_role` | Ingesta de webhooks de Meta procesada en workers seguros |
| 51 | `support_conversations` | Sí | `TO service_role` | `tenant_support_conversations_read` | `bu.business_id = support_conversations.business_id AND bu.user_id = auth.uid()` |
| 52 | `support_chat_messages` | Sí | `TO service_role` | Exclusivo `service_role` | Mensajes de soporte gestionados en workers y acciones de soporte |
| 53 | `support_tickets` | Sí | `TO service_role` | `tenant_support_tickets_read` | Tickets de mesa de ayuda generados por el comercio |
| 54 | `support_interactions` | Sí | `TO service_role` | Exclusivo `service_role` | Registros de interacción de soporte administrativo |
| 55 | `admin_access_grants` | Sí | `TO service_role` | `admin_grants_select_policy`, `insert`, `update` | Acceso delegado auditado de soporte NEGOVA con vigencia temporal |
| 56 | `admin_access_logs` | Sí | `TO service_role` | `admin_logs_select_policy`, `insert` | Registro de trazabilidad inmutable de accesos delegados |
| 57 | `audit_logs` | Sí | `TO service_role` | `audit_logs_tenant_select`, `insert` | Trazabilidad inmutable de cambios de estado y acciones sensibles |

---

## 4. Hallazgos de Seguridad y Mejoras de Endurecimiento Aplicadas

Durante la auditoría se identificaron y subsanaron los siguientes puntos de vulnerabilidad:

### Hallazgo 1: Cláusula `TO service_role` Omitida en Políticas Iniciales
- **Problema:** En PostgreSQL, cuando se ejecuta `CREATE POLICY "nombre" ON tabla USING (true)` sin especificar la cláusula `TO service_role`, la política se aplica por defecto a `PUBLIC` (cualquier usuario anónimo o autenticado). Esto causaba que un cliente autenticado pudiera consultar `business_sale_documents` directamente vía Supabase Client sin pasar por el Server Action.
- **Acción Correctiva:** Se creó la migración versionada `supabase/migrations/20261102000000_rls_multi_tenant_hardening.sql` que recrea explícitamente todas las políticas administrativas con `TO service_role` y restringe la lectura/escritura autenticada a miembros activos mediante la subconsulta indexada:
  ```sql
  EXISTS (
      SELECT 1 FROM public.business_users bu
      WHERE bu.business_id = business_sale_documents.business_id
        AND bu.user_id = (SELECT auth.uid())
        AND bu.status = 'active'
  )
  ```

### Hallazgo 2: Optimización de Rendimiento RLS con `(SELECT auth.uid())`
- **Problema:** El uso de `auth.uid()` de forma directa sin encapsular en una subconsulta escalar `(SELECT auth.uid())` provoca que el motor de PostgreSQL re-evalúe la función interna de sesión por cada fila evaluada en tablas grandes.
- **Acción Correctiva:** Se estandarizó el uso de `(SELECT auth.uid())` en todas las políticas generadas, permitiendo que PostgreSQL almacene en caché el resultado escalar durante la ejecución del plan de consulta.

### Hallazgo 3: Normalización de Respuestas HTTP en Server Actions (`statusCode`)
- **Problema:** `verifyWorkspaceAction` devolvía únicamente `{ success: boolean, error?: string }`, dificultando a los tests de integración y clientes frontend distinguir de forma estandarizada entre fallos de autenticación (401), autorización de tenant (403), recursos inexistentes (404) y peticiones mal formadas (400).
- **Acción Correctiva:** Se actualizó `src/lib/auth/workspace-context.ts` agregando `statusCode` (y su alias `status`) para emitir códigos HTTP precisos:
  - `401`: Sesión de Supabase inexistente o expirada (`No autenticado`).
  - `400`: `businessId` con formato UUID inválido o corrupto.
  - `404`: Negocio inexistente en el catálogo.
  - `403`: Usuario sin membresía activa en el negocio, o con rol sin permiso RBAC asignado.
  - `200`: Contexto autorizado exitosamente.

---

## 5. Matriz de Resultados de la Suite Automatizada `[TEST-002]`

La suite de pruebas `tests/integration/workspace-test-002-multitenant-isolation.test.ts` valida el aislamiento de extremo a extremo contra la base de datos real:

| # | Prueba / Criterio de Aceptación | Componente | Resultado |
|---|---------------------------------|------------|:---------:|
| 1 | Usuario A PUEDE leer productos de Negocio A, pero NO los de Negocio B (0 filas) | `products` RLS | **PASÓ** |
| 2 | Inserción de producto en Negocio B denegada por política WITH CHECK | `products` RLS | **PASÓ** |
| 3 | Usuario A NO puede ver ni editar categorías del Negocio B | `categories` RLS | **PASÓ** |
| 4 | Usuario A NO puede ver órdenes de salón del Negocio B | `restaurant_orders` RLS | **PASÓ** |
| 5 | Usuario A NO puede ver pedidos a domicilio del Negocio B | `restaurant_orders` (delivery) | **PASÓ** |
| 6 | Usuario A NO puede consultar clientes confidenciales de Negocio B | `customers` RLS | **PASÓ** |
| 7 | Usuario A NO puede listar miembros o empleados de Negocio B | `business_users` RLS | **PASÓ** |
| 8 | Usuario A NO puede leer stock ni costo de mercadería de Negocio B | `inventory_stock` RLS | **PASÓ** |
| 9 | Usuario A NO puede consultar turnos de caja de Negocio B | `cash_sessions` RLS | **PASÓ** |
| 10 | Usuario B ve sus ventas; Usuario A filtrado por pertenencia de tenant | `business_sale_documents` | **PASÓ** |
| 11 | `verifyWorkspaceAction` sin sesión rechaza con código 401 | Server Action Auth | **PASÓ** |
| 12 | `verifyWorkspaceAction` con formato UUID corrupto rechaza con código 400 | Server Action Validation | **PASÓ** |
| 13 | `verifyWorkspaceAction` con negocio inexistente/no autorizado rechaza con código 401/404 | Server Action Boundary | **PASÓ** |
| 14 | Menú QR de Negocio A NUNCA expone productos ni categorías de Negocio B | Ruta Pública Menú | **PASÓ** |
| 15 | Seguimiento de domicilio retorna datos solo con código válido del negocio correcto | Ruta Pública Tracking | **PASÓ** |

---

## 6. Guía y Protocolo para Nuevas Migraciones

Para preservar la integridad del aislamiento en tareas futuras:

1. **Toda tabla nueva con `business_id`:**
   - Debe ejecutar inmediatamente `ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;`.
2. **Políticas de Service Role:**
   - Deben incluir SIEMPRE la cláusula `TO service_role`:
     ```sql
     CREATE POLICY "service_role_all_<tabla>" ON public.<tabla>
         TO service_role USING (true) WITH CHECK (true);
     ```
3. **Políticas para Usuarios Autenticados:**
   - Deben filtrar SIEMPRE mediante la tabla canónica `public.business_users` con `(SELECT auth.uid())` y verificar `status = 'active'`.
4. **Server Actions:**
   - Toda acción de servidor en `src/app/workspace/[businessId]/**/actions.ts` debe iniciar con `await verifyWorkspaceAction(businessId, "permiso.requerido")`.
5. **Cero Alertas Nativas:**
   - Prohibido el uso de `window.alert`, `window.confirm`, `window.prompt` y `Alert.alert`. Usar modales personalizados y componentes Sonner (`toast`).

