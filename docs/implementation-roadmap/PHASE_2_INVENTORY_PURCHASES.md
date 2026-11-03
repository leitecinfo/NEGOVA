# Fase 2 — Inventario, Ubicaciones, Compras y Proveedores

**Objetivo:** Crear el modelo normalizado de inventario por ubicación como fundamento de todas las operaciones de stock, compras y costos.  
**Prerequisito de:** Fase 3 (Recetas), Fase 5 (Gastos de producción), Fase 6 (descuento correcto en ventas)  
**Depende de:** Fase 1 (catálogo completado)

---

## Tareas de esta Fase

### INV-001 — Crear esquema normalizado de inventario por ubicación
**P0** — Ver [TASKS.md#inv-001](TASKS.md) para detalles completos de la migración.

---

### STOCK-001 — Mover descuento de stock dentro de la RPC PostgreSQL
**P0** — Ver [TASKS.md#stock-001](TASKS.md). Depende de INV-001.

---

### INV-002 — Crear UI de gestión de ubicaciones y stock
**ID:** INV-002 | **Prioridad:** P1  
**Módulo:** Inventario  
**Dependencias:** INV-001  
**Problema:** No existe UI para gestionar ubicaciones ni ver stock por ubicación.  
**Objetivo:** Crear la sección de inventario con pestañas Ubicaciones y Productos.

**Alcance:**
- Ruta: `/workspace/[businessId]/productos` → pestaña "Inventario" (o subruta `/inventario`)
- Pestaña Ubicaciones: listado con tarjetas de ubicaciones, KPIs (total, productos, QR), botón "+ Nueva ubicación"
- Modal "Nueva ubicación": nombre, tipo (punto de venta / bodega / sucursal), dirección, visible en QR
- Pestaña Productos: tabla con stock por ubicación, filtros por categoría, estado, buscador
- KPIs superiores: Total Productos, Stock Bajo, Valor al Costo, Movimientos Hoy

**Componentes afectados:**
- Nuevo: `inventory-locations-tab.tsx`, `inventory-products-tab.tsx`, `location-form-modal.tsx`
- Nuevo servicio: `src/lib/inventory/inventory-service.ts`
- Nuevo actions: `productos/inventory-actions.ts`

**Criterios de aceptación:**
- Se puede crear una ubicación tipo "Bodega" y otra "Punto de venta"
- La tabla de productos muestra el stock por cada ubicación en columnas
- Los KPIs calculan correctamente el valor al costo y los productos con stock bajo
- Al recargar la página, los datos persisten correctamente
- Datos aislados por business_id (otro negocio no ve estas ubicaciones)

---

### INV-003 — Implementar movimientos de inventario
**ID:** INV-003 | **Prioridad:** P1  
**Módulo:** Inventario  
**Dependencias:** INV-001, INV-002  
**Problema:** No existen movimientos de inventario (entradas, salidas, ajustes).  
**Objetivo:** Permitir registrar movimientos que actualizan las existencias.

**Alcance:**
- Botón "+ Nuevo movimiento" → Modal con:
  - Selector de ubicación
  - Buscador de productos con stock disponible
  - Tipo de movimiento: Entrada / Salida / Ajuste
  - Cantidad, costo unitario, notas
  - Botón "+ Agregar a la lista" para operaciones en lote
  - Resumen: total productos, unidades, costo total
  - Botón "Registrar N movimiento(s)"
- Cada movimiento crea un registro en `inventory_movements` y actualiza `inventory_stock`

**Reglas de negocio:**
- La salida no puede dejar stock negativo (salvo configuración expresa)
- El ajuste establece el stock al valor indicado (no suma/resta)
- Cada movimiento registra quién lo hizo (`created_by`)
- Los movimientos son inmutables una vez registrados

**Criterios de aceptación:**
- Al registrar una entrada de 10 unidades, el stock se incrementa en 10
- Al registrar una salida de 5 unidades, el stock se reduce en 5
- Al intentar una salida mayor al stock disponible, muestra error
- El historial de movimientos muestra la operación con todos sus datos
- Un movimiento no puede pertenecer a otro negocio

---

### INV-004 — Historial de movimientos y alertas de stock bajo
**ID:** INV-004 | **Prioridad:** P1  
**Módulo:** Inventario  
**Dependencias:** INV-003  

**Alcance:**
- Pestaña "Historial" en inventario: tabla con filtros por origen, producto, fecha, tipo
- Columnas: Fecha, Producto, Tipo, Origen, Cantidad, Costo Unit., Costo Total, Notas
- Pestaña "Stock Bajo": productos con stock ≤ min_stock, botón "Reabastecer"
- Notificación in-app cuando un producto baja del mínimo

**Criterios de aceptación:**
- El historial muestra todos los movimientos del periodo seleccionado
- La pestaña Stock Bajo muestra solo productos cuyo stock actual ≤ mínimo configurado
- Al hacer clic en "Reabastecer", navega al formulario de nueva compra con el producto preseleccionado

---

### INV-005 — Transferencias entre ubicaciones
**ID:** INV-005 | **Prioridad:** P1  
**Módulo:** Inventario  
**Dependencias:** INV-003  

**Alcance:**
- Botón "Transferencias" en inventario → Modal:
  - Ubicación origen, ubicación destino
  - Productos y cantidades a transferir
  - Notas de la operación
- Genera 2 movimientos: `transfer_out` en origen + `transfer_in` en destino (misma transacción)

**Reglas de negocio:**
- El stock de origen debe ser suficiente
- Ambos movimientos se crean atómicamente
- No se puede transferir a la misma ubicación

**Criterios de aceptación:**
- Al transferir 5 unidades de Ubicación A a B: A tiene -5 y B tiene +5
- El historial muestra ambos movimientos vinculados
- Si origen no tiene stock suficiente, la transferencia se rechaza

---

### PROV-001 — Crear directorio de proveedores
**ID:** PROV-001 | **Prioridad:** P1  
**Módulo:** Proveedores  
**Dependencias:** INV-001  

**Alcance:**
- Migración: crear tabla `suppliers` (business_id, name, contact_name, phone, email, tax_id, payment_terms, address, status, notes)
- Servicio: `src/lib/suppliers/suppliers-service.ts` con CRUD completo
- Actions: `proveedores/actions.ts`
- UI: ruta `/workspace/[businessId]/proveedores/` (reemplazar redirect actual)
  - Listado con búsqueda y filtros
  - Modal "Nuevo Proveedor": nombre, contacto, teléfono, NIT/cédula, plazo de pago, dirección
  - Detalle de proveedor con historial de compras
- RLS con filtro por business_id

**Criterios de aceptación:**
- Se puede crear un proveedor con datos básicos
- El listado se filtra por búsqueda de nombre o NIT
- El proveedor aparece disponible en el selector de "Nueva Compra"
- Aislamiento multi-tenant verificado

---

### PROV-002 — Registro de compras
**ID:** PROV-002 | **Prioridad:** P1  
**Módulo:** Compras  
**Dependencias:** PROV-001, INV-003  

**Alcance:**
- Migración: crear tablas `purchases` y `purchase_items`
  ```
  purchases: id, business_id, supplier_id, purchase_date, subtotal, tax_amount, total, 
             payment_type (cash|credit), payment_method, status (confirmed|cancelled), 
             notes, created_by
  purchase_items: id, purchase_id, business_id, product_id (nullable), item_name, 
                  quantity, unit_cost, total_cost, location_id, is_inventory_item
  ```
- UI: pestaña "Compras" en inventario con:
  - Filtros por periodo, proveedor, medio de pago
  - KPIs: Comprado, De contado, A crédito, Por pagar hoy
  - Pestañas: Todas, De contado, A crédito, Por pagar, Vencidas
  - Modal "Nueva Compra" con 3 secciones:
    1. Proveedor y fecha (con botón + para crear proveedor rápido)
    2. Productos: "Producto del inventario" (suma stock) / "Ítem libre" (no mueve inventario)
    3. Impuestos (IVA, retenciones) y Pago (contado/crédito, medio de pago)
  - Panel de resumen con desglose
  - Confirmación con código de compra (COMP-XXXXX)

**Reglas de negocio:**
- Si el producto es inventariable: se crea movimiento de entrada + se actualiza costo promedio
- Si es ítem libre: solo registra gasto, no mueve inventario
- Las compras a crédito crean cuenta por pagar automáticamente
- La compra genera correlativo único por negocio
- No se puede duplicar la compra (idempotencia)

**Criterios de aceptación:**
- Al registrar una compra de un producto inventariable:
  - El stock de la ubicación seleccionada aumenta
  - El movimiento de inventario tipo "entrada" se registra
  - El costo promedio se recalcula
- Al registrar compra a crédito:
  - Se genera cuenta por pagar con fecha de vencimiento
  - Aparece en la lista de "Por pagar"
- La confirmación muestra el código COMP-XXXXX
- El proveedor puede crearse inline durante la compra

---

### PROV-003 — Cuentas por pagar y pagos a proveedores
**ID:** PROV-003 | **Prioridad:** P1  
**Módulo:** Compras  
**Dependencias:** PROV-002  

**Alcance:**
- Migración: crear tabla `accounts_payable` (business_id, supplier_id, purchase_id, amount, paid_amount, balance, due_date, status: pending|partial|paid|overdue)
- Pagos parciales o totales con registro de medio de pago
- Vista de cuentas por pagar con filtros por estado, proveedor, vencimiento
- Indicadores: total por pagar, vencido, próximo a vencer

**Criterios de aceptación:**
- Una compra a crédito genera automáticamente una cuenta por pagar
- Se puede registrar un pago parcial: el saldo se reduce correctamente
- Al pagar el total: la cuenta pasa a estado "paid"
- Las cuentas vencidas se marcan automáticamente como "overdue"

---

### PROV-004 — Costo promedio ponderado
**ID:** PROV-004 | **Prioridad:** P1  
**Módulo:** Compras/Inventario  
**Dependencias:** PROV-002  

**Alcance:**
- Al confirmar una compra de producto inventariable, recalcular costo promedio:
  ```
  nuevo_costo = (stock_actual × costo_actual + cantidad_comprada × costo_compra) / (stock_actual + cantidad_comprada)
  ```
- Actualizar `inventory_stock.cost` con el nuevo valor
- Mostrar el costo promedio en la ficha del producto y en el inventario

**Criterios de aceptación:**
- Al comprar 10 unidades a \$1.000 cuando hay 10 unidades a \$800: el nuevo costo promedio es \$900
- El costo promedio se muestra correctamente en la tabla de inventario
- El costo se usa para calcular el valor total del inventario

---

## Criterios de Finalización de Fase 2
- [ ] La tabla `locations` tiene al menos 1 ubicación por negocio activo
- [ ] Los productos con stock previo en metadata tienen registros en `inventory_stock`
- [ ] Se pueden registrar compras que actualizan stock y costo promedio
- [ ] Las cuentas por pagar funcionan con pagos parciales
- [ ] Los movimientos de inventario son trazables y auditables
- [ ] Todos los nuevos actions usan `verifyWorkspaceAction()` con permiso correcto

