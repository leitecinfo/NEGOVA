# NEGOVA — Mapa de Dependencias entre Módulos

> Fecha: 2026-10-29

---

## 1. Flujos de Negocio Principales

### Flujo 1: Venta POS Directa
```
Producto (+ Modificadores, + Variantes)
    ↓
POS (Selección + Carrito)
    ↓
[Caja Abierta? → SI] 
    ↓
Métodos de Pago (Efectivo / Tarjeta / Digital)
    ↓
Confirmación de Venta
    ↓
├── Venta persiste en restaurant_orders
├── Stock se descuenta (si track_stock)
├── Comanda va a Cocina/KDS
├── Ticket impreso (opcional)
└── Registro en Caja del Turno
```

**Reglas de negocio críticas:**
- No se puede vender sin caja abierta (cuando el modo lo requiere)
- El precio SIEMPRE se recalcula en servidor (nunca confiar en precio del cliente)
- Los modificadores obligatorios deben seleccionarse antes de confirmar
- La venta a crédito requiere cliente identificado con límite de crédito

**Dependencias:**
- Producto → Variantes → Modificadores (deben existir antes del POS)
- Caja → Turno → Venta (la caja debe estar configurada)
- Venta → Audit Log (siempre)

---

### Flujo 2: Pedido de Mesa
```
Mesa Disponible (status: available)
    ↓
Iniciar Orden → restaurant_orders (order_type: dine_in, table_id)
    ↓
Mesa ocupa (status: occupied, current_order_id)
    ↓
Agregar/Quitar Items → restaurant_order_items (UPDATE)
    ↓
Enviar Comanda → Cocina/KDS (status: in_preparation)
    ↓
Pedido listo (status: ready)
    ↓
Cobro (+ Propina + Descuento + Múltiples métodos)
    ↓
Venta completa (status: delivered, payment_status: paid)
    ↓
Mesa liberada (status: available, current_order_id: null)
```

**Reglas de negocio críticas:**
- Una mesa solo puede tener 1 pedido activo a la vez (enforced por RPC)
- No se puede liberar una mesa con pedido sin pagar
- Los items se pueden añadir durante toda la sesión de mesa
- El traslado de mesa preserva todos los items del pedido

**Dependencias:**
- Sala → Mesa → Pedido de Mesa
- Pedido → KDS → Estado de preparación
- Cobro de Mesa → Caja

---

### Flujo 3: Pedido de Domicilio
```
Pedido Domicilio (orderType: delivery, deliveryAddress)
    ↓ (generación automática de PIN de 4 dígitos)
Pedido en cola → delivery_status: pending
    ↓
Asignación de repartidor → delivery_status: assigned, driver_name
    ↓ (opcional: sesión de despacho con token criptográfico)
En camino → delivery_status: on_the_way
    ↓
En destino → ingreso de PIN por repartidor o cliente
    ↓ (verificación: máx 5 intentos, anti brute-force)
Entrega confirmada → delivery_status: delivered, status: delivered
    ↓
Registro de pago → payment_status: paid
```

**Reglas de negocio críticas:**
- La entrega NO cambia automáticamente el estado de pago
- El PIN se almacena codificado en `notes` (formato `[PIN:XXXX:intentos]`)
- Tras 5 intentos fallidos → bloqueo, requiere excepción del negocio
- El token del portal de repartidor expira en 18h por defecto

**Dependencias:**
- Zonas de entrega → Tarifa de domicilio → Pedido
- Repartidor operativo → Asignación → Portal de despacho

---

### Flujo 4: Receta → Disponibilidad de Producto
```
Ingrediente (stock inicial)
    ↓
Receta (Producto ↔ Ingredientes con cantidades y unidades)
    ↓
Al crear pedido:
    → Verificar stock de ingredientes
    → ¿Cuánto alcanza? = stock_ingrediente / cantidad_por_porción
    ↓
Al confirmar venta:
    → Descontar cantidades de cada ingrediente según receta
    ↓
Si ingrediente bajo:
    → Alerta de stock bajo
    → Producto puede marcarse como no disponible automáticamente
```

