# Fase 6 — POS Completo, Cajas, Cierres y Flujo de Pedidos

**Objetivo:** Completar el POS con apertura de caja, gestión de turnos, cierre diario, KDS y flujos completos de pedidos de mesa.  
**Depende de:** Fases 1, 2, 4, 5  
**Prerequisito de:** Fase 8 (reportes de ventas y cierres)

---

## Tareas P0

### CAJ-001 — Crear modelo de Cajas y Turnos
Ver [TASKS.md#caj-001](TASKS.md). Migración del esquema `cash_registers`, `cash_sessions`, `cash_movements`.

### INT-001 — Integrar restaurant_orders con business_sale_documents
Ver [TASKS.md#int-001](TASKS.md). Vincular los dos sistemas de ventas.

---

## Tareas P1

### POS-001 — Apertura de caja en flujo POS
**ID:** POS-001 | **Prioridad:** P1 | **Dependencias:** CAJ-001  
**Problema:** El POS no verifica si hay una caja abierta antes de permitir ventas.

**Alcance:**
- Al abrir el POS, verificar si el usuario tiene un turno de caja activo
- Si no: mostrar modal "No hay caja abierta" con selector de caja y campo de base inicial, botón "Abrir caja de hoy"
- Al confirmar: crear `cash_sessions` con `initial_amount`, `opened_by`, status `open`
- Si ya tiene turno: continuar normalmente
- Al confirmar cada venta: registrar `cash_movements` por método de pago

**Criterios de aceptación:**
- Si no hay caja abierta al entrar al POS: aparece modal de apertura
- Tras abrir la caja con base \$200.000: el turno está activo
- Cada venta en efectivo incrementa el saldo del turno
- El turno activo persiste al recargar la página

---

### POS-002 — Pagos múltiples y divisiones
**ID:** POS-002 | **Prioridad:** P1 | **Dependencias:** POS-001  

**Alcance:**
- En el modal de pago: opción "Dividir pago en múltiples métodos"
- Ejemplo: \$20.000 total → \$15.000 efectivo + \$5.000 transferencia
- Mostrar: desglose por método, "Pago completo" cuando la suma ≥ total
- Calcular cambio en efectivo si se paga de más
- Propinas: opciones rápidas (10%, 15%, 20%) o monto personalizado
- Descuentos: porcentaje o valor fijo, con motivo configurable

**Criterios de aceptación:**
- Se puede dividir un pago entre efectivo y tarjeta
- El cambio se calcula sobre el método en efectivo
- La propina se registra separada del monto de la venta
- El descuento reduce el total antes del pago
- Cada método de pago genera su propio `cash_movements`

---

### POS-003 — Ventas a crédito en POS
**ID:** POS-003 | **Prioridad:** P1 | **Dependencias:** CLI-002, POS-001 | **Estado:** Completada ✓  

**Alcance:**
- En el modal de pago: opción "A crédito" (solo si el cliente tiene crédito habilitado)
- Verificar: `credit_limit - credit_used ≥ total_venta`
- Al confirmar: crear `accounts_receivable`, incrementar `credit_used`
- La venta queda con `payment_status: credit`

**Criterios de aceptación:**
- Al seleccionar "A crédito" con cliente sin crédito: error
- Al superar el límite: error con saldo disponible
- La venta a crédito NO suma al efectivo del turno
- La cuenta por cobrar aparece en la cartera del cliente

---

### POS-004 — Cotizaciones
**ID:** POS-004 | **Prioridad:** P1 | **Dependencias:** POS-001 | **Estado:** Completada ✓  

**Alcance:**
- Botón "Crear cotización" en el POS (no afecta stock ni caja)
- Genera un documento tipo "cotización" con los productos del carrito
- Se puede convertir a venta posteriormente
- Las cotizaciones tienen numeración propia y vencimiento configurable

**Criterios de aceptación:**
- Se puede crear una cotización sin afectar stock ni caja
- La cotización aparece en un listado dedicado con estado y vencimiento
- Se puede convertir a venta: los productos se agregan al carrito del POS

---

### POS-005 — Anulaciones con auditoría
**ID:** POS-005 | **Prioridad:** P1 | **Dependencias:** POS-001, EMP-002  

**Alcance:**
- Botón "Anular venta" en el detalle de venta
- Modal: motivo de anulación (obligatorio, mínimo 3 caracteres)
- Si requiere PIN de autorización (según configuración): solicitar PIN
- Al anular: revertir stock, revertir movimientos de caja, registrar en `audit_logs`
- Las ventas anuladas aparecen con estado "Cancelada" y no suman en reportes

**Reglas de negocio:**
- La anulación no elimina el registro, lo marca como cancelado
- El stock se devuelve al inventario
- Los ingredientes de recetas se devuelven al inventario
- Si la venta era a crédito: reducir `credit_used` del cliente

**Criterios de aceptación:**
- Al anular una venta de 5 unidades: el stock se incrementa en 5
- El `audit_logs` registra quién anuló, cuándo y el motivo
- La venta aparece como "Cancelada" en el historial
- Los reportes de ventas excluyen las ventas anuladas

---

### CAJ-002 — UI de apertura y cierre de turno
**ID:** CAJ-002 | **Prioridad:** P1 | **Dependencias:** CAJ-001  

**Alcance:**
- Ruta: `/workspace/[businessId]/caja/` (reemplazar placeholder)
- Vista: KPIs (turnos abiertos, efectivo en cajones, vendido en turnos)
- Listado de cajas con estado de turno actual
- Modal "Abrir turno": seleccionar caja, base inicial
- Modal "Cerrar turno": resumen de movimientos, total contado por método de pago, diferencias, notas
- Botón "Nuevo caja" para crear cajas adicionales

**Criterios de aceptación:**
- Se puede abrir un turno con base de \$200.000
- Se puede cerrar un turno: el sistema muestra el total del sistema vs total contado
- Las diferencias se registran con notas
- No se puede abrir un segundo turno en la misma caja

---

### CAJ-003 — Movimientos de efectivo en turno
**ID:** CAJ-003 | **Prioridad:** P1 | **Dependencias:** CAJ-002 | **Estado:** Completada ✓  

**Alcance:**
- Historial de movimientos de cada turno: ventas, gastos, entradas, retiros
- Modal "Registrar entrada" / "Registrar retiro" (no venta) con monto, motivo
- Cálculo en tiempo real del efectivo en caja

**Criterios de aceptación:**
- Se puede registrar una entrada manual de \$100.000 con motivo "Cambio"
- Se puede registrar un retiro de \$50.000 con motivo "Pago a proveedor"
- El saldo de efectivo se actualiza: base + ventas_efectivo + entradas - retiros - gastos

---

### CAJ-004 — Cierre del día con reconciliación
**ID:** CAJ-004 | **Prioridad:** P1 | **Dependencias:** CAJ-003 | **Estado:** Completada ✓  

**Alcance:**
- Panel "Cierre del día" para una fecha seleccionada
- Métricas: Total Ventas, Mostrador, Mesas, Domicilios, Online
- Cuadre por Método de Pago: cada método muestra Total Sistema vs Total Contado con diferencia calculada
- Campos de observaciones
- Botones: "Exportar PDF" y "Guardar Cierre del Día"
- El cierre se persiste como registro inmutable

**Criterios de aceptación:**
- Se puede generar el cierre del día con todos los totales correctos
- La diferencia entre sistema y contado se calcula automáticamente
- El cierre se puede exportar como PDF
- Un cierre guardado no puede modificarse (solo consultar)

---

### CAJ-005 — Cierre por rango de fechas
**ID:** CAJ-005 | **Prioridad:** P1 | **Dependencias:** CAJ-004 | **Estado:** Completada ✓  

**Alcance:**
- Herramienta de cierre consolidado para un rango de fechas (máximo 30 días)
- Resumen general, desglose por canal, cuadre por método de pago

**Criterios de aceptación:**
- Se puede generar un cierre de 7 días con totales consolidados
- El rango máximo es 30 días (muestra error si se supera)
- El PDF incluye todo el desglose del rango

---

### MES-001 — Salas de restaurante
**ID:** MES-001 | **Prioridad:** P1 | **Dependencias:** Ninguna  

**Alcance:**
- Migración: crear tabla `restaurant_rooms` (business_id, name, description, location_id, status)
- Añadir `room_id REFERENCES restaurant_rooms` a `restaurant_tables`
- UI: pestaña "Salas" en mesas. Modal "Crear Nueva Sala" (ubicación, nombre, descripción)
- Las mesas se crean dentro de una sala
- Vista de mesas agrupadas por sala

**Criterios de aceptación:**
- Se puede crear una sala "Terraza" y otra "Interior"
- Las mesas se asignan a una sala
- La vista de mesas agrupa por sala con estados visuales

---

### MES-002 — Traslado de mesas
**ID:** MES-002 | **Prioridad:** P1 | **Dependencias:** Ninguna  

**Alcance:**
- Acción "Trasladar" en mesa ocupada
- Modal: seleccionar mesa destino (debe estar libre)
- Al trasladar: mover el `current_order_id` a la nueva mesa, liberar la anterior
- Registrar en `audit_logs`

**Criterios de aceptación:**
- Se puede trasladar el pedido de Mesa 1 a Mesa 3 (libre)
- Mesa 1 queda disponible, Mesa 3 queda ocupada con el pedido
- El pedido conserva todos sus items y estado

---

### MES-003 — Cobro de mesa completo (propinas, descuentos)
**ID:** MES-003 | **Prioridad:** P1 | **Dependencias:** POS-002 | **Estado:** Completada ✓  

**Alcance:**
- En "Cerrar Órdenes": seleccionar mesa, ver total
- Opciones de: pagos múltiples, descuentos preestablecidos (Adulto Mayor 10%, Estudiante 15%, etc.), propinas (5%, 10%, 15% o personalizado)
- Botón "Confirmar Pago"
- Al confirmar: la mesa se libera automáticamente

**Criterios de aceptación:**
- Se puede cobrar una mesa con 10% de descuento + 15% de propina + pago mixto
- Al confirmar pago: mesa queda libre, pedido queda "delivered + paid"
- La propina se registra separada en los reportes

---

### KDS-001 — Monitor de cocina (KDS)
**ID:** KDS-001 | **Prioridad:** P1 | **Dependencias:** Ninguna | **Estado:** Completada  

**Alcance:**
- Ruta: `/workspace/[businessId]/cocina/` (reemplazar placeholder)
- Pantalla completa de control en tiempo real
- Pestañas: Pendiente, Preparando, Listo, Entregado, Todas
- Tarjetas de órdenes: tiempo transcurrido, lista de productos, botón de acción ("Iniciar", "Listo", "Entregar")
- Suscripción Realtime a `restaurant_orders` (ya habilitado en BD)
- Alertas visuales: >15 min = amarillo, >30 min = rojo parpadeante

**Criterios de aceptación:**
- Un pedido nuevo aparece automáticamente en "Pendiente" (sin recargar página)
- Al hacer clic en "Iniciar": pasa a "Preparando"
- El tiempo transcurrido se muestra en cada tarjeta
- Los pedidos >30 min tienen indicador rojo

---

### KDS-002 — Tiempos de preparación y alertas
**ID:** KDS-002 | **Prioridad:** P1 | **Dependencias:** KDS-001 | **Estado:** Completada ✓  

**Alcance:**
- Configuración de umbrales: alerta amarilla (ej. 15 min), alerta roja (ej. 30 min)
- En el KDS: tarjetas con color según tiempo
- En "Mis Órdenes": indicador de pedidos demorados y críticos

---

### KDS-003 — Vista de tickets abiertos
**ID:** KDS-003 | **Prioridad:** P1 | **Dependencias:** KDS-001 | **Estado:** Completada  

**Alcance:**
- Panel de tickets abiertos (no cobrados)
- KPIs: En esta vista, Demorados, Críticos
- Enlace directo a "Mis Órdenes" y a factura
- Incluye info de canal (POS, QR, Domicilio), servicio, mesa, cliente, comensales, cajero
- Integración en monitor KDS con conmutador de vistas y subruta dedicada `/cocina/tickets`
- Tests unitarios completos en `tests/unit/workspace-kds-003-open-tickets.test.ts`


---

### RES-001 — Módulo de Reservas
**ID:** RES-001 | **Prioridad:** P2 | **Dependencias:** MES-001  
**Estado:** Completada  

**Alcance:**
- Migración: tabla `reservations` (business_id, customer_name, phone, email, party_size, date, time, room_id, table_id, status, origin, special_requests, allergies, notes)
- Vistas: Calendario, Lista, Asignar Mesas
- Modal "Nueva Reserva": info básica, detalles, facturación (opcional)
- Indicadores: Reservas Hoy, Próximos 7 Días, Walk-ins, Ocupación
- Tests unitarios completos en `tests/unit/workspace-res-001-reservations.test.ts`

**Criterios de aceptación:**
- [x] Se puede crear una reserva para 4 personas a las 8PM en la Sala Principal
- [x] La reserva aparece en el calendario
- [x] Se puede asignar mesa a la reserva
- [x] Al llegar el cliente, la reserva cambia a "checked_in"

---

## Criterios de Finalización de Fase 6
- [x] El POS verifica caja abierta antes de permitir ventas
- [x] Los pagos múltiples funcionan correctamente
- [x] El cierre del día con reconciliación funciona
- [x] El KDS muestra pedidos en tiempo real
- [x] Las mesas se organizan por salas
- [x] Los traslados de mesa funcionan sin perder datos
- [x] La integración restaurant_orders ↔ business_sale_documents funciona
- [x] El módulo de reservas permite gestionar calendario, ocupación y asignación de mesas (RES-001)

