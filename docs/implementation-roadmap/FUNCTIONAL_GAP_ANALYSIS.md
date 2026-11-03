# NEGOVA — Análisis de Brechas Funcionales (Gap Analysis)

> Referencia: 25 bloques funcionales de TuyApp  
> Fecha: 2026-10-29

## Leyenda de Estados
- ✅ **Implementado** — Existe y funciona con evidencia en código
- 🔶 **Parcial** — Existe pero faltan operaciones, persistencia o integración
- 🔨 **Mejora necesaria** — Funciona pero presenta problemas verificados
- ❌ **Pendiente** — No existe o es placeholder sin funcionalidad
- 🔒 **Bloqueada** — Depende de decisión, credencial o servicio externo no disponible
- ➖ **No aplicable** — Fuera del alcance actual

---

## Bloque A — Navegación y Sistema Visual

### A1. Sidebar y Navegación Agrupada
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Sidebar con grupos | ✅ Implementado | `workspace-shell.tsx`, `workspace-navigation.ts` con 5 grupos | — | Ninguna |
| Búsqueda global | 🔶 Parcial | `admin-command-palette.tsx` existe en admin; workspace no la tiene | Sin búsqueda global en workspace | Añadir command palette al workspace |
| Accesos rápidos | 🔶 Parcial | `workspace-header-quick-access.tsx` con 1 módulo configurable | Solo 1 acceso rápido; referencia tiene botonera de 6 | Ampliar a múltiple selección |
| Widget de suscripción | ❌ Pendiente | No existe en sidebar del workspace | Sin indicador de plan/límites | Crear widget de suscripción en sidebar |
| Identificador negocio/avatar | ✅ Implementado | `app-layout-shell.tsx` con branding | — | — |

### A2. Sistema de Diseño
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Tokens de color/tipografía | 🔶 Parcial | `tailwind.config.ts`, `DESIGN_SYSTEM.md` existen; dos sistemas paralelos (admin y workspace) | Duplicación de componentes UI entre admin y workspace | Unificar hacia `src/components/ui/` |
| Componentes base unificados | 🔶 Parcial | `src/components/ui/` tiene: `data-table`, `empty-state`, `error-state`, `kpi-card`, `pagination`, `search-input`, `modal-portal` | Admin tiene sus propios: `admin-data-table`, `admin-kpi-card`, etc. | Migrar admin a componentes compartidos |
| Estados de carga/error/vacío | 🔶 Parcial | `loading-skeleton.tsx`, `empty-state.tsx`, `error-state.tsx` existen | No se usan consistentemente en todos los módulos | Auditoría y aplicación uniforme |
| Responsive mobile | 🔶 Parcial | `app-mobile-sidebar.tsx` existe; algunos módulos son desktop-only | POS y Mesas no optimizados para móvil | Plan de responsive por módulo |

---

## Bloque B — Catálogo y Productos

### B1. Gestión de Productos
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| CRUD productos | ✅ Implementado | `products-service.ts` con createProduct, updateProduct, archiveProduct | — | — |
| Categorías y subcategorías | 🔶 Parcial | CRUD de categorías completo; sin subcategorías (sin `parent_id`) | Categorías sin jerarquía padre/hijo | Añadir `parent_category_id` y UI de árbol |
| Variantes | 🔶 Parcial | Variantes en `metadata.variants` (JSON). Validación en servidor al crear pedido | Sin tabla normalizada de variantes; sin UI clara de gestión de variantes | Normalizar variantes o mejorar UI de gestión |
| SKU y código de barras | 🔶 Parcial | Campos en tipos pero sin validación de unicidad | Sin unicidad de SKU por negocio; sin escaneo de barras en POS | Validar unicidad, añadir lector de código de barras |
| Imágenes | 🔶 Parcial | `supabase-storage.ts` existe; `image-cropper-modal.tsx` existe | Sin confirmación de que se persisten en el formulario de producto | Verificar y completar flujo de carga de imágenes |
| Modificadores (grupos) | 🔶 Parcial | Modificadores en `metadata.modifier_groups` (JSON); validación en servidor | Sin UI dedicada de gestión de grupos de modificadores | Crear UI de grupos de modificadores |
| Impuestos por producto | ❌ Pendiente | Tipos mencionan impuestos pero sin implementación | Sin configuración de IVA por producto | Implementar campo de impuesto en producto |
| Canales de disponibilidad | 🔶 Parcial | `is_available`, `show_in_qr_menu` en productos | Sin control por canal (POS vs QR vs tienda) | Añadir flags por canal |
| Stock ilimitado / inventario mínimo | 🔶 Parcial | `metadata.track_stock`, `metadata.stock_quantity` | Stock en JSON sin normalizar; sin stock mínimo con alertas | Ver Fase 2 (inventario normalizado) |
| Combos/Ingredientes como tipo | ❌ Pendiente | `product_type` en tipos pero sin lógica diferencial | Sin tipo "Combo" funcional ni tipo "Ingrediente" | Implementar tipos diferenciales |

