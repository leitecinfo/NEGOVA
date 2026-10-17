# Plan de Implementación — Vertical Restaurante de Comida Rápida
**NEGOVA Platform — Hoja de Ruta de Desarrollo con Arquitectura Multivertical**  
**Fecha:** Octubre 2026 | **Versión:** 3.0.0 (Frontera Limpia Core vs Verticales) | **Estado:** Aprobado (Listo para ejecución)

---

## 1. Principio Rector y Desacoplamiento de Verticales

> **REGLA ARQUITECTÓNICA FUNDAMENTAL:**
> - **NEGOVA Core** provee capacidades comunes para cualquier negocio (tenancy, ventas oficiales BSD, productos genéricos, categorías, gastos de negocio y pagos).
> - **Vertical Restaurante** añade la operativa gastronómica especializada (mesas, comandas de cocina y despacho de delivery) **sin contaminar el Core con columnas exclusivas de comida rápida**.
> - **Ventas y Comprobantes:** NO se crea un segundo sistema de ventas; se utiliza `/workspace/[businessId]/ventas` y `public.business_sale_documents`.
> - **Estado actual:** Las tablas genéricas (`categories`, `products`, `expenses`, `payments`) y las tablas del vertical (`restaurant_tables`, `restaurant_orders`, `restaurant_order_items`) están diseñadas conceptualmente pero **aún no están desplegadas en `supabase/migrations/` ni en `src/`**. La Fase 1 las crea formalmente con esta frontera limpia.

---

## 2. Fases de Implementación Secuenciales

---

### FASE 1: Migración SQL Oficial (Core Genérico + Vertical Restaurante)

* **Objetivo:** Desplegar en Supabase la migración oficial estableciendo la separación limpia entre las entidades genéricas del Core y las entidades satélite del vertical Restaurante.
* **Módulos involucrados:** Infraestructura de Base de Datos y Tipos TypeScript.
* **Dependencias:** Tablas Core existentes en `supabase/migrations/` (`businesses`, `users`, `business_users`, `business_sale_documents`, `business_document_sequences`).
* **Componentes a reutilizar:** `@/lib/supabase/server`, `@/lib/auth/workspace-context`.
* **Componentes a modificar:** Ninguno.
* **Componentes nuevos:** Tipos de dominio en `src/lib/restaurant/types.ts` y tipos de catálogo en `src/lib/products/types.ts`.
* **Cambios de Base de Datos:**
  - Migración SQL `core_and_restaurant_schema.sql`:
    1. **Entidades Genéricas del Core (Extensibles a cualquier comercio):**
       - `public.categories` (id, business_id, name, description, sort_order, status).
       - `public.products` (id, business_id, category_id, name, description, image_url, price, status, is_available, sort_order, metadata JSONB).
       - `public.expenses` (id, business_id, concept, amount, category, description, expense_date, status, created_by).
       - `public.payments` (id, business_id, reference_type, reference_id, amount, payment_method, status, reference, paid_at).
    2. **Entidades Específicas del Vertical Restaurante (Confinadas a gastronomía):**
       - `public.restaurant_tables` (id, business_id, name_or_number, capacity, status, current_order_id).
       - `public.restaurant_orders` (id, business_id, order_number, status, order_type, channel_origin, subtotal, delivery_fee, total, notes, table_id, customer_name, customer_phone, delivery_address, delivery_reference, delivery_status, driver_name, payment_status).
       - `public.restaurant_order_items` (id, business_id, order_id, product_id, product_name, quantity, unit_price, subtotal, notes, modifiers JSONB).
    3. Políticas RLS con aislamiento estricto por `business_id` en todas las tablas.
* **Cambios de Backend:** Esquemas Zod para validación de comandas, mesas y egresos.
* **Cambios de Frontend:** Ninguno (fase de infraestructura).
* **Seguridad:** Aislamiento multi-tenant validado por RLS en PostgreSQL.
* **Criterios de Aceptación:**
  - Migración ejecutada sin errores de llaves foráneas.
  - Tipos TypeScript sincronizados con compilación limpia (`npx tsc --noEmit`).

