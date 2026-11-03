# NEGOVA — Matriz de Permisos Granulares y Auditoría de Server Actions

> Tarea: **[PERM-001]** (Fase 4, Prioridad P0)  
> Estándar de Seguridad: Validación estricta en servidor mediante `verifyWorkspaceAction(businessId, permissionCode)`

---

## 1. Principio Fundamental de Seguridad en Server Actions

En NEGOVA, **toda Server Action sin excepción** que modifique o consulte datos de un comercio debe ejecutar al inicio:

```typescript
const auth = await verifyWorkspaceAction(businessId, "modulo.permiso");
if (!auth.success || !auth.context) {
  return { success: false, error: auth.error || "No tienes autorización para realizar esta operación." };
}
```

Esta capa garantiza en una sola llamada de servidor:
1. **Validación de Identificador:** Formato UUID estricto del `businessId`.
2. **Autenticación Activa:** Verificación de sesión en Supabase Auth (`supabase.auth.getUser()`).
3. **Existencia y Estado del Tenant:** El comercio debe existir y no estar `inactive` ni `suspended`.
4. **Membresía Activa:** El usuario debe tener registro con `status = 'active'` en `public.business_users`.
5. **Compatibilidad de Vertical:** El permiso debe ser aplicable a la vertical del negocio (`isPermissionCompatibleWithBusinessType`).
6. **Capacidades del Plan:** Si aplica, el plan comercial debe tener habilitada la característica requerida.
7. **Control RBAC y Anulaciones:** Si el usuario no es `owner`, se evalúa la tabla de overrides `public.business_user_permissions` y la matriz canónica del rol.

---

## 2. Matriz de Permisos para Módulos Nuevos y Existentes

| Módulo | Código de Permiso | Nombre del Permiso | Nivel Mínimo / Asignable a Auxiliar | Acciones de Servidor Protegidas |
| :--- | :--- | :--- | :--- | :--- |
| **Cajas** | `cash.view` | Ver Cajas y Turnos | Auxiliar (Sí) | `getCashRegistersAction`, `getActiveCashSessionAction`, `getCashMovementsAction`, `getCashSessionSummaryAction` |
| **Cajas** | `cash.open` | Abrir Turno de Caja | Auxiliar (Sí) | `openCashSessionAction` |
| **Cajas** | `cash.close` | Cerrar Turno de Caja | Auxiliar (Sí) | `closeCashSessionAction` |
| **Cajas** | `cash.move` | Movimiento de Efectivo | Auxiliar (Sí) | `recordCashMovementAction` |
| **Cajas** | `cash.manage` | Administrar Terminales | Owner (No) | `createCashRegisterAction` |
| **Inventario** | `inventory.view` | Ver Inventario y Stock | Auxiliar (Sí) | `getBusinessLocationsAction`, `getInventoryStockAction` |
| **Inventario** | `inventory.create` | Entrada de Existencias | Auxiliar (Sí) | `recordInventoryMovementAction` (entradas) |
| **Inventario** | `inventory.update` | Editar Stock / Ubicaciones | Owner (No) | `createLocationAction`, `upsertInventoryStockAction` |
| **Inventario** | `inventory.adjust` | Ajustes / Mermas Físicas | Owner (No) | `recordInventoryMovementAction` (ajustes/mermas) |
| **Inventario** | `inventory.transfer`| Transferir entre Ubicaciones | Owner (No) | `transferStockAction` |
| **Proveedores** | `suppliers.view` | Ver Proveedores | Auxiliar (Sí) | `getSuppliersAction` |
| **Proveedores** | `suppliers.create` | Registrar Proveedor | Auxiliar (Sí) | `createSupplierAction` |
| **Proveedores** | `suppliers.update` | Editar Proveedor | Auxiliar (Sí) | `updateSupplierAction` |
| **Proveedores** | `suppliers.delete` | Eliminar Proveedor | Owner (No) | `deleteSupplierAction` |
| **Compras** | `purchases.view` | Ver Compras | Auxiliar (Sí) | `getPurchasesAction` |
| **Compras** | `purchases.create` | Registrar Compra | Auxiliar (Sí) | `createPurchaseAction` |
| **Compras** | `purchases.update` | Editar Compra | Owner (No) | `updatePurchaseAction` |
| **Compras** | `purchases.cancel` | Anular Compra | Owner (No) | `cancelPurchaseAction` |
| **Gastos** | `expenses.view` | Ver Gastos | Auxiliar (Sí) | `getExpensesAction` |
| **Gastos** | `expenses.create` | Registrar Gasto | Auxiliar (Sí) | `createExpenseAction` |
| **Gastos** | `expenses.update` | Editar Gasto | Auxiliar (Sí) | `updateExpenseAction` |
| **Gastos** | `expenses.delete` | Eliminar Gasto | Owner (No) | `deleteExpenseAction` |
| **Recetas** | `recipes.view` | Ver Recetas y Escandallos | Auxiliar (Sí) | `getRecipesAction` |
| **Recetas** | `recipes.create` | Crear Receta | Owner (No) | `createRecipeAction` |
| **Recetas** | `recipes.update` | Editar Receta | Owner (No) | `updateRecipeAction` |
| **Recetas** | `recipes.delete` | Eliminar Receta | Owner (No) | `deleteRecipeAction` |
| **Productos** | `products.view` | Ver Catálogo de Productos | Auxiliar (Sí) | `getProductsAction`, `getCategoriesAction` |
| **Productos** | `products.create` | Crear Producto | Auxiliar (Sí) | `createProductAction`, `createCategoryAction` |
| **Productos** | `products.update` | Editar Producto | Auxiliar (Sí) | `updateProductAction`, `updateCategoryAction` |
| **Productos** | `products.delete` | Eliminar Producto | Owner (No) | `deleteProductAction`, `deleteCategoryAction` |
| **Ventas** | `sales.view` | Ver Ventas | Auxiliar (Sí) | `getSalesAction`, `getSaleDocumentByIdAction` |
| **Ventas** | `sales.create` | Emitir Venta POS | Auxiliar (Sí) | `createSaleDocumentAction` |
| **Ventas** | `sales.cancel` | Anular Venta | Owner (No) | `cancelSaleDocumentAction` |
| **Pedidos** | `orders.view` | Ver Pedidos | Auxiliar (Sí) | `getOrdersAction` |
| **Pedidos** | `orders.create` | Crear Pedido | Auxiliar (Sí) | `createOrderAction` |
| **Pedidos** | `orders.update` | Actualizar Pedido | Auxiliar (Sí) | `updateOrderStatusAction` |
| **Pedidos** | `orders.cancel` | Cancelar Pedido | Owner (No) | `cancelOrderAction` |
| **Clientes** | `customers.view` | Ver Clientes | Auxiliar (Sí) | `getCustomersAction` |
| **Clientes** | `customers.create` | Registrar Cliente | Auxiliar (Sí) | `createCustomerAction` |
| **Clientes** | `customers.update` | Editar Cliente | Auxiliar (Sí) | `updateCustomerAction` |
| **Clientes** | `customers.delete` | Eliminar Cliente | Owner (No) | `deleteCustomerAction` |

