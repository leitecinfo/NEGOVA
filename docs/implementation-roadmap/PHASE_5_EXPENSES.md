# Fase 5 — Gastos y Control Financiero

**Objetivo:** Implementar registro de gastos operativos y de producción con relación a caja y reportes.  
**Depende de:** Fase 2 (para gastos de producción con inventario)  
**Prerequisito de:** Fase 6 (gastos salen de caja), Fase 8 (reportes de gastos)

---

## Tareas

### GAS-001 — Módulo de gastos operativos
**ID:** GAS-001 | **Prioridad:** P1 | **Dependencias:** INV-001 (opcional)  
**Problema:** La tabla `expenses` existe en BD (migración 20261007) pero no hay módulo UI ni servicio dedicado.

**Alcance:**
- Servicio: `src/lib/expenses/expenses-service.ts`
  - CRUD de gastos con business_id, concept, amount, category, expense_date, payment_method, notes, supplier_id (opcional), created_by
  - Categorías de gastos: Operativo (servicios, marketing, arriendo, etc.) / Producción (materia prima, insumos)
- Actions: `gastos/actions.ts` con `verifyWorkspaceAction(businessId, 'expenses.create')`
- Ruta: `/workspace/[businessId]/gastos/` (reemplazar redirect a `/modulo/gastos`)
- UI:
  - KPIs: Total gastado, Operativos, Producción, Salió de caja
  - Gráficos: "¿En qué se va el dinero?" (por categoría), "Cómo se pagó" (por medio de pago)
  - Filtros: periodo, categoría, medio de pago, proveedor, buscador
  - Pestañas: Todos, Operativos, Producción
  - Botón "+ Nuevo gasto"
- Migración: si es necesario, añadir columnas faltantes (`expense_type: 'operational'|'production'`, `payment_method`, `supplier_id REFERENCES suppliers`, `receipt_url`)

**Modal "Nuevo Gasto" (flujo 3 pasos):**
1. **Tipo:** Selección visual entre Operativo y Producción
2. **Detalle:** Monto, descripción, categoría (con botón + para crear nueva), fecha
3. **Pago:** Medio de pago, proveedor (opcional), N° de recibo (opcional)

**Reglas de negocio:**
- Los gastos de producción se separan de los operativos para analítica
- Cada gasto debe tener categoría, monto y fecha
- Si el pago es en efectivo y hay caja abierta: registrar como salida de caja

**Criterios de aceptación:**
- Se puede registrar un gasto operativo (ej. "Recibo de energía" → \$150.000 → Servicios Públicos → Efectivo)
- El gasto aparece en el listado filtrado correctamente
- Los KPIs de "Total gastado" suman correctamente
- Los gráficos muestran la distribución por categoría y medio de pago
- Un usuario sin permiso `expenses.create` no puede registrar gastos

---

### GAS-002 — Gastos de producción
**ID:** GAS-002 | **Prioridad:** P1 | **Dependencias:** GAS-001  

**Alcance:**
- Las categorías de producción: Materia Prima, Ingredientes, Insumos de Producción, Envases y Empaques
- Cuando un gasto de producción se vincula a un producto o ingrediente del inventario, puede opcionalmente actualizar el costo
- Los gastos de producción se diferencian visualmente y en reportes

**Criterios de aceptación:**
- Se puede registrar un gasto de producción (ej. "Compra de queso" → \$80.000 → Materia Prima)
- En el reporte de gastos, la separación Operativo vs Producción es clara
- El total de gastos de producción se compara con el ingreso de ventas para calcular margen

---

### GAS-003 — Integrar gastos con caja y reportes financieros
**ID:** GAS-003 | **Prioridad:** P1 | **Dependencias:** GAS-001, CAJ-001  

**Alcance:**
- Al registrar un gasto con método de pago "Efectivo" y caja abierta:
  - Crear `cash_movements` tipo `expense` vinculado al turno activo
  - Reducir el saldo de efectivo disponible en el turno
- Al registrar un gasto: impactar los reportes financieros (Ingresos - Gastos = Resultado)

**Criterios de aceptación:**
- Un gasto en efectivo de \$50.000 reduce el efectivo del turno de caja activo en \$50.000
- En el cierre del día, los gastos aparecen como salidas
- En el reporte financiero, los gastos se restan de los ingresos

---

## Criterios de Finalización de Fase 5
- [x] Se pueden registrar gastos operativos y de producción
- [x] Los gastos en efectivo se reflejan en el turno de caja
- [x] Las categorías de gastos se gestionan correctamente
- [x] Los KPIs y gráficos de gastos son correctos