#### Tareas de la Fase 1:
- [x] **Tarea 1.1 [Completada]:** Redactar y revisar la migración `core_and_restaurant_schema.sql` con separación estricta Core vs Vertical.
- [x] **Tarea 1.2 [Completada]:** Configurar políticas RLS para todas las nuevas tablas vinculadas a `business_id`.
- [x] **Tarea 1.3 [Completada]:** Crear las interfaces TypeScript en `src/lib/restaurant/types.ts`.
- [x] **Tarea 1.4 [Completada]:** Definir esquemas Zod de validación.

---

### FASE 2: Catálogo de Productos (Core) y Disponibilidad Inmediata

* **Objetivo:** Construir la gestión de la carta del restaurante sobre las tablas genéricas `public.categories` y `public.products`, permitiendo administrar platos, precios, modificadores y el switch de disponibilidad en 1 segundo.
* **Módulos involucrados:** Productos / Menú (`/workspace/[businessId]/productos`).
* **Dependencias:** Fase 1 completada.
* **Componentes a reutilizar:** Subida de imágenes a Supabase Storage, tabla genérica `public.products`.
* **Componentes a modificar:** `workspace-shell.tsx` (activar enlace a Productos).
* **Componentes nuevos:**
  - Servicio `src/lib/restaurant/menu-service.ts`.
  - Página `src/app/workspace/[businessId]/productos/page.tsx`.
  - Clientes `products-manager-client.tsx`, `product-form-modal.tsx`, `category-manager-modal.tsx`.
* **Cambios de Base de Datos:** Ninguno.
* **Cambios de Backend:** Server Actions para CRUD de productos y acción de toggle atómico de disponibilidad (`toggleProductAvailabilityAction`).
* **Cambios de Frontend:**
  - Grilla de platos con filtros por categoría.
  - Switch interactivo de disponibilidad inmediata con badge verde ("Disponible") / rojo ("Agotado").
  - Formulario modal con configuración de adicionales y modificadores en `metadata JSONB`.
* **Seguridad:** Requiere permisos `products.view`, `products.create`, `products.update`.
* **Criterios de Aceptación:**
  - El usuario puede crear, editar y archivar platos.
  - El switch de disponibilidad actualiza el producto al instante sin recarga completa de página.

#### Tareas de la Fase 2:
- [x] **Tarea 2.1 [Completada]:** Implementar `products-service.ts` con consultas sobre `public.categories` y `public.products`.
- [x] **Tarea 2.2 [Completada]:** Construir la vista de listado de productos con filtros de categoría y buscador.
- [x] **Tarea 2.3 [Completada]:** Desarrollar el modal de creación y edición de platos con soporte para adicionales y modificadores.
- [x] **Tarea 2.4 [Completada]:** Desarrollar el gestor de categorías (crear, archivar).
- [x] **Tarea 2.5 [Completada]:** Implementar el botón/switch de toggle de disponibilidad inmediata.

---

### FASE 3: Módulo de Mesas (Vertical Restaurante)

* **Objetivo:** Desarrollar la administración del salón y mesas del restaurante sobre `public.restaurant_tables`, permitiendo configurar mesas y visualizar su estado operacional en tiempo real.
* **Módulos involucrados:** Mesas (`/workspace/[businessId]/mesas`).
* **Dependencias:** Fase 1 completada.
* **Componentes a reutilizar:** Modales base, paleta de colores de NEGOVA.
* **Componentes a modificar:** `workspace-shell.tsx` (agregar enlace a Mesas).
* **Componentes nuevos:**
  - Servicio `src/lib/restaurant/tables-service.ts`.
  - Página `src/app/workspace/[businessId]/mesas/page.tsx`.
  - Clientes `tables-board-client.tsx`, `table-form-modal.tsx`.
* **Cambios de Base de Datos:** Ninguno (tabla `restaurant_tables` creada en Fase 1).
* **Cambios de Backend:** Server Actions para crear, editar, inactivar y cambiar estados de mesas.
* **Cambios de Frontend:**
  - Tablero estilo cuadrícula con código de colores según ocupación:
    - Verde: Disponible
    - Azul: Ocupada con comanda en curso
    - Ámbar: Pedido en preparación en cocina
    - Naranja: Cuenta pendiente de pago
