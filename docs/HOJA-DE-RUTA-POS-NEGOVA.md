# Hoja de ruta de construcción del POS de NEGOVA

**10 etapas · Desde la auditoría hasta las pruebas integrales**

---

### Etapa 0. Auditoría e integración
*(Primera)*

- **Descripción:** Revisar el catálogo, el POS de ventas, pedidos, mesas, preparación, pagos, base de datos, permisos y RLS. Determinar qué existe, qué funciona y qué falta, sin modificar archivos durante el diagnóstico.
- **Resultado:** Plan técnico de implementación aprobado antes de programar.
- **Estado:** `Completada / Diagnóstico Listo` ✅

---

### Etapa 1. Catálogo de productos
- **Descripción:** Gestionar categorías, platos, bebidas, precios, imágenes, disponibilidad, complementos y extras. Reutilizar el catálogo existente si cumple los requisitos, sin crear otro sistema paralelo.
- **Estado:** `Completada / Integrada al POS` ✅

---

### Etapa 2. POS y selección del pedido
- **Descripción:** Construir o adaptar la pantalla de venta para seleccionar platos, cambiar cantidades, elegir complementos, calcular subtotales y visualizar el total antes de registrar el pedido. Adaptación mobile-first (320px–430px) con barra inferior persistente y drawer dedicado.
- **Estado:** `Completada / Implementada` ✅

---

### Etapa 3. Registro y destino del pedido
- **Descripción:** Registrar pedidos presenciales y de WhatsApp. Diferenciar el canal de entrada del destino: consumo en mesa (actualizando ocupación), para llevar (con datos de quien recoge) o domicilio (con dirección y datos de entrega). Persistencia transaccional atómica con snapshot de precios históricos e idempotencia.
- **Estado:** `Completada / Implementada` ✅

---

### Etapa 4. Mesas y cuentas abiertas
- **Descripción:** Asociar el primer pedido a una mesa, abrir su cuenta y permitir agregar consumos posteriores. Al pagar y cerrar la cuenta, liberar la mesa.
- **Estado:** `Pendiente` 📋

---

### Etapa 5. Cola única de pedidos
- **Descripción:** Mostrar pedidos de todos los canales en orden de llegada, con sus artículos, destino y estado. No dar prioridad automática a WhatsApp ni a los pedidos presenciales.
- **Estado:** `Pendiente` 📋

---

### Etapa 6. Preparación y entrega
- **Descripción:** Gestionar los estados del pedido hasta su entrega o recogida, adaptados al funcionamiento real del establecimiento, sin imponer zonas físicas que no existen.
- **Estado:** `Pendiente` 📋

---

### Etapa 7. Pagos y cierre de cuentas
- **Descripción:** Registrar efectivo, transferencias verificadas y pagos mixtos. Separar el importe de los alimentos del domicilio cuando corresponda, controlar saldos pendientes y cerrar las cuentas correctamente.
- **Estado:** `Pendiente` 📋

---

### Etapa 8. Integración administrativa
- **Descripción:** Integrar las operaciones con ventas, caja, gastos y reportes existentes, evitando registrar dos veces una misma venta o ingreso.
- **Estado:** `Pendiente` 📋

---

### Etapa 9. Pruebas integrales
- **Descripción:** Verificar el flujo completo, persistencia, permisos, aislamiento entre negocios, RLS, límites del plan, cálculos y regresiones en funcionalidades que ya existían.
- **Estado:** `Pendiente` 📋
