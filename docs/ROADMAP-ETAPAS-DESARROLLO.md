# Hoja de Ruta de Desarrollo y Validación — NEGOVA

Documento de seguimiento secuencial por etapas de implementación y pruebas de aceptación para el flujo operativo del negocio.

---

### 1. Usuarios y roles
- **Estado:** `Base lista` ✅
- **Descripción:** Accesos, permisos y acciones autorizadas para cada trabajador según su rol y configuración individual.

---

### Etapa 1 · Siguiente

### 2. Productos y menú
- **Estado:** `En progreso / Siguiente` ⏳
- **Descripción:** Crear categorías, productos, precios, disponibilidad y opciones o complementos cuando correspondan.
- **Prueba de validación:** Crear una salchipapa, modificar su precio, desactivarla y comprobar que los datos se guardan y reflejan correctamente.

---

### 3. Mesas y cuentas
- **Estado:** `Pendiente` 📋
- **Descripción:** Crear la cantidad de mesas que necesite el negocio, consultar su estado en tiempo real y gestionar las cuentas abiertas.
- **Prueba de validación:** Una mesa permanece libre hasta que se registra el primer pedido asociado a ella.

---

### 4. Pedidos
- **Estado:** `Pendiente` 📋
- **Descripción:** Registrar pedidos presenciales y de WhatsApp, elegir productos, asociar una mesa cuando corresponda y agregar pedidos adicionales a una cuenta abierta.
- **Prueba de validación:** Registrar pedidos de ambos canales (presencial y WhatsApp) y comprobar que aparecen en una sola cola unificada ordenada por hora de llegada.

---

### 5. Preparación y entrega
- **Estado:** `Pendiente` 📋
- **Descripción:** Consultar los pedidos pendientes (pantalla de cocina/KDS), actualizar su estado de preparación y gestionar la entrega al cliente (en mesa, para llevar o despacho a domicilio).
- **Prueba de validación:** Verificar que los cambios de estado se reflejen correctamente sin perder productos, modificaciones ni observaciones del cliente.

---

### 6. Cobros, pagos y ventas
- **Estado:** `Pendiente` 📋
- **Descripción:** Registrar pagos en efectivo y transferencias verificadas, separar el valor de la comida del costo del domicilio cuando aplique, calcular saldos pendientes y cerrar cuentas.
- **Prueba de validación:** Una cuenta con varios pedidos se cobra correctamente y, al cerrarla definitivamente, libera la mesa correspondiente.

---

### 7. Comprobantes
- **Estado:** `Pendiente` 📋
- **Descripción:** Consultar y generar comprobantes vinculados a la venta y al pago correspondiente con numeración correlativa.

---

### 8. Gastos y finanzas
- **Estado:** `Pendiente` 📋
- **Descripción:** Registrar gastos operativos reales, consultar ingresos y egresos, y calcular resultados financieros a partir de los movimientos registrados.

---

### 9. Reportes
- **Estado:** `Pendiente (Temporal)` 📋
- **Descripción:** Comprobar ventas, gastos, productos más vendidos, medios de pago y resultados por período, utilizando datos reales.
- **Nota de alcance:** *Este módulo se mantendrá temporalmente para verificación y se eliminará/depurará cuando se complete todo el flujo operativo.*