* **Seguridad:** Requiere permisos `orders.view` y `orders.update`.
* **Criterios de Aceptación:**
  - Creación y edición ágil de mesas con nombres libres ("Mesa 1", "Barra", "Terraza").
  - Las tarjetas reflejan el estado del pedido asociado y permiten saltar a la comanda con un clic.

#### Tareas de la Fase 3:
- [ ] **Tarea 3.1 [Pendiente]:** Implementar `tables-service.ts` con operaciones CRUD sobre `public.restaurant_tables`.
- [ ] **Tarea 3.2 [Pendiente]:** Construir la vista de tablero de mesas con cuadrícula responsive y modales de configuración.
- [ ] **Tarea 3.3 [Pendiente]:** Desarrollar la lógica de ocupación y liberación automática de mesas vinculada a pedidos.

---

### FASE 4: Motor de Pedidos y Cola Central (Vertical Restaurante)

* **Objetivo:** Construir el centro operativo de la cocina: toma rápida de comandas multicanal (Mostrador, WhatsApp manual, Menú digital), canalización a la cola única y ciclo de preparación en cocina sobre `public.restaurant_orders`.
* **Módulos involucrados:** Pedidos (`/workspace/[businessId]/pedidos`).
* **Dependencias:** Fases 1, 2 y 3 completadas.
* **Componentes a reutilizar:** Catálogo de productos (Fase 2), mesas (Fase 3).
* **Componentes a modificar:** `workspace-shell.tsx` (agregar enlace a Pedidos).
* **Componentes nuevos:**
  - Servicio `src/lib/restaurant/orders-service.ts`.
  - Páginas `pedidos/page.tsx`, `pedidos/nuevo/page.tsx`, `pedidos/[id]/page.tsx`.
  - Clientes `orders-queue-client.tsx`, `order-creator-client.tsx`, `order-detail-modal.tsx`.
* **Cambios de Base de Datos:** Ninguno (tablas `public.restaurant_orders` y `restaurant_order_items` aseguradas en Fase 1).
* **Cambios de Backend:** Server Actions para creación de comanda con consecutivo diario, congelamiento de modificaciones en `restaurant_order_items` y avance de estados (`advanceOrderStatusAction`).
* **Cambios de Frontend:**
  - Cola central con columnas de estado: `Recibido`, `En preparación`, `Listo`, `Entregado`.
  - Tarjetas de comanda con cronómetro de tiempo transcurrido, canal de origen, mesa o datos de delivery y detalle de modificadores ("sin cebolla").
  - Formulario de alta velocidad para toma de pedidos táctil en móvil o tablet.
* **Seguridad:** Requiere permisos `orders.view`, `orders.create`, `orders.update`, `orders.cancel`.
* **Criterios de Aceptación:**
  - Todo pedido ingresado aparece de inmediato en la cola única.
  - Al avanzar el estado del pedido, la mesa asociada actualiza su estado.
  - Cancelación permitida con motivo obligatorio sin borrar registros.

#### Tareas de la Fase 4:
- [ ] **Tarea 4.1 [Pendiente]:** Implementar `orders-service.ts` con transacciones seguras para `restaurant_orders` y `restaurant_order_items`.
- [ ] **Tarea 4.2 [Pendiente]:** Construir el formulario de toma rápida de pedidos (selección de platos, adiciones, notas y tipo de entrega).
- [ ] **Tarea 4.3 [Pendiente]:** Construir la interfaz de la Cola Central de Pedidos (vista operativa para cocina y mostrador).
- [ ] **Tarea 4.4 [Pendiente]:** Implementar transiciones de estado de comanda de un solo clic.
- [ ] **Tarea 4.5 [Pendiente]:** Vincular la comanda presencial con la ocupación automática de mesas.

---

### FASE 5: Monitor de Delivery (Vertical Restaurante)

