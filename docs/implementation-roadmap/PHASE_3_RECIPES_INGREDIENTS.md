# Fase 3 — Recetas, Ingredientes y Mermas

**Objetivo:** Implementar el control de ingredientes vinculado al inventario y las recetas vinculadas a productos.  
**Depende de:** Fase 2 (inventario normalizado)  
**Prerequisito de:** Descuento correcto de ingredientes al vender, reportes de costos

---

## Tareas

### REC-001 — Crear modelo y servicio de ingredientes
**ID:** REC-001 | **Prioridad:** P1 | **Dependencias:** INV-001  

**Problema:** Los ingredientes son texto libre en `metadata.ingredients`. No hay tabla normalizada.  
**Objetivo:** Crear el modelo de ingredientes como productos tipo "ingrediente" con control de stock.

**Alcance:**
- Los ingredientes se crean como productos con `product_type = 'ingredient'` (reusar tabla `products`)
- O bien crear tabla dedicada `ingredients` (id, business_id, name, unit, cost_per_unit, track_stock, location_id)
- Servicio: `src/lib/recipes/recipe-service.ts`
- UI: pestaña "Ingredientes" accesible desde el módulo de productos
  - Listado con stock, costo, unidad de medida
  - Modal "Crear Nuevo Ingrediente": nombre, unidad (kg/g/lt/ml/unidad), costo por unidad, stock inicial, stock mínimo/máximo, ubicación
  - Canales de visibilidad (POS, QR, Mesas, Domicilios)

**Decisión pendiente (DEC-009):** ¿Ingredientes como productos tipo `ingredient` o tabla separada `ingredients`? Recomendación: usar la tabla `products` con `product_type = 'ingredient'` para reusar toda la infraestructura de inventario (INV-001).

**Criterios de aceptación:**
- Se puede crear un ingrediente con nombre, unidad, costo y stock inicial
- El ingrediente aparece en el inventario con movimientos normales
- El ingrediente no aparece en el menú QR ni POS (salvo configuración expresa)
- Stock del ingrediente se gestiona via INV-003 (movimientos de inventario)

---

### REC-002 — Implementar recetas vinculadas a productos
**ID:** REC-002 | **Prioridad:** P1 | **Dependencias:** REC-001  

**Alcance:**
- Migración: crear tablas
  ```sql
  recipes (
    id, business_id, product_id REFERENCES products, 
    name, description, portions INT DEFAULT 1, 
    prep_time_minutes INT, location_id REFERENCES locations, 
    status, created_at
  )
  recipe_ingredients (
    id, recipe_id REFERENCES recipes, 
    ingredient_id REFERENCES products, -- o ingredients
    quantity NUMERIC NOT NULL, unit TEXT, 
    is_optional BOOLEAN DEFAULT false, 
    sort_order INT
  )
  ```
- UI: Modal "Crear Nueva Receta" con flujo de 3 pasos:
  1. **Información:** Producto asociado (buscador), nombre de receta, descripción, ubicación, porciones, tiempo de preparación
  2. **Ingredientes:** Buscador de ingredientes/productos, cantidad, unidad, marcar como opcional, botón "+ Agregar". Lista de ingredientes con subtotal.
  3. **Resumen:** Producto asociado, costo total por porción, ingredientes desglosados, "¿Cuánto me alcanza?" (stock / cantidad = porciones posibles)
- Ruta: pestaña "Recetas" en el módulo de productos

**Reglas de negocio:**
- Un producto puede tener máximo 1 receta activa
- La receta define cuántos ingredientes se consumen por cada porción vendida
- El costo por porción = Σ(cantidad × costo_unitario_ingrediente) / porciones
- Los ingredientes opcionales no afectan el costo base

**Criterios de aceptación:**
- Se puede crear una receta con 3 ingredientes y 2 porciones
- El costo por porción se calcula correctamente
- "¿Cuánto me alcanza?" retorna el mínimo entre (stock_ingrediente / cantidad_requerida) para todos los ingredientes no opcionales
- La receta aparece vinculada al producto en la ficha del producto

---

### REC-003 — Descuento de ingredientes al vender
**ID:** REC-003 | **Prioridad:** P1 | **Dependencias:** REC-002, STOCK-001  

**Alcance:**
- Modificar la RPC `create_restaurant_pos_order` (o el servicio de stock) para:
  1. Cuando se vende un producto CON receta activa: descontar los ingredientes proporcionalmente
  2. `descuento = cantidad_vendida × (cantidad_ingrediente_por_porción / porciones)`
  3. Crear `inventory_movements` tipo `sale` para cada ingrediente descontado
  4. Si un ingrediente no tiene stock suficiente: retornar error indicando cuál ingrediente falta

**Reglas de negocio:**
- El descuento debe ser transaccional (todo o nada)
- Los ingredientes opcionales NO se desuentan automáticamente
- Si el producto no tiene receta, se descuenta el stock del producto directamente (comportamiento actual)

**Criterios de aceptación:**
- Al vender 2 unidades de un producto con receta (1 porción, 0.5kg harina + 2 huevos):
  - Se desuentan 1kg de harina y 4 huevos del inventario
  - Se crean 2 movimientos de inventario (uno por ingrediente)
- Si la harina solo tiene 0.3kg: la venta se rechaza con mensaje "Existencias insuficientes para «Harina». Disponibles: 0.3 kg, requeridas: 1 kg"
- Si la receta tiene un ingrediente opcional sin stock, la venta se permite

---

### REC-004 — Cálculo de rendimiento y disponibilidad
**ID:** REC-004 | **Prioridad:** P1 | **Dependencias:** REC-002  

**Alcance:**
- Función "¿Cuánto me alcanza?" en la ficha de receta:
  - Para cada ingrediente no opcional: calcular `stock_disponible / cantidad_por_porción`
  - El cuello de botella es el ingrediente con menor rendimiento
  - Mostrar: porciones posibles, ingrediente cuello de botella, stock restante proyectado
- En la ficha de producto: si tiene receta, mostrar "Porciones disponibles: X" basado en el cálculo anterior
- En el POS: si un producto con receta no tiene suficientes ingredientes, marcarlo como "Agotado" automáticamente

**Criterios de aceptación:**
- Si tengo 2kg de harina (receta usa 0.5kg/porción) y 3 huevos (receta usa 2/porción): disponibilidad = 1.5 porciones → "1 porción disponible" (truncar al entero)
- El cuello de botella se identifica como "Huevos (alcanza para 1.5 porciones)"
- Un producto cuyo cuello de botella es 0 porciones aparece como "Agotado" en el POS

---

## Criterios de Finalización de Fase 3
- [ ] Se pueden crear ingredientes con control de stock
- [ ] Se pueden crear recetas vinculadas a productos con ingredientes y cantidades
- [ ] Al vender un producto con receta, los ingredientes se desuentan atómicamente
- [ ] La disponibilidad de productos con receta refleja el stock real de ingredientes
- [ ] El cálculo de costo por porción es correcto y verificable