---

## 3. Override Individual en `public.business_user_permissions`

Cada fila de `business_user_permissions` representa una personalización granular para un trabajador específico en un negocio:

```sql
-- Estructura canónica:
CREATE TABLE public.business_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

- Si `is_granted = true`: El permiso se concede explícitamente al colaborador (solo permitido si es asignable a auxiliares).
- Si `is_granted = false`: El permiso queda explícitamente revocado para ese colaborador, anulando los permisos por defecto de su rol.
- Si no existe fila: Se aplican los permisos por defecto del rol según `DEFAULT_ROLE_PERMISSIONS_MAP`.

---

## 4. Checklist de Verificación para Desarrolladores (Nuevas Server Actions)

Al construir o modificar cualquier Server Action en NEGOVA, verificar:

- [ ] ¿El archivo tiene la directiva `"use server"` en la primera línea?
- [ ] ¿El primer argumento de la acción es `businessId: string`?
- [ ] ¿Se invoca `await verifyWorkspaceAction(businessId, "modulo.accion")` antes de cualquier lectura o escritura en base de datos?
- [ ] ¿Se valida `if (!auth.success || !auth.context)` y se retorna `{ success: false, error: auth.error }`?
- [ ] ¿El código de permiso está catalogado en `ALL_PERMISSION_MODULES` (`src/lib/auth/permissions.ts`)?
- [ ] ¿El código de permiso está reflejado en `DEFAULT_ROLE_PERMISSIONS_MAP`?
- [ ] ¿Las mutaciones sensibles (anular ventas, eliminar gastos/proveedores, arqueos y administración de cajas) tienen `minRoleLevel: "owner"`?
- [ ] ¿Existen pruebas unitarias que garanticen que la acción falla sin autenticación y sin permisos?