**Reglas de negocio críticas:**
- El descuento de ingredientes debe ser transaccional (sin descuentos parciales)
- Si faltan ingredientes, el producto no debe poder venderse
- El costo por porción = suma(costo_unitario × cantidad) de ingredientes

**Dependencias (CRÍTICO - Fase 3 depende de Fase 2):**
- Ubicaciones → Inventario por ubicación → Ingredientes con stock
- Receta → Producto (relación 1-a-1 o 1-a-N por ubicación)
- Venta de producto con receta → Descuento de ingredientes

---

### Flujo 5: Compra → Inventario → Cuentas por Pagar
```
Proveedor (directorio)
    ↓
Nueva Compra (productos inventariables o ítems libres)
    ↓ (si es inventariable)
Actualizar existencias por ubicación → inventory_movements (tipo: entrada)
    ↓
Calcular costo promedio ponderado:
    nuevo_costo_prom = (stock_actual × costo_actual + cant_comprada × costo_compra) / (stock + cant)
    ↓
Si pago A CRÉDITO:
    → Crear cuenta por pagar con fecha de vencimiento
    → Saldo pendiente = total_compra - pago_inicial
    ↓
Al registrar pago:
    → Reducir saldo pendiente → cuenta_por_pagar
    → Registrar en movimientos de caja si es efectivo
```

**Reglas de negocio críticas:**
- La compra de ítem libre no mueve inventario
- El costo promedio se actualiza SOLO en compras confirmadas
- No se puede pagar más del saldo pendiente
- La compra no puede duplicarse (idempotencia requerida)

---

### Flujo 6: Gasto → Caja / Registro Financiero
```
Tipo de Gasto: Operativo o Producción
    ↓
Categoría + Monto + Fecha + Medio de pago
    ↓
Si pago en Efectivo:
    → Registrar salida en Caja del turno actual
    → Reducir efectivo disponible en arqueo
    ↓
Persistir en tabla expenses con business_id, categoría, proveedor (opcional)
    ↓
Aparece en Reportes de Gastos y en Cierre del Día
```

**Reglas de negocio críticas:**
- Los gastos de producción son diferentes a los operativos (categorización)
- El gasto en efectivo DEBE reducir el saldo de caja del turno
- Un gasto no puede pertenecer a otro negocio (RLS)

---

### Flujo 7: Venta → Inventario → Cierre de Caja
```
Venta (POS, Mesa, Domicilio, Menú QR)
    ↓ (si producto tiene track_stock)
Descontar stock → inventory_movements (tipo: salida_venta)
    ↓
Si tiene receta:
    → Descontar ingredientes proporcional
    ↓
Acumular en turno de caja:
    → Suma de ventas por método de pago
    → Suma de propinas
    → Suma de descuentos otorgados
    ↓
Al cierre del turno:
    → Comparar sistema vs contado por método de pago
    → Registrar diferencias con notas
    → Exportar PDF/Excel
```

---

### Flujo 8: Cliente → Venta a Crédito → Cartera
```
Cliente con crédito habilitado (credit_limit > 0)
    ↓
Venta con pago "A Crédito"
    ↓ (verificar límite disponible)
credit_used = deuda_actual + total_venta ≤ credit_limit
    ↓
Crear cuenta_por_cobrar: cliente_id, monto, fecha_vencimiento
    ↓
El cliente abona:
    → Reducir saldo pendiente
    → Registrar pago en movimiento de cartera
    ↓
Indicadores:
    → Cartera total, vencida, próxima a vencer
    → Mejor clientes / clientes que más deben
```

**Reglas de negocio críticas:**
- No se puede exceder el límite de crédito
- Las ventas a crédito NO suman al arqueo de caja como cobradas
- Los abonos SÍ suman al arqueo del turno cuando se cobran en efectivo

---

### Flujo 9: Empleado → Rol → Permisos → Operaciones
```
Empleado creado con Rol (owner/admin/cajero/mesero/chef/repartidor)
    ↓
Permisos granulares por módulo + ubicaciones autorizadas
    ↓
Al acceder a cualquier server action:
    requireWorkspaceSession(businessId, permiso_requerido)
    ↓
Si no tiene permiso → 403 Forbidden (sin dato visible)
    ↓
En UI: ocultar acciones no autorizadas
```

