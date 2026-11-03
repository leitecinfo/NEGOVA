# Fase 4 — Clientes, Cartera y Empleados

**Objetivo:** Completar el módulo de clientes con crédito/cartera y afinar el sistema de empleados y permisos.  
**Depende de:** Fase 1 (sistema visual)  
**Prerequisito de:** Fase 6 (ventas a crédito en POS)

---

## Tareas

### CLI-001 — Historial de pedidos en perfil de cliente
**ID:** CLI-001 | **Prioridad:** P1 | **Dependencias:** Ninguna  
**Problema:** `getCustomerById()` ya devuelve `recentOrders` y `recentSales`, pero la UI del detalle del cliente no muestra historial de compras completo.  
**Objetivo:** Mostrar historial completo de pedidos y ventas en el perfil del cliente.

**Alcance:**
- En `/clientes/[id]/customer-detail-client.tsx`: añadir pestaña "Historial" con:
  - Tabla paginada de pedidos (fecha, # pedido, tipo, total, estado)
  - Tabla de ventas/documentos asociados
  - KPIs: total gastado, ticket promedio, última compra, pedidos totales

**Criterios de aceptación:**
- El perfil del cliente muestra todas las ventas asociadas
- Los KPIs se calculan correctamente desde los datos reales
- Al hacer clic en un pedido, navega al detalle del pedido

---

### CLI-002 — Crédito a clientes y cuentas por cobrar
**ID:** CLI-002 | **Prioridad:** P1 | **Dependencias:** CLI-001  
**Problema:** No existe modelo de crédito a clientes. No hay cuentas por cobrar.  
**Objetivo:** Permitir otorgar crédito a clientes y gestionar la cartera.

**Alcance:**
- Migración: modificar `customers` añadiendo `credit_limit NUMERIC DEFAULT 0`, `credit_used NUMERIC DEFAULT 0`
- Crear tabla `accounts_receivable` (business_id, customer_id, order_id, amount, paid_amount, balance, due_date, status: pending|partial|paid|overdue, created_at)
- Crear tabla `customer_payments` (business_id, customer_id, receivable_id, amount, payment_method, notes, created_by, created_at)
- En ficha de cliente: sección de crédito con límite, usado, disponible
- En listado de clientes: pestañas "Con crédito", "Por cobrar", "Vencidos"

**Reglas de negocio:**
- Solo el owner/admin puede otorgar crédito (configurar `credit_limit`)
- `credit_used` se incrementa al registrar venta a crédito y se reduce con abonos
- Una venta a crédito NO puede superar `credit_limit - credit_used`
- Las cuentas vencidas se marcan automáticamente

**Criterios de aceptación:**
- Se puede configurar límite de crédito de \$500.000 para un cliente
- Al intentar una venta a crédito de \$600.000 con saldo disponible de \$500.000: error
- Al registrar abono de \$200.000: el saldo de la cuenta baja en \$200.000
- Los KPIs de cartera (pagado vs por cobrar, antigüedad) son correctos

---

### CLI-003 — Abonos y gestión de cartera
**ID:** CLI-003 | **Prioridad:** P1 | **Dependencias:** CLI-002  

**Alcance:**
- UI de cartera en el módulo de clientes:
  - KPIs: Clientes con crédito, Por cobrar total, Créditos vencidos
  - Gráficos: Pagado vs por cobrar, salud de cartera, clientes que más deben, antigüedad de deuda
  - Tabla de próximos cobros con filtros
- Modal "Registrar Abono":
  - Seleccionar cuenta por cobrar
  - Monto del abono, medio de pago, notas
  - Al registrar: crear `customer_payments`, reducir `balance` y `credit_used`

**Criterios de aceptación:**
- La sección de cartera muestra el total por cobrar a todos los clientes
- Se puede registrar un abono parcial que reduce el saldo de la cuenta
- Al pagar el total, la cuenta pasa a "paid" y el credit_used se reduce
- Los gráficos de cartera reflejan datos reales

---

### EMP-001 — Conectar nómina con UI existente
**ID:** EMP-001 | **Prioridad:** P1 | **Dependencias:** Ninguna  
**Problema:** `workspace-nomina-client.tsx` existe (30KB) pero la página redirige a placeholder.  
**Objetivo:** Hacer accesible la UI de nómina ya construida.

**Alcance:**
- Modificar `/nomina/page.tsx`: eliminar redirect, usar el componente existente
- Verificar que el componente funciona con los servicios de nómina existentes
- Las tablas BD (`payroll_periods`, `payroll_receipts`, `payroll_items`) ya existen

**Criterios de aceptación:**
- La ruta `/workspace/[businessId]/nomina` carga la UI de nómina sin redirect
- Se puede crear un período de nómina
- Se puede ver la liquidación de un empleado

---

### EMP-002 — PIN de autorización para operaciones sensibles
**ID:** EMP-002 | **Prioridad:** P1 | **Dependencias:** Ninguna  

**Alcance:**
- Permitir asignar un PIN de 4-6 dígitos a un empleado (en su perfil)
- Al ejecutar operaciones sensibles (anulación de venta, descuento mayor al %, apertura de caja):
  - Solicitar PIN del empleado autorizado
  - Validar PIN en el servidor contra `business_users` o `business_employees`
  - Registrar en `audit_logs` quién autorizó la operación
- PIN almacenado como hash (no en texto plano)

**Criterios de aceptación:**
- Se puede asignar un PIN a un empleado desde su perfil
- Al intentar anular una venta, aparece modal de PIN
- Si el PIN es correcto y el empleado tiene permiso de anulación: la operación se ejecuta
- Si el PIN es incorrecto: la operación se rechaza
- El PIN NO se almacena en texto plano en la BD

---

### PERM-001 — Auditar y aplicar permisos granulares
**P0** — Ver [TASKS.md#perm-001](TASKS.md) para detalles completos.

---

### NOM-001 — Completar módulo de nómina
**ID:** NOM-001 | **Prioridad:** P2 | **Dependencias:** EMP-001  

**Alcance:**
- Verificar que los servicios de nómina existentes funcionan correctamente
- Completar flujos de: crear período, calcular liquidación, aprobar, marcar como pagado
- Integrar pagos de nómina con el módulo de gastos (tipo "nómina")

**Criterios de aceptación:**
- Se puede crear un período quincenal, calcular las liquidaciones y aprobarlas
- Los comprobantes de pago se generan correctamente
- El pago de nómina registra un gasto tipo "nómina" en el módulo de gastos

---

## Criterios de Finalización de Fase 4
- [ ] Los clientes pueden tener crédito con límite y cartera funcional
- [ ] Los abonos reducen correctamente el saldo de cartera
- [ ] La nómina es accesible y funcional
- [ ] Los PINs de autorización funcionan para operaciones sensibles
- [ ] Todos los permisos granulares están aplicados en las server actions

