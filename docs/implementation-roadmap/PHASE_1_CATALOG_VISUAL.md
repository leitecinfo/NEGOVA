# Fase 1 — Fundamentos de Catálogo y Sistema Visual

**Objetivo:** Completar el catálogo de productos con todas las funciones de TuyApp y unificar el sistema visual.  
**Prerequisito de:** Todas las fases posteriores.  
**Dependencias:** Ninguna (es la primera fase).

---

## Tareas de esta Fase

### SEC-001 — Verificar y corregir RLS de products/categories
Ver [TASKS.md#sec-001](TASKS.md) para detalles completos.  
**P0 | Bloquea todo lo demás si hay brecha de seguridad**

---

### NAV-001 — Añadir búsqueda global al workspace
**ID:** NAV-001 | **Prioridad:** P2  
**Módulo:** Navegación  
**Problema:** El workspace no tiene búsqueda global (existe en admin pero no en workspace).  
**Objetivo:** Añadir command palette de búsqueda global al workspace.  
**Alcance:**
- Adaptar `admin-command-palette.tsx` para el workspace
- Buscar en: productos, clientes, pedidos recientes, módulos
- Accesible con `Ctrl+K` / `⌘+K`  
**Componentes afectados:** `workspace-shell.tsx`, nueva `workspace-command-palette.tsx`  
**Criterios de aceptación:**
- Al presionar `Ctrl+K`, aparece el command palette
- Permite buscar productos y navegar a la ficha
- Permite buscar clientes y navegar al perfil
- Resultados se cargan en <500ms

---

### NAV-002 — Widget de suscripción en sidebar (Completada)
**ID:** NAV-002 | **Prioridad:** P2 | **Estado:** Completada  
**Módulo:** Navegación/Suscripciones  
**Problema:** Sin indicador del plan actual y límites en el sidebar.  
**Objetivo:** Añadir widget al final del sidebar mostrando plan y uso actual.  
**Alcance:**
- Leer `session.planId` y `session.enabledFeatures`
- Mostrar: plan actual, días de prueba restantes (si aplica), porcentaje de productos usados
- Botón "Actualizar plan" que lleva a configuración de suscripción  
**Criterios de aceptación:**
- El widget aparece al fondo del sidebar
- Muestra nombre del plan y límites correctos
- El botón "Actualizar" navega a la página de planes

---

### DS-001 — Unificar sistema de diseño (Completada)
**ID:** DS-001 | **Prioridad:** P2 | **Estado:** Completada  
**Módulo:** Sistema de diseño  
**Problema:** Existe duplicación entre `src/components/admin/ui/` y `src/components/ui/`. Los módulos del workspace usan ambos de forma inconsistente.  
**Objetivo:** Todos los módulos del workspace usan exclusivamente `src/components/ui/`.  
**Alcance:**
- Inventario de componentes duplicados (admin-data-table vs data-table, etc.)
- Plan de migración progresiva: empezar por nuevos módulos, luego migrar existentes
- NO eliminar componentes admin si aún los usa el panel de administración  
**Criterios de aceptación:**
- Los nuevos módulos de Fases 2+ usan solo `src/components/ui/`
- No hay inconsistencias visuales visibles entre módulos

---

### DS-002 — Estados de carga/error/vacío consistentes (Completada)
**ID:** DS-002 | **Prioridad:** P2 | **Estado:** Completada  
**Módulo:** Sistema de diseño  
**Problema:** Los componentes `loading-skeleton.tsx`, `empty-state.tsx`, `error-state.tsx` existen pero no se usan consistentemente.  
**Alcance e Implementación:**
- **Auditoría e Integración:** Auditoría completa de los módulos del workspace (`/dashboard`, `/productos` y todas sus pestañas de inventario, `/gastos`, `/proveedores`, `/recetas`, `/cocina`, `/clientes`).
- **Mejora de Primitivas:**
  - `data-table.tsx`: soporte nativo para `errorState`, `emptyState` automático con acción primaria y `TableSkeleton` automático.
  - `error-state.tsx`: soporte para `role="alert"`, `retryLabel`, acción secundaria configurable.
  - `error.tsx` a nivel workspace: conectado con `ErrorState` estándar y reintento.
- **Patrón Estándar:** Documentado en `DESIGN_SYSTEM.md` (Sección 11.3) como requisito obligatorio para nuevos módulos.
- **Pruebas:** Suite unitaria `tests/unit/workspace-ds-002-states.test.tsx` con 16/16 pruebas aprobadas.
**Criterios de aceptación:**
- Todos los módulos muestran skeleton/spinner durante carga
- Todos muestran empty-state con acción primaria cuando no hay datos
- Todos muestran error-state con opción de reintentar cuando hay error

---

### CAT-001 — Subcategorías con categoría padre
**ID:** CAT-001 | **Prioridad:** P1  
**Módulo:** Catálogo  
**Problema:** Las categorías no tienen jerarquía. La tabla `categories` no tiene `parent_category_id`.  
**Objetivo:** Permitir categorías padre e hijo (máximo 2 niveles).  
**Alcance:**
- Migración: añadir columna `parent_category_id UUID REFERENCES categories(id)`
- Actualizar `getCategories()` para incluir categorías padre
- Actualizar modal "Nueva Categoría" con selector de padre  
**Reglas de negocio:**
- Máximo 2 niveles (no recursivo)
- Una subcategoría no puede ser padre de otra  
**Criterios de aceptación:**
- Se puede crear una categoría hijo con padre seleccionado
- El menú QR agrupa productos por categoría padre > hijo
- Los productos de subcategorías aparecen filtrados correctamente

---

### CAT-002 — UI de gestión de variantes de producto
**ID:** CAT-002 | **Prioridad:** P1  
**Módulo:** Catálogo  
**Problema:** Las variantes se almacenan en `metadata.variants` (JSON) pero la UI de gestión no es clara.  
**Objetivo:** UI dedicada para crear, editar y eliminar variantes (tamaños, presentaciones).  
**Alcance:**
- Sección en formulario de producto para gestionar variantes
- Cada variante: nombre, precio, SKU opcional, disponibilidad
- Validar que si el producto tiene variantes, deben seleccionarse en el POS  
**Criterios de aceptación:**
- Se pueden agregar/editar/eliminar variantes desde el formulario de producto
- Al agregar un producto con variantes al carrito del POS, muestra modal de selección de variante
- Los pedidos almacenan la variante seleccionada en `restaurant_order_items`

---

### CAT-003 — UI de grupos de modificadores
**ID:** CAT-003 | **Prioridad:** P1  
**Módulo:** Catálogo  
**Problema:** Los grupos de modificadores están en `metadata.modifier_groups` pero la UI de gestión en el formulario de producto no está completa.  
**Objetivo:** UI completa para crear y gestionar grupos de modificadores con opciones.  
**Alcance:**
- Sección de modificadores en formulario de producto
- Crear grupo: nombre, mínimo selecciones, máximo selecciones, requerido
- Agregar opciones al grupo: nombre, precio adicional, disponibilidad
- Vista de preview de cómo aparece en el POS y menú QR  
**Reglas de negocio:**
- Si un grupo es requerido y mínimo=1, el pedido no puede continuar sin seleccionar
- Los precios adicionales de modificadores se suman al precio base del producto (recalculado en servidor)  
**Criterios de aceptación:**
- Se pueden crear grupos con opciones desde el formulario de producto
- Al agregar producto con modificadores al POS, aparece modal de selección
- La validación de mínimos/máximos funciona en POS y menú QR
- El precio del pedido incluye correctamente los modificadores seleccionados

---

### CAT-004 — Impuestos por producto
**ID:** CAT-004 | **Prioridad:** P1  
**Módulo:** Catálogo  
**Problema:** No hay configuración de IVA por producto.  
**Objetivo:** Permitir configurar el porcentaje de IVA por producto y si el precio incluye el impuesto o no.  
**Alcance:**
- Añadir campos al formulario: `tax_percentage` (ej. 0, 5, 8, 19), `tax_included_in_price` (boolean)
- El POS y menú QR deben mostrar el IVA desglosado en el resumen
- Los documentos de venta deben incluir el desglose de IVA  
**Criterios de aceptación:**
- Se puede configurar el IVA por producto (0%, 5%, 8%, 19%)
- Si "precio incluye IVA", el ticket muestra el IVA desagregado
- Si "precio excluye IVA", el total suma el IVA al checkout

---

### CAT-005 — Control de canales de venta por producto
**ID:** CAT-005 | **Prioridad:** P1  
**Módulo:** Catálogo  
**Problema:** El campo `show_in_qr_menu` existe pero no hay control granular de disponibilidad por canal (POS, QR, tienda online).  
**Objetivo:** Permitir activar/desactivar cada producto en cada canal de venta.  
**Alcance:**
- Campos: `available_in_pos`, `available_in_qr`, `available_online`
- El menú QR solo muestra productos con `available_in_qr = true`
- El POS solo muestra productos con `available_in_pos = true`  
**Criterios de aceptación:**
- Un producto desactivado para QR no aparece en el menú público
- Un producto desactivado para POS no aparece en la pantalla de venta
- Los cambios se reflejan en tiempo real sin necesidad de recargar

---

### CAT-006 — Importación y exportación de productos
**ID:** CAT-006 | **Prioridad:** P1  
**Módulo:** Catálogo  
**Problema:** No existe importación ni exportación de productos.  
**Objetivo:** Permitir importar desde CSV/Excel y exportar el catálogo actual.  
**Alcance:**
- Exportar: botón "Exportar" que genera CSV con todos los productos activos
- Importar: subida de CSV con validación de formato, previsualización antes de confirmar, importación por lotes
- Columnas mínimas: nombre, categoría, precio, costo, SKU, disponible  
**Reglas de negocio:**
- La importación no duplica si el SKU ya existe (actualiza)
- Errores de formato son reportados por fila, no bloquean las filas correctas
- El límite del plan se verifica antes de importar  
**Criterios de aceptación:**
- Se puede descargar el catálogo completo en CSV
- Se puede subir un CSV y ver previsualización antes de importar
- Los errores de importación se muestran por fila con descripción del error
- Los registros sin error se importan aunque haya errores en otros

---

### CAT-007 — Módulo de mermas
**ID:** CAT-007 | **Prioridad:** P1  
**Módulo:** Catálogo/Inventario  
**Problema:** No existe tabla ni módulo de mermas.  
**Objetivo:** Permitir registrar pérdidas de productos e ingredientes con causa, cantidad y costo.  
**Alcance:**
- Migración: crear tabla `spoilage_records` (business_id, item_type: product|ingredient, item_id, item_name, cause, quantity, unit_cost, total_cost, notes, registered_by, date)
- UI: pestaña "Mermas" en el módulo de productos con KPIs y tabla
- Modal "Registrar Merma": tipo (producto/ingrediente), causa (Vencido/Dañado/Derramado/Robado/Otro), cantidad, costo
- Al registrar merma: descontar del inventario de la ubicación correspondiente  
**Criterios de aceptación:**
- Se puede registrar una merma de producto con causa y cantidad
- El stock del producto se descuenta automáticamente
- La merma aparece en el historial de movimientos de inventario
- Los KPIs de mermas (total registros, valor total) son correctos

---

### MEN-001 — Búsqueda de texto en menú QR público (Completada)
**ID:** MEN-001 | **Prioridad:** P2 | **Estado:** Completada  
**Módulo:** Menú QR  
**Problema:** El menú público solo navega por categorías; sin buscador de texto libre.  
**Objetivo:** Añadir buscador de texto en el menú público.  
**Alcance e Implementación:**
- **Input de Búsqueda Superior:** Ubicado en la barra superior sticky en las cuatro plantillas visuales (`UrbanaMenuTemplate`, `ComercialMenuTemplate`, `EleganteMenuTemplate`, `VisualMenuTemplate`) con accesibilidad `aria-label="Buscar productos por nombre"`, icono `Search` y botón rápido de limpieza `X`.
- **Filtro Cliente-Side en Tiempo Real ([`src/lib/menu/category-grouping.ts`](file:///d:/Proyectos/NEGOVA/src/lib/menu/category-grouping.ts)):** Filtrado inmediato por coincidencia de nombre y descripción, insensible a mayúsculas/minúsculas y con normalización diacrítica de acentos/tildes (ej. "cafe" encuentra "Café", "limon" encuentra "Limón"). Auto-conmutación a vista completa para búsqueda global a través de todo el catálogo.
- **Estado Vacío Estandarizado:** Si ningún producto coincide con el término de búsqueda, se despliega el mensaje exacto `"No encontramos productos con ese nombre"` acompañado de un botón interactivo de "Limpiar búsqueda" para restablecer la vista instantáneamente.
- **Pruebas Automatizadas:** Suite unitaria [`tests/unit/workspace-men-001-qr-menu-search.test.tsx`](file:///d:/Proyectos/NEGOVA/tests/unit/workspace-men-001-qr-menu-search.test.tsx) con 14/14 pruebas aprobadas al 100%.
**Criterios de aceptación:**
- Al escribir en el buscador, los productos se filtran por nombre
- Si no hay resultados, muestra mensaje "No encontramos productos con ese nombre"

---

### MEN-002 — Validación de modificadores en menú QR
**ID:** MEN-002 | **Prioridad:** P2  
**Módulo:** Menú QR  
**Problema:** El modal de detalle de producto en el menú QR no valida mínimos/máximos de modificadores.  
**Objetivo:** Validar que los grupos de modificadores requeridos tienen la selección correcta antes de agregar al carrito.  
**Criterios de aceptación:**
- Si un grupo es requerido y no se seleccionó, el botón "Agregar" está deshabilitado con mensaje de error
- Si se seleccionan más opciones de las permitidas, el sistema lo indica

---

## Dependencias de esta Fase

```
SEC-001 → (base de seguridad para todo)
DS-001, DS-002 → (base visual para módulos futuros)
CAT-001, CAT-002, CAT-003 → (prerequisito de POS y Menú QR completos)
CAT-004 → (prerequisito de facturación y reportes de IVA)
CAT-007 → (prerequisito de Fase 2 - Inventario)
```

## Criterios de Finalización de Fase 1
- [ ] SEC-001: RLS de products/categories verificado y correcto
- [ ] Los nuevos módulos de Fase 2+ pueden usar el catálogo completado
- [ ] Sistema visual unificado para nuevos módulos
- [ ] Menú QR funciona correctamente con modificadores validados