### B2. Importación y Exportación
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Importar productos (CSV/Excel) | ❌ Pendiente | No existe | — | Implementar importación |
| Exportar productos | ❌ Pendiente | No existe | — | Implementar exportación |
| Filtros avanzados en catálogo | 🔶 Parcial | Búsqueda básica existe | Sin filtros por categoría, estado, tipo, ubicación | Añadir filtros avanzados |

### B3. Mermas
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Registro de mermas | ❌ Pendiente | No existe tabla ni UI | — | Implementar módulo de mermas |
| Mermas de productos | ❌ Pendiente | No existe | — | Parte de módulo mermas |
| Mermas de ingredientes | ❌ Pendiente | No existe | — | Parte de módulo mermas |

---

## Bloque C — Inventario, Compras y Proveedores

### C1. Inventario y Existencias
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Ubicaciones | ❌ Pendiente | Sin tabla `locations` normalizada | Stock solo en metadata del producto | Crear tabla de ubicaciones y stock por ubicación |
| Existencias por ubicación | ❌ Pendiente | No existe | — | Fase 2 |
| Movimientos (entradas/salidas/ajustes) | ❌ Pendiente | No existe tabla de movimientos | — | Fase 2 |
| Historial de movimientos | ❌ Pendiente | No existe | — | Fase 2 |
| Transferencias entre ubicaciones | ❌ Pendiente | No existe | — | Fase 2 |
| Alertas de stock bajo | ❌ Pendiente | No existe | — | Fase 2 |

### C2. Compras y Proveedores
| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Directorio de proveedores | ❌ Pendiente | `src/app/workspace/[businessId]/proveedores/page.tsx` existe como placeholder | Sin servicio ni tabla | Fase 2 |
| Registro de compras | ❌ Pendiente | No existe | — | Fase 2 |
| Cuentas por pagar | ❌ Pendiente | No existe | — | Fase 2 |
| Costo promedio | ❌ Pendiente | No existe | — | Fase 2 |
| Categorías de compras | ❌ Pendiente | No existe | — | Fase 2 |

---

## Bloque D — Recetas e Ingredientes

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Ingredientes | ❌ Pendiente | No existe tabla ni servicio | — | Fase 3 |
| Recetas vinculadas a productos | ❌ Pendiente | No existe | — | Fase 3 |
| Costos por receta/porción | ❌ Pendiente | No existe | — | Fase 3 |
| Descuento de ingredientes al vender | ❌ Pendiente | No existe | — | Fase 3 |
| Cálculo de rendimiento/disponibilidad | ❌ Pendiente | No existe | — | Fase 3 |

---

## Bloque E — Gastos

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Registro de gastos operativos | ❌ Pendiente | Solo placeholder `modulo/gastos` | No existe tabla ni servicio | Fase 5 |
| Categorías de gastos | ❌ Pendiente | No existe | — | Fase 5 |
| Gráficos y resúmenes | ❌ Pendiente | No existe | — | Fase 8 |
| Relación con caja | ❌ Pendiente | No existe | — | Fase 6 |

---

