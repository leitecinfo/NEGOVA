# Fase 8 — Reportes, Dashboard e Informes

**Objetivo:** Implementar el dashboard de KPIs y los reportes operativos con exportación PDF/Excel, filtros de fecha y reconciliación con datos reales.  
**Depende de:** Fase 6 (POS, Cajas, Ventas integradas), Fase 2 (Inventario), Fase 5 (Gastos), Fase 3 (Recetas)  
**Puede ejecutarse parcialmente en paralelo con Fase 7.**

---

## Tareas

### REP-001 — Dashboard de KPIs de ventas
**ID:** REP-001 | **Prioridad:** P1 | **Dependencias:** INT-001, CAJ-001 | **Estado:** Completada  

**Alcance:**
- Vista principal del dashboard (`/workspace/[businessId]/dashboard`)
- Tarjetas resumen:
  - Ventas del día (monto total, cantidad de transacciones)
  - Ventas de la semana y del mes
  - Ticket promedio
  - Productos más vendidos (top 5)
  - Canal con más ventas (mostrador, mesa, domicilio, menú QR)
- Gráfico de barras: ventas por día (últimos 7 días)
- Gráfico de línea: tendencia de ventas (últimos 30 días)
- Filtro de fecha: hoy, ayer, últimos 7 días, este mes, rango personalizado
- Fuente de datos: `business_sale_documents` (post INT-001)
- Server action con `verifyWorkspaceAction(businessId, 'reports:read')`

**Criterios de aceptación:**
- Las tarjetas muestran montos correctos del día, semana y mes (Verificado ✓)
- El gráfico de barras muestra 7 días con datos reales (Verificado ✓)
- Cambiar el filtro de fecha actualiza todos los indicadores (Verificado ✓)
- Sin ventas: muestra estado vacío con mensaje explicativo (Verificado ✓)
- El dashboard carga en menos de 3 segundos con 1000 documentos de venta (Verificado ✓, procesado en < 160ms)

**Implementación & Verificación:**
- Implementado en `src/lib/reports/types.ts` y `src/lib/reports/reports-service.ts`.
- Server Action con `verifyWorkspaceAction(businessId, 'reports:read')` en `src/app/workspace/[businessId]/dashboard/actions.ts`.
- Dashboard responsivo con Recharts y selector de fechas en `src/app/workspace/[businessId]/dashboard/sales-dashboard-client.tsx` y `page.tsx`.
- Enlace integrado en navegación y dashboard principal.
- Suite de pruebas unitarias `tests/unit/workspace-rep-001-sales-dashboard.test.ts` (9/9 pruebas pasando al 100%).
- Cero alertas nativas.

---

### REP-002 — Reporte de ventas con exportación
**ID:** REP-002 | **Prioridad:** P1 | **Dependencias:** INT-001  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/ventas`
- Tabla con columnas: fecha, # documento, cliente, canal, método de pago, subtotal, impuestos, descuento, total, estado
- Filtros: rango de fecha, canal de venta, método de pago, empleado, estado (completada/anulada)
- Resumen inferior: total bruto, total impuestos, total descuentos, total neto, cantidad de transacciones
- Exportación PDF: reporte con membrete del negocio, período, tabla de datos y resumen
- Exportación Excel: CSV o XLSX con todas las columnas
- Server action con permisos

**Criterios de aceptación:**
- La tabla muestra todas las ventas del período seleccionado
- Los totales del resumen coinciden con la suma de las filas visibles
- El PDF se genera con el logo del negocio si existe
- El archivo Excel contiene todas las columnas y filas sin truncar
- Filtrar por "anuladas" muestra solo ventas canceladas con motivo

---

### REP-003 — Reporte de empleados
**ID:** REP-003 | **Prioridad:** P1 | **Dependencias:** INT-001, CAJ-001 | **Estado:** Completada  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/empleados`
- Vista: tabla por empleado con métricas del período seleccionado
  - Nombre, rol, ventas realizadas (cantidad), monto total vendido, ticket promedio
  - Turnos trabajados (si hay sesiones de caja), horas totales
  - Propinas recibidas (si aplica)
- Ranking de empleados por ventas
- Filtro: rango de fecha, ubicación, rol
- Exportación PDF y Excel

**Criterios de aceptación:**
- Se listan todos los empleados activos del negocio (Verificado ✓)
- Las ventas por empleado coinciden con la suma de `business_sale_documents` donde `created_by` = empleado (Verificado ✓)
- El ranking ordena de mayor a menor por monto vendido (Verificado ✓)
- El PDF incluye período y resumen de totales (Verificado ✓)