**Estado actual:** `requireWorkspaceSession()` existe pero NO verifica permisos granulares en la mayoría de server actions. Solo verifica membresía en el negocio.

**Brecha crítica:** Los permisos granulares están en la BD pero no se aplican consistentemente en el servidor.

---

### Flujo 10: Plan Contratado → Límites → Funciones Disponibles
```
Plan activo (inicio/crece/negocio/pro)
    ↓
Al intentar crear recurso:
    → checkProductPlanLimit() → OK/Bloqueado (implementado para productos)
    → Otros límites: NO implementados en servidor
    ↓
En navegación:
    → Módulos marcados como under_construction ocultan funcionalidad
    → Sin bloqueo real de plan para módulos premium
```

---

## 2. Matriz de Dependencias por Fase

```
FASE 1 (Catálogo Visual)
    └── Prerequisito de todo lo demás

FASE 2 (Inventario/Compras)
    └── Prerequisito de: Fase 3 (Recetas), Fase 5 (Gastos de producción)

FASE 3 (Recetas)
    └── Prerequisito de: Descuento correcto de stock al vender

FASE 4 (Clientes/Empleados)
    └── Prerequisito de: Fase 6 (Ventas a crédito en POS)

FASE 5 (Gastos)
    └── Prerequisito de: Fase 6 (Gastos salen de caja), Fase 8 (Reportes)

FASE 6 (POS/Cajas/Pedidos)
    └── Prerequisito de: Fase 8 (Reportes de ventas y cierres)
    └── Depende de: Fases 1, 2, 4, 5

FASE 7 (Domicilios)
    └── Semi-independiente, puede ejecutarse en paralelo con Fase 6

FASE 8 (Reportes)
    └── Depende de: Fases 2, 3, 4, 5, 6, 7

FASE 9 (Configuración/Integr.)
    └── Semi-independiente

FASE 10 (Pruebas)
    └── Depende de todas
```

---

## 3. Tablas de Base de Datos por Flujo

### Tablas Existentes (Confirmadas por Migraciones)
| Tabla | Módulos que la usan |
|-------|---------------------|
| `businesses` | Core, Configuración, Delivery (settings JSONB) |
| `business_users` | Autenticación, Empleados, Permisos |
| `products` | Catálogo, POS, Menú QR, Pedidos |
| `categories` | Catálogo, Menú QR |
| `restaurant_tables` | Mesas, Pedidos de mesa |
| `restaurant_orders` | POS, Mesas, Domicilios, Menú QR |
| `restaurant_order_items` | Pedidos (detalle) |
| `customers` | Clientes, Cartera, POS |
| `customer_addresses` | Clientes, Domicilios |
| `business_digital_menus` | Menú QR, Presencia digital |
| `delivery_dispatch_sessions` | Portal de repartidores |
| `subscriptions`, `plans` | Suscripciones, Límites |
| `audit_logs` | Auditoría transversal |
| `notifications` | Notificaciones in-app |
| `business_document_configs` | Configuración de documentos |
| `business_sale_correlatives` | Numeración de ventas |

### Tablas Pendientes de Crear
| Tabla Propuesta | Para Módulo |
|----------------|-------------|
| `locations` / `warehouses` | Inventario por ubicación |
| `inventory_stock` | Stock normalizado por producto+ubicación |
| `inventory_movements` | Historial de movimientos |
| `suppliers` | Proveedores |
| `purchases` + `purchase_items` | Compras |
| `accounts_payable` | Cuentas por pagar |
| `accounts_receivable` | Cuentas por cobrar (cartera) |
| `customer_payments` | Pagos de clientes |
| `ingredients` | Ingredientes |
| `recipes` + `recipe_ingredients` | Recetas |
| `expenses` + `expense_categories` | Gastos |
| `cash_registers` | Cajas |
| `cash_sessions` / `shifts` | Turnos de caja |
| `cash_movements` | Movimientos de efectivo |
| `restaurant_rooms` | Salas de restaurante |
| `reservations` | Reservas |
| `spoilage_records` | Mermas |
| `delivery_zones` | Zonas de entrega |
| `quotations` | Cotizaciones |