* **Objetivo:** Desarrollar la vista operativa de despacho de domicilios, permitiendo supervisar entregas activas, repartidores asignados y el cobro del flete, alimentada directamente de `public.restaurant_orders`.
* **Módulos involucrados:** Delivery (`/workspace/[businessId]/delivery`).
* **Dependencias:** Fases 1 y 4 completadas.
* **Componentes a reutilizar:** Consultas de `public.restaurant_orders` filtrando por `order_type = 'delivery'`.
* **Componentes a modificar:** `workspace-shell.tsx` (agregar enlace a Delivery).
* **Componentes nuevos:**
  - Servicio `src/lib/restaurant/delivery-service.ts` (consultas sobre `restaurant_orders`).
  - Página `src/app/workspace/[businessId]/delivery/page.tsx`.
  - Cliente `delivery-tracker-client.tsx`.
* **Cambios de Base de Datos:** Ninguno (campos de delivery confinados en `public.restaurant_orders`).
* **Cambios de Backend:** Acciones para asignar repartidor y actualizar estado de entrega (`pending`, `out_for_delivery`, `delivered`).
* **Cambios de Frontend:**
  - Tablero de envíos en curso con dirección textual, punto de referencia y teléfono del cliente.
  - Visualización desglosada: Subtotal Comida vs Tarifa Domicilio.
  - Indicador de estado del cobro del flete (pagado por adelantado vs cobro contraentrega).
* **Seguridad:** Requiere permisos `orders.view` y `orders.update`.
* **Criterios de Aceptación:**
  - Permite asignar repartidor y despachar el pedido marcándolo como `En camino`.
  - El valor del domicilio se mantiene visible y separado del subtotal de alimentos.

#### Tareas de la Fase 5:
- [ ] **Tarea 5.1 [Pendiente]:** Implementar `delivery-service.ts` con consultas optimizadas sobre pedidos tipo delivery.
- [ ] **Tarea 5.2 [Pendiente]:** Construir la interfaz del monitor de delivery con detalle de direcciones textuales y teléfonos.
- [ ] **Tarea 5.3 [Pendiente]:** Implementar cambio de estado de despacho y liquidación de repartidor.

---

### FASE 6: Cobro, Liquidación y Emisión de Comprobantes BSD (Core)

* **Objetivo:** Conectar el flujo de pedidos del restaurante con el sistema de Ventas del Core de NEGOVA: cobro de la comanda, registro de abonos en `public.payments`, calculadora de cambio en vivo y emisión del comprobante oficial mediante `createBusinessSaleDocument`.
* **Módulos involucrados:** Ventas (`/workspace/[businessId]/ventas`), Pedidos, Documentos Core.
* **Dependencias:** Fase 4 completada, `@/lib/documents/document-service.ts` existente.
* **Componentes a reutilizar:**
  - Módulo completo de Ventas en `/workspace/[businessId]/ventas`.
  - Motor de comprobantes `createBusinessSaleDocument`.
  - Motor de PDF `@/lib/pdf/pdf-engine.ts`.
  - Identidad de marca de `public.business_document_configs`.
  - Tabla de comprobantes `public.business_sale_documents`.
* **Componentes a modificar:**
  - Integrar el modal de cobro y calculadora de cambio en la finalización de comandas.
* **Componentes nuevos:**
  - Componente modal interactivo `checkout-modal-with-change-calculator.tsx`.
  - Acción `settleOrderAndCreateSaleDocumentAction`.
* **Cambios de Base de Datos:** Ninguno (el documento BSD soporta `items JSONB` y notas).
* **Cambios de Backend:** Transacción que finaliza la comanda, registra cobros en `public.payments`, libera la mesa asociada y emite el documento de venta oficial en `public.business_sale_documents`.
* **Cambios de Frontend:**
  - Modal de cobro con desglose (Alimentos + Domicilio = Total).
  - Calculadora de cambio interactiva (ingreso de billetes recibidos y cálculo de la devuelta).
  - Selector de método de pago: Efectivo, Transferencia móvil (con comprobante) o Pago Mixto.
  - Botón de emisión e impresión/descarga directa de comprobante PDF oficial.