**Implementación & Verificación:**
- Tipos en `src/lib/reports/types.ts` (`EmployeeReportMetricItem`, `EmployeeReportSummary`, `EmployeeReportData`).
- Agregación multi-tenant en `getEmployeeReportData` dentro de `src/lib/reports/reports-service.ts`.
- Exportador PDF en `src/lib/reports/employee-report-pdf.ts` (membrete, período, resumen de totales del equipo y podio de ventas).
- Exportador Excel en `src/lib/reports/employee-report-csv.ts` (CSV con UTF-8 BOM y fila de totales).
- Barra de navegación rápida `ReportNavTabs` entre Dashboard, Ventas y Empleados.
- Server Actions con permisos `reports:read` / `reports.view` en `src/app/workspace/[businessId]/reportes/empleados/actions.ts`.
- Vista responsiva con podio visual de desempeño en `src/app/workspace/[businessId]/reportes/empleados/employee-report-client.tsx` y `page.tsx`.
- Suite unitaria `tests/unit/workspace-rep-003-employee-report.test.ts` (8/8 pruebas pasando al 100%). Cero alertas nativas.

---

### REP-004 — Reporte de inventario
**ID:** REP-004 | **Prioridad:** P1 | **Dependencias:** INV-001, INV-003, INV-004 | **Estado:** Completada  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/inventario`
- Vistas:
  1. **Existencias actuales:** tabla con producto, ubicación, cantidad, stock mínimo, estado (normal/bajo/agotado), costo unitario, valor total
  2. **Movimientos del período:** tabla con fecha, producto, tipo de movimiento, cantidad, referencia, usuario
  3. **Productos con stock bajo:** listado filtrado de productos por debajo del mínimo
- Resumen: valor total del inventario, productos sin stock, productos bajo mínimo
- Filtros: ubicación, categoría, rango de fecha (para movimientos), tipo de movimiento
- Exportación PDF y Excel

**Criterios de aceptación:**
- Las existencias mostradas coinciden con `inventory_stock` (Verificado ✓)
- El valor total del inventario = Σ(quantity × cost) de todos los productos (Verificado ✓)
- Los movimientos muestran referencia a la orden/compra/ajuste que los generó (Verificado ✓)
- Productos bajo mínimo se destacan visualmente con badge de alerta (Verificado ✓)

**Implementación & Verificación:**
- Tipos en `src/lib/reports/types.ts` (`InventoryStockReportRow`, `InventoryMovementReportRow`, `InventoryLowStockReportRow`, `InventoryReportSummary`, `InventoryReportData`).
- Agregación multi-tenant en `getInventoryReportData` dentro de `src/lib/reports/reports-service.ts`.
- Generador PDF en `src/lib/reports/inventory-report-pdf.ts` (A4 landscape con membrete institucional, tarjetas de KPIs y tablas formateadas con paginación).
- Generador Excel en `src/lib/reports/inventory-report-csv.ts` (CSV con UTF-8 BOM, exportación por vista y fila de totales generales).
- Pestaña de Inventario integrada en `ReportNavTabs` (`src/components/reports/report-nav-tabs.tsx`).
- Server Actions con permisos `reports:read` / `reports.view` / `inventory.view` en `src/app/workspace/[businessId]/reportes/inventario/actions.ts`.
- Interfaz interactiva de 3 vistas con filtros multidimensionales y badges de stock en `src/app/workspace/[businessId]/reportes/inventario/inventory-report-client.tsx` y `page.tsx`.
- Suite unitaria `tests/unit/workspace-rep-004-inventory-report.test.ts` (9/9 pruebas pasando al 100%). Cero alertas nativas.

---

### REP-005 — Reportes de gastos y compras
**ID:** REP-005 | **Prioridad:** P1 | **Dependencias:** GAS-001, PROV-002  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/gastos`
- **Reporte de gastos:**
  - Tabla: fecha, categoría, proveedor, descripción, monto, medio de pago
  - Gráfico de torta: distribución por categoría
  - Gráfico de barras: gastos por mes (últimos 6 meses)
  - Resumen: total gastos, promedio diario, categoría principal
- **Reporte de compras:**
  - Tabla: fecha, proveedor, # documento, productos, subtotal, impuestos, total, estado
  - Top 5 proveedores por monto
  - Resumen: total compras, cuentas por pagar pendientes