## Bloque F — Clientes y Cartera

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Directorio de clientes | ✅ Implementado | `customers-service.ts` con listado paginado, búsqueda normalizada | — | — |
| Historial de pedidos | 🔶 Parcial | Existe `customer_id` en órdenes pero sin vista en perfil de cliente | Sin vista de historial desde perfil | Completar vista de detalle |
| Clientes con crédito | ❌ Pendiente | No existe modelo de crédito | Sin cartera, saldos ni vencimientos | Fase 4 |
| Cuentas por cobrar | ❌ Pendiente | No existe | — | Fase 4 |
| Pagos y abonos | ❌ Pendiente | No existe | — | Fase 4 |
| Integración con POS (venta a crédito) | ❌ Pendiente | No existe | — | Fase 4 |

---

## Bloque G — Menú QR y Tienda Digital

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Catálogo público | ✅ Implementado | `src/app/menu/` con templates (comercial, elegante, urbana, visual) | — | — |
| Carrito de compras | ✅ Implementado | `menu-cart-drawer.tsx`, `menu-cart-types.ts` | — | — |
| Modalidades (domicilio/recoger/mesa) | ✅ Implementado | `order-destination-modal.tsx` | — | — |
| Checkout con datos de cliente | ✅ Implementado | Flujo de checkout integrado con `createRestaurantOrder` | — | — |
| Modificadores en menú QR | 🔶 Parcial | `product-detail-modal.tsx` con modificadores | Sin validación de mínimos/máximos en UI | Completar validación en modal |
| Confirmación y sincronización | ✅ Implementado | Pedido persiste en `restaurant_orders` con `channel_origin: digital_menu` | — | — |
| Integración WhatsApp | ✅ Implementado | `order-notifications.ts` envía notificación al negocio | — | — |
| Búsqueda de productos en menú | 🔶 Parcial | Existe por categoría; sin buscador de texto libre | Sin búsqueda por nombre en menú público | Añadir buscador |

---

## Bloque H — Domicilios

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Creación de pedidos domicilio | ✅ Implementado | Via `createRestaurantOrder` con `orderType: delivery` | — | — |
| Repartidores | ✅ Implementado | `delivery-service.ts` con CRUD de repartidores operativos | Sin formulario completo (vehículo, licencia) | Completar formulario |
| Portal público seguro | ✅ Implementado | `src/app/reparto/` con autenticación por token criptográfico | — | — |
| PIN de entrega | ✅ Implementado | PIN de 4 dígitos, 5 intentos, brute-force protection | — | — |
| Asignación de repartidores | ✅ Implementado | `assignDriverToOrder()` | Solo asignación manual | Añadir rotativa/automática |
| Zonas de entrega | ❌ Pendiente | Sin tabla de zonas; solo fee global en settings | Sin editor de zonas con polígonos | Fase 7 |
| Mapa de cobertura | ❌ Pendiente | No existe | — | Fase 7 |
| Vista por repartidor | 🔶 Parcial | `getBusinessDeliveryOrders()` permite filtrar por driver_name | Sin UI dedicada de vista por repartidor | Fase 7 |
| Seguimiento de pedidos | ❌ Pendiente | Sin trazabilidad en tiempo real para cliente | — | Fase 7 |
| Configuración tarifa/tiempo | 🔶 Parcial | `businesses.settings.delivery.fee` | Sin UI de configuración completa | Fase 7 |
| Integraciones externas (Rappi, Justo) | 🔒 Bloqueada | Requiere APIs de terceros | — | Decisión pendiente |

---

## Bloque I — Restaurante, Mesas y Salas

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Mesas con estados | ✅ Implementado | `restaurant-service.ts` completo | — | — |
| QR por mesa | ✅ Implementado | `table-qr-service.ts` con versiones y revocación | — | — |
| Crear/gestionar mesas | ✅ Implementado | CRUD completo | — | — |
| Salas | ❌ Pendiente | `restaurant_tables` no tiene `room_id`; sin tabla de salas | Sin agrupación de mesas por sala | Fase 6 |
| Comensales y notas | 🔶 Parcial | `diners_count`, `ticket_name` en orders | Sin UI completa en detalle de orden de mesa | Completar UI |
| Modificadores en mesa | 🔶 Parcial | `modifier-selection-modal.tsx` existe | Integración con flujo de mesa no verificada | Verificar y completar |
| Traslado de mesas | ❌ Pendiente | No existe operación de traslado | — | Fase 6 |
| Cobro con múltiples métodos | 🔶 Parcial | `order-payment-modal.tsx` con múltiples métodos | Falta propina, descuentos preestablecidos | Completar modal de pago |
| Reservas | ❌ Pendiente | No existe tabla ni módulo | — | Fase 6 |