* **Seguridad:** Requiere permisos `sales.create`, `sales.view`.
* **Criterios de Aceptación:**
  - Al cobrar un pedido se genera un comprobante oficial con correlativo secuencial garantizado.
  - La calculadora de cambio opera de inmediato sin alertas nativas.
  - La mesa vinculada se libera automáticamente tras registrarse la venta.

#### Tareas de la Fase 6:
- [ ] **Tarea 6.1 [Pendiente]:** Desarrollar la acción `settleOrderAndCreateSaleDocumentAction` que vincula la comanda con `createBusinessSaleDocument`.
- [ ] **Tarea 6.2 [Pendiente]:** Construir el componente modal de liquidación con Calculadora de Cambio en tiempo real.
- [ ] **Tarea 6.3 [Pendiente]:** Validar que el comprobante de venta registre de forma transparente los ítems de comida y el flete de domicilio.
- [ ] **Tarea 6.4 [Pendiente]:** Asegurar la liberación automática de mesas tras la confirmación de la venta.

---

### FASE 7: Finanzas del Comercio y Gastos (Core `expenses`)

* **Objetivo:** Habilitar el control del flujo de caja del restaurante: registro de egresos diarios en la tabla genérica `public.expenses` y arqueo de caja de la jornada.
* **Módulos involucrados:** Finanzas (`/workspace/[businessId]/finanzas`).
* **Dependencias:** Fases 1 y 6 completadas.
* **Componentes a reutilizar:** Tabla `public.expenses`, selectores de fechas, ventas registradas en BSD.
* **Componentes a modificar:** `workspace-shell.tsx` (agregar enlace a Finanzas).
* **Componentes nuevos:**
  - Servicio `src/lib/restaurant/finance-service.ts`.
  - Página `src/app/workspace/[businessId]/finanzas/page.tsx`.
  - Clientes `restaurant-finance-client.tsx`, `expense-modal.tsx`, `cash-register-closure-modal.tsx`.
* **Cambios de Base de Datos:** Ninguno (tabla `public.expenses` creada en Fase 1).
* **Cambios de Backend:** Server Actions para registrar egresos en `public.expenses` y calcular el arqueo de efectivo (Efectivo Ventas - Gastos en Efectivo = Saldo esperado).
* **Cambios de Frontend:**
  - Tarjetas de resumen financiero (Ventas del día, Efectivo recaudado, Transferencias, Egresos pagados, Saldo en caja).
  - Modal para registro rápido de gastos clasificados (compra de verduras, panes, carnes, gas, jornales).
  - Herramienta de arqueo y cierre de caja al finalizar el turno o la noche.
* **Seguridad:** Requiere permisos `expenses.view`, `expenses.create`, `reports.view`.
* **Criterios de Aceptación:**
  - Los gastos se guardan en `public.expenses` vinculados al `business_id`.
  - El arqueo de caja cuadra con exactitud matemática el efectivo físico frente a las ventas y gastos registrados.

#### Tareas de la Fase 7:
- [ ] **Tarea 7.1 [Pendiente]:** Implementar `finance-service.ts` para gestión de gastos sobre `public.expenses` y consolidación de ventas.
- [ ] **Tarea 7.2 [Pendiente]:** Construir la vista de Finanzas del restaurante con tarjetas de flujo de caja y tabla de egresos.
- [ ] **Tarea 7.3 [Pendiente]:** Desarrollar el modal de registro rápido de gastos de cocina e insumos.
- [ ] **Tarea 7.4 [Pendiente]:** Desarrollar el modal de Arqueo y Cierre de Caja diario.

---

### FASE 8: Menú Digital Público (`/m/[slug]`) y Acceso QR (Vertical)