- Filtros: rango de fecha, categoría, proveedor
- Exportación PDF y Excel

**Criterios de aceptación:**
- Los montos de gastos coinciden con los registros del módulo de gastos
- Las compras reflejan las órdenes de compra confirmadas
- El gráfico de distribución por categoría suma 100%
- El PDF de compras incluye detalle de productos comprados

---

### REP-006 — Análisis de horas pico
**ID:** REP-006 | **Prioridad:** P2 | **Dependencias:** INT-001  
**Estado:** Completada  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/horas-pico`
- Mapa de calor (heatmap): eje X = hora del día (6AM-12AM), eje Y = día de la semana
  - Intensidad = cantidad de ventas o monto total
- Tabla resumen: hora pico por día de la semana, hora con más ventas global
- Toggle: ver por cantidad de transacciones o por monto
- Filtro: rango de fecha, canal de venta
- Utilidad: ayuda al negocio a planificar personal y abastecimiento
- Tests unitarios completos en `tests/unit/workspace-rep-006-peak-hours.test.ts`

**Criterios de aceptación:**
- [x] El mapa de calor muestra las 7 × 18 celdas (días × horas) con datos reales
- [x] La celda con mayor intensidad corresponde a la hora/día con más ventas
- [x] Sin datos para un período: muestra estado vacío
- [x] El heatmap se renderiza correctamente en pantallas de 1024px+

---

### REP-007 — Reporte de domicilios
**ID:** REP-007 | **Prioridad:** P2 | **Dependencias:** DOM-001, DOM-003  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/domicilios`
- Métricas:
  - Total entregas del período, entregas exitosas, canceladas, rechazadas
  - Tiempo promedio de entrega (aceptación → entrega)
  - Repartidor con más entregas
  - Zona con más pedidos (si DOM-001 implementado)
- Tabla por repartidor: nombre, entregas completadas, tiempo promedio, calificación promedio
- Tabla por zona: nombre, pedidos, monto total, tiempo promedio
- Filtros: rango de fecha, repartidor, zona, estado
- Exportación PDF y Excel

**Criterios de aceptación:**
- Los conteos de entregas coinciden con los registros de `delivery_orders`
- El tiempo promedio se calcula correctamente en minutos
- Los repartidores se ordenan por entregas completadas descendente
- El reporte funciona aunque no haya zonas configuradas (DOM-001 opcional)

---

### REP-008 — Reporte de recetas y costos
**ID:** REP-008 | **Prioridad:** P2 | **Dependencias:** REC-002, REC-004 | **Estado:** Completada  

**Alcance:**
- Ruta: `/workspace/[businessId]/reportes/recetas`
- **Costos por producto:**
  - Tabla: producto, costo de receta, precio de venta, margen bruto (%), margen bruto ($)
  - Alertas: productos con margen < 30% o margen negativo
  - Ordenar por margen ascendente para identificar los menos rentables
- **Consumo de ingredientes:**
  - Tabla: ingrediente, stock actual, consumo del período (calculado desde ventas), costo total consumido
  - Ingredientes que se agotarán primero según ritmo de consumo
- Filtros: categoría, rango de fecha (para consumo)
- Exportación PDF y Excel

**Criterios de aceptación:**
- El costo de receta coincide con la suma de (cantidad_ingrediente × costo_ingrediente) para cada producto
- El margen bruto se calcula como: (precio_venta - costo_receta) / precio_venta × 100
- Los productos con margen < 30% se destacan visualmente
- El consumo del período se calcula multiplicando la cantidad del ingrediente en la receta × unidades vendidas

**Implementación finalizada:**
- Contratos de dominio en `src/lib/reports/types.ts`.
- Lógica analítica y cálculo de escandallos en `src/lib/reports/reports-service.ts` (`getRecipeReportData`).
- Generación de PDF A4 apaisado en `src/lib/reports/recipe-report-pdf.ts`.
- Generación de Excel/CSV con BOM UTF-8 en `src/lib/reports/recipe-report-csv.ts`.
- Server actions protegidas en `src/app/workspace/[businessId]/reportes/recetas/actions.ts`.
- Vista interactiva en `src/app/workspace/[businessId]/reportes/recetas/page.tsx` y `recipe-report-client.tsx`.
- Enlace en navegación rápida de reportes `ReportNavTabs` y configuración de módulos de espacio de trabajo.
- Suite de pruebas completa: `tests/unit/workspace-rep-008-recipe-report.test.ts` (15/15 aprobadas).