---

## Bloque J — Mis Órdenes, KDS y Tickets Abiertos

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Vista kanban de pedidos | 🔶 Parcial | `src/app/workspace/[businessId]/pedidos/` existe; Realtime habilitado | Sin evidencia de vista kanban completa por estados | Completar vista kanban |
| Monitor de cocina (KDS) | ❌ Pendiente | Solo placeholder `modulo/cocina` | Sin pantalla KDS | Fase 6 |
| Tiempos de preparación | ❌ Pendiente | No existe | — | Fase 6 |
| Tickets abiertos | ❌ Pendiente | No existe vista dedicada | — | Fase 6 |
| Sincronización en tiempo real | 🔶 Parcial | Realtime habilitado en `restaurant_orders` | Sin suscripción activa en UI de Mis Órdenes verificada | Completar integración Realtime |

---

## Bloque K — POS, Ventas y Facturación

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Pantalla POS | 🔶 Parcial | `pos-screen-client.tsx` existe; `src/app/workspace/[businessId]/pos/page.tsx` | Sin verificación de caja abierta integrada | Completar validación de caja |
| Búsqueda por nombre/SKU/barras | 🔶 Parcial | Búsqueda básica | Sin scanner de código de barras | Añadir scanner |
| Modificadores en POS | ✅ Implementado | `modifier-selection-modal.tsx` | — | — |
| Pagos múltiples | 🔶 Parcial | `order-payment-modal.tsx` | Falta pagos digitales, divisiones múltiples | Completar |
| Cálculo de cambio | 🔶 Parcial | Existe en modal de pago | — | — |
| Descuentos y propinas | 🔶 Parcial | Existe parcialmente | Sin descuentos preestablecidos configurables | Completar |
| Apertura de caja | ❌ Pendiente | Sin módulo de caja | — | Fase 6 |
| Historial de ventas | ✅ Implementado | `src/app/workspace/[businessId]/ventas/` completo | — | — |
| Anulaciones auditables | 🔶 Parcial | `audit_logs` existe; sin flujo de anulación completo | Sin UI de anulación con motivo | Completar |
| Ventas a crédito | ❌ Pendiente | No existe | — | Fase 4 |
| Cotizaciones | ❌ Pendiente | No existe | — | Fase 6 |
| Comanda e impresión | 🔶 Parcial | `thermal-ticket.tsx`, `document-preview.tsx` existen | Sin integración verificada con impresoras físicas | Fase 9 |

---

## Bloque L — Cajas, Turnos y Cierres

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Cajas y apertura de turno | ❌ Pendiente | Solo placeholder `modulo/caja` | Sin tabla de cajas ni turnos | Fase 6 |
| Base inicial y movimientos | ❌ Pendiente | No existe | — | Fase 6 |
| Cierre del día | ❌ Pendiente | No existe | — | Fase 6 |
| Cierre por rango | ❌ Pendiente | No existe | — | Fase 6 |
| Reconciliación por método de pago | ❌ Pendiente | No existe | — | Fase 6 |
| Pendientes de barra | ❌ Pendiente | No existe | — | Fase 6 |

---

## Bloque M — Empleados y Permisos

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Empleados y roles | ✅ Implementado | `src/app/workspace/[businessId]/usuarios/` y `roles/` | — | — |
| Permisos granulares | 🔶 Parcial | `user-permissions-matrix-editor.tsx`; permisos en `business_users` | Sin verificación de que permisos se aplican en server actions de todos los módulos | Auditar aplicación de permisos |
| PIN de autorización | ❌ Pendiente | Estructura mencionada en tipos pero sin implementar | — | Fase 4 |
| Roles restaurante (mesero, cocina) | 🔶 Parcial | Roles existen en catálogo | Sin diferenciación funcional entre roles en la UI operativa | Completar diferenciación |