* **Objetivo:** Publicar la carta digital interactiva del restaurante para que los comensales consulten productos desde sus teléfonos móviles mediante código QR o enlace en redes sociales.
* **Módulos involucrados:** Menú Digital (`/workspace/[businessId]/menu-digital`) y Ruta Pública (`/m/[slug]`).
* **Dependencias:** Fases 1 y 2 completadas.
* **Componentes a reutilizar:** `public.business_document_configs` (colores de marca y logotipo), tabla `public.products`.
* **Componentes a modificar:** `workspace-shell.tsx` (agregar enlace a Menú Digital).
* **Componentes nuevos:**
  - Ruta pública `src/app/m/[slug]/page.tsx` y cliente `public-menu-client.tsx`.
  - Panel administrativo `src/app/workspace/[businessId]/menu-digital/page.tsx`.
  - Generador vectorial/PNG de códigos QR con branding.
* **Cambios de Base de Datos:** Ninguno.
* **Cambios de Backend:** Query pública cacheada para obtener categorías y productos disponibles (`is_available = true`).
* **Cambios de Frontend:**
  - Vista cliente mobile-first ultra liviana con categorías táctiles y fotos.
  - Panel en Workspace para descargar fichas con código QR listas para imprimir y colocar en mesas o mostrador.
* **Seguridad:** La ruta `/m/[slug]` es pública de solo lectura.
* **Criterios de Aceptación:**
  - El menú digital carga de forma instantánea en teléfonos móviles.
  - Los platos marcados como "Agotados" se inhabilitan en tiempo real.
  - El código QR escaneable redirige exactamente a la URL del restaurante.

#### Tareas de la Fase 8:
- [ ] **Tarea 8.1 [Pendiente]:** Desarrollar la ruta pública `/m/[slug]` optimizada para navegación táctil sin autenticación.
- [ ] **Tarea 8.2 [Pendiente]:** Construir el visor de categorías y platos con fotos y precios.
- [ ] **Tarea 8.3 [Pendiente]:** Implementar el panel de Menú Digital en Workspace con generador y descarga de códigos QR.

---

### FASE 9: Dashboard Operativo del Restaurante y Calculadora

* **Objetivo:** Transformar la vista de inicio del Workspace (`/workspace/[businessId]`) en el panel de control en vivo del restaurante e integrar la Calculadora General en el aside.
* **Módulos involucrados:** Principal / Dashboard y Herramientas / Calculadora.
* **Dependencias:** Fases 2 a 7 completadas.
* **Componentes a reutilizar:** Estructura de `src/app/workspace/[businessId]/page.tsx`.
* **Componentes a modificar:** `page.tsx` y `workspace-shell.tsx`.
* **Componentes nuevos:**
  - Servicio `restaurant-dashboard-service.ts`.
  - Ruta y cliente de Calculadora en `src/app/workspace/[businessId]/calculadora/page.tsx`.
  - Componentes `restaurant-live-metrics.tsx`, `orders-status-overview.tsx`.
* **Cambios de Base de Datos:** Ninguno.
* **Cambios de Backend:** Consulta agregada para resumir en una sola llamada: ventas del día, pedidos en cola, ocupación de mesas y efectivo en caja.
* **Cambios de Frontend:**
  - Dashboard del restaurante con KPIs de la jornada y accesos directos ("Nuevo Pedido", "Ver Mesas", "Cierre de Caja").
  - Calculadora interactiva digital en el aside con soporte táctil y teclado numérico físico.
* **Seguridad:** Requiere permiso `sales.view`.
* **Criterios de Aceptación:**
  - El dashboard refleja con exactitud la actividad de la jornada.
  - La calculadora general permite operaciones matemáticas fluidas sin recargar la página.

#### Tareas de la Fase 9:
- [ ] **Tarea 9.1 [Pendiente]:** Implementar `restaurant-dashboard-service.ts` para consolidación de métricas de la jornada.
- [ ] **Tarea 9.2 [Pendiente]:** Rediseñar el Dashboard de inicio para mostrar la operación del restaurante en tiempo real.
- [ ] **Tarea 9.3 [Pendiente]:** Construir la página y componente interactivo de la Calculadora General en el aside.

---

### FASE 10: Usuarios, Roles en Workspace y Pruebas End-to-End

* **Objetivo:** Configurar la gestión de colaboradores del local sobre `public.business_users`, auditar la matriz de roles y ejecutar las pruebas de integración del ciclo operativo completo.
* **Módulos involucrados:** Gestión (Usuarios, Roles y Permisos), Control (Notificaciones) y Suite de Pruebas.
* **Dependencias:** Fases 1 a 9 completadas.
* **Componentes a reutilizar:**
  - Membresías de `public.business_users`.
  - Servicio de notificaciones `platform_notifications`.
  - Componente de perfil de usuario.
* **Componentes a modificar:** `workspace-shell.tsx` (permisos condicionales en el aside).
* **Componentes nuevos:**
  - Vista de colaboradores del restaurante en `/workspace/[businessId]/usuarios`.
  - Suite de pruebas de integración en `tests/integration/restaurant-lifecycle.test.ts`.
* **Cambios de Base de Datos:** Ninguno.
* **Cambios de Backend:** Acciones para invitar y activar empleados del local con roles de negocio (`owner`, `auxiliar`).
* **Cambios de Frontend:** Interfaz de empleados del comercio y visualización de permisos.
* **Seguridad:** Solo el `owner` puede administrar colaboradores del local.
* **Criterios de Aceptación:**
  - El ciclo operativo completo: *Crear Pedido $\rightarrow$ Cocina $\rightarrow$ Despacho $\rightarrow$ Cobro $\rightarrow$ Comprobante BSD $\rightarrow$ Registro de Gasto $\rightarrow$ Arqueo de Caja* se ejecuta sin errores.
  - 100% de cumplimiento de la regla: Cero alertas nativas del navegador (`window.alert`).

#### Tareas de la Fase 10:
- [ ] **Tarea 10.1 [Pendiente]:** Implementar el módulo de empleados del restaurante sobre `public.business_users`.
- [ ] **Tarea 10.2 [Pendiente]:** Habilitar el centro de notificaciones del negocio para alertas de pedidos entrantes.
- [ ] **Tarea 10.3 [Pendiente]:** Desarrollar la suite de pruebas automatizadas de integración para el ciclo de vida del restaurante.
- [ ] **Tarea 10.4 [Pendiente]:** Auditoría final de aislamiento multi-tenant y estricto cumplimiento de estándares de código.

---

## 3. Matriz de Riesgos y Mitigación

| Riesgo Técnico / Arquitectónico | Impacto | Estrategia de Mitigación |
| :--- | :--- | :--- |
| **Contaminación del Core con datos de restaurante** | Alto | Mantener mesas, cocina y delivery estrictamente en `restaurant_orders` y `restaurant_tables`; el Core solo ve ventas en `business_sale_documents`. |
| **Colisión de numeración en comandas rápidas** | Alto | Consecutivo diario por negocio resuelto de forma atómica en base de datos. |
| **Desincronización de disponibilidad en menú digital** | Medio | Lectura directa de `is_available` de `public.products` con revalidación de caché bajo demanda. |
| **Bloqueo de mesas por comandas abiertas sin cobrar** | Medio | Opción de liberación forzosa de mesa con registro en bitácora de auditoría. |
| **Falla en cálculo de cambio en efectivo** | Medio | Operaciones aritméticas enteras en `COP` sin decimales y validación en cliente y servidor. |
| **Vulnerabilidad de acceso entre comercios** | Crítico | Validación estricta en servidor con `requireWorkspaceSession` y políticas RLS en todas las tablas. |

---

## 4. Decisiones Pendientes (Para Definición Previa a la Ejecución)

1. **Notificación Sonora de Pedidos:** Confirmar si en la Fase 4 se habilita un tono sonoro discreto opcional mediante la API de Audio del navegador al entrar un nuevo pedido en la cola.
2. **Impresión de Ticket Térmico:** Validar si en la Fase 6 se añade un botón para invocar `window.print()` con estilos CSS `@media print` para tickets de 80mm/58mm.
3. **Cierres Múltiples de Caja:** Definir si el restaurante requiere múltiples cierres de turno en el día (almuerzo / noche) o un solo arqueo diario consolidado.