---

## Bloque N — Dashboard, Reportes e Informes

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Dashboard inicio | 🔶 Parcial | `src/app/workspace/[businessId]/page.tsx` existe | Sin evidencia de KPIs reales de ventas | Completar con datos reales |
| Reporte de ventas | ❌ Pendiente | Solo placeholder `modulo/reportes` | — | Fase 8 |
| Reporte de empleados | ❌ Pendiente | No existe | — | Fase 8 |
| Reporte de inventario | ❌ Pendiente | No existe | — | Fase 8 |
| Exportación PDF/Excel | ❌ Pendiente | `pdf-engine.ts` existe pero sin reportes completos | — | Fase 8 |
| Horas pico | ❌ Pendiente | No existe | — | Fase 8 |
| Reporte de domicilios | ❌ Pendiente | No existe | — | Fase 8 |

---

## Bloque O — Configuración del Negocio

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Identidad y logo | ✅ Implementado | `configuracion/page.tsx` con logo y datos básicos | — | — |
| NIT y DV | 🔶 Parcial | Campos existen | Sin cálculo automático de DV ni validación | Completar |
| Régimen tributario | 🔶 Parcial | Campos en tipos | Sin UI completa | Completar |
| Configuración DIAN | 🔒 Bloqueada | Requiere resolución fiscal real | — | Decisión pendiente |
| Tipo de negocio y funciones | ✅ Implementado | `commercial-activities.ts` con actividades y funciones por tipo | — | — |
| Configuración POS | 🔶 Parcial | `businesses.settings` pero sin UI completa | — | Fase 9 |
| Unidades y conversiones | ❌ Pendiente | No existe UI de gestión | — | Fase 9 |
| Impresión y estaciones | ❌ Pendiente | `printing/types.ts` existe; sin integración QZ Tray | — | Fase 9 |
| Notificaciones y plantillas | 🔶 Parcial | `notifications-service.ts`, WhatsApp service con plantillas | Sin UI de gestión de plantillas | Fase 9 |
| Idioma, moneda, zona horaria | 🔶 Parcial | COP como default; sin selector de zona horaria en UI | — | Fase 9 |
| Seguridad (2FA) | ❌ Pendiente | No existe | — | Fase 9 |

---

## Bloque P — Canales Digitales e Integraciones

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Presencia digital / Links | 🔶 Parcial | `presencia-digital/page.tsx` con menú digital | Sin página de enlaces tipo Linktree | Fase 9 |
| Tienda online | ❌ Pendiente | No existe | — | Fase 9 |
| Facturación electrónica | 🔒 Bloqueada | Requiere autorización DIAN | — | Decisión |
| Fidelización/Puntos | ❌ Pendiente | No existe | — | P3 |
| Centro de ayuda | ❌ Pendiente | No existe en workspace | — | Fase 9 |

---

## Bloque Q — Suscripciones y Límites

| Función | Estado | Evidencia | Brecha | Acción |
|---------|--------|-----------|--------|--------|
| Planes y ciclos | 🔶 Parcial | `subscriptions-service.ts`, tabla `subscriptions` | — | — |
| Límite de productos | ✅ Implementado | `checkProductPlanLimit()` en `products-service.ts` | — | — |
| Límite de usuarios/ubicaciones | ❌ Pendiente | No validado en servidor para otros recursos | — | Fase 9 |
| Estado de suscripción y acceso | 🔶 Parcial | `planId` y `enabledFeatures` en sesión | Sin bloqueo real en servidor para módulos bloqueados | Completar |
| Widget de plan en sidebar | ❌ Pendiente | No existe | — | Fase 1 |

---

## Resumen por Estado

| Estado | Cantidad de Items | Porcentaje |
|--------|-----------------|------------|
| ✅ Implementado | ~28 items | ~18% |
| 🔶 Parcial | ~52 items | ~34% |
| ❌ Pendiente | ~62 items | ~40% |
| 🔒 Bloqueada | ~5 items | ~3% |
| 🔨 Mejora necesaria | ~7 items | ~5% |
| **Total** | **~154 items** | **100%** |

