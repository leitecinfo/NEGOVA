# Fase 9 — Configuración Avanzada, Suscripciones y Canales Digitales

**Objetivo:** Completar la configuración del negocio, aplicar límites de plan en servidor, habilitar canales digitales y preparar integraciones externas.  
**Depende de:** Fases 1-6 (módulos base funcionales)  
**Prioridad general:** P2 (mejoras) y P3 (opcionales)

---

## Tareas

### CONF-001 — Completar configuración de unidades y conversiones
**ID:** CONF-001 | **Prioridad:** P2 | **Dependencias:** INV-001 | **Estado:** Completada (15/15 tests aprobados)  

**Alcance:**
- Ruta: `/workspace/[businessId]/configuracion/unidades`
- Migración: tabla `measurement_units` (business_id, name, abbreviation, type, is_base, conversion_factor, base_unit_id)
  - Tipos: `weight`, `volume`, `length`, `count`
  - Unidades base predeterminadas: kg, litro, metro, unidad
  - Conversiones: 1 kg = 1000 g, 1 litro = 1000 ml, etc.
- UI:
  - Lista de unidades del negocio con tipo, abreviación y factor de conversión
  - Modal "Nueva unidad": nombre, abreviación, tipo, unidad base, factor de conversión
  - Edición y eliminación (con validación: no eliminar si se usa en recetas/productos)
  - Unidades predeterminadas del sistema no eliminables
- Integración: los selectores de unidad en productos, ingredientes y recetas usan esta tabla

**Criterios de aceptación:**
- Al crear un negocio, se generan las unidades base automáticamente
- Se puede crear "lb" como unidad de peso con conversión 1 lb = 0.4536 kg
- No se puede eliminar una unidad que está en uso por un ingrediente
- Los selectores de unidad en recetas muestran las unidades del negocio

---

### CONF-002 — Completar configuración de impresión y estaciones
**ID:** CONF-002 | **Prioridad:** P2 | **Dependencias:** CAJ-001  

**Alcance:**
- Ruta: `/workspace/[businessId]/configuracion/impresion`
- Secciones:
  1. **Impresoras registradas:** nombre, tipo (térmica 80mm, 58mm, carta), conexión (USB, red, Bluetooth), estado
  2. **Estaciones de impresión:** vincular impresora a caja y/o área (cocina, barra, caja)
  3. **Plantilla de ticket:** logo, nombre del negocio, NIT, dirección, teléfono, mensaje de pie
  4. **Plantilla de comanda:** formato reducido para cocina (sin precios, con modificadores resaltados)
  5. **Configuración de cajón monedero:** apertura automática al cobrar en efectivo
- Integración con QZ Tray (si se evalúa favorablemente en DEC-005) o window.print() como fallback
- Vista previa del ticket en pantalla antes de configurar

**Criterios de aceptación:**
- Se puede registrar una impresora y vincularla a una caja
- La plantilla de ticket muestra preview con datos reales del negocio
- Al cambiar el logo del negocio, el preview del ticket se actualiza
- La comanda de cocina no muestra precios pero sí modificadores

---

### CONF-003 — Implementar gestión de plantillas de notificación
**ID:** CONF-003 | **Prioridad:** P2 | **Dependencias:** Ninguna  

**Alcance:**
- Ruta: `/workspace/[businessId]/configuracion/notificaciones`
- Eventos notificables:
  - Nuevo pedido de menú QR
  - Pedido de domicilio aceptado/en camino/entregado
  - Stock bajo alcanzado
  - Turno de caja cerrado
  - Cuenta por cobrar vencida
- Por cada evento:
  - Toggle activar/desactivar
  - Canal: WhatsApp (plantilla editable), Email (plantilla editable), Push (futuro)
  - Destinatarios: roles que reciben la notificación
- Persistir en `businesses.settings.notifications` o tabla dedicada

**Criterios de aceptación:**
- Se puede activar la notificación "Nuevo pedido QR" por WhatsApp
- Se puede editar el texto de la plantilla con variables ({cliente}, {total}, {productos})
- Se puede desactivar una notificación sin eliminar la configuración
- Los cambios persisten al recargar

---

### SUB-001 — Implementar límites de plan en servidor para todos los recursos
**ID:** SUB-001 | **Prioridad:** P2 | **Dependencias:** Ninguna (mejorar lo existente) | **Estado:** Completada (13/13 tests aprobados)  

**Alcance:**
- **Estado actual:** `products-service.ts` ya verifica límites de plan para productos usando `checkPlanLimits()`
- **Ampliar a todos los recursos:**
  - Empleados por negocio
  - Ubicaciones/sucursales
  - Cajas registradoras
  - Documentos de venta por mes
  - Recetas
  - Clientes (si aplica por plan)
- Crear tabla `plan_limits` o definir en código:
  ```
  STARTER: { products: 50, employees: 3, locations: 1, registers: 1, recipes: 20 }
  PROFESSIONAL: { products: 500, employees: 15, locations: 3, registers: 5, recipes: 200 }
  ENTERPRISE: { products: -1, employees: -1, locations: -1, registers: -1, recipes: -1 }
  ```
- Cada server action de creación debe verificar el límite antes de insertar
- Respuesta clara al usuario cuando se alcanza el límite: "Has alcanzado el límite de X en tu plan. Mejora tu plan para continuar."

**Criterios de aceptación:**
- Un negocio en plan STARTER no puede crear el empleado #4 (límite 3)
- El mensaje de error indica qué recurso está limitado y cuál es el límite
- Un negocio en ENTERPRISE no tiene restricciones numéricas
- Los límites se verifican en servidor (no solo en UI)

---

### SUB-002 — Implementar widget de plan/límites en UI
**ID:** SUB-002 | **Prioridad:** P2 | **Dependencias:** SUB-001  

**Alcance:**
- Widget en sidebar (parte inferior): muestra plan actual, uso y límites
  - "Plan Profesional" con badge
  - Barras de progreso: "Productos: 45/500", "Empleados: 8/15"
  - Enlace "Mejorar plan" → página de suscripción
- Badge de alerta cuando un recurso está al 80%+ del límite
- Tooltip con detalle al hacer hover en cada barra
- En la página de configuración del negocio: sección "Tu plan" con tabla completa de límites y uso actual

**Criterios de aceptación:**
- El widget muestra el nombre del plan y las barras de uso
- Al alcanzar el 80% de un recurso, la barra cambia a color de advertencia (amarillo)
- Al alcanzar el 100%, la barra es roja y muestra "Límite alcanzado"
- El enlace "Mejorar plan" lleva a la página de suscripción

---

### DIAN-001 — Configurar facturación electrónica DIAN
**ID:** DIAN-001 | **Prioridad:** P3 | **Dependencias:** INT-001, DEC-007 (proveedor de facturación)  
**Estado:** Bloqueada (requiere DEC-007)

**Alcance:**
- Ruta: `/workspace/[businessId]/configuracion/facturacion-electronica`
- **Prerequisito:** Decidir proveedor de facturación electrónica (DEC-007): Siigo, Alegra, FacturAPI, propio
- Secciones:
  1. **Datos del emisor:** NIT, DV, razón social, dirección, régimen tributario, responsabilidad fiscal
  2. **Resolución de facturación:** número, rango autorizado (desde-hasta), fecha de vigencia
  3. **Prefijo y consecutivo:** prefijo de factura, consecutivo actual
  4. **Conexión con proveedor:** API key, credenciales del proveedor seleccionado
  5. **Pruebas:** botón "Enviar factura de prueba a DIAN" en modo habilitación
- Al confirmar una venta con factura: enviar al proveedor → recibir CUFE → almacenar respuesta
- Tipos de documento: Factura de venta, Nota crédito, Nota débito

**Criterios de aceptación:**
- Se puede configurar los datos del emisor y resolución
- Se envía una factura de prueba exitosamente al proveedor
- Al cobrar una venta con "Generar factura electrónica", el CUFE se almacena
- Las notas crédito (anulaciones) se envían correctamente a DIAN
- Los documentos electrónicos se pueden consultar en el historial de ventas

---

### CONF-004 — Implementar 2FA
**ID:** CONF-004 | **Prioridad:** P3 | **Dependencias:** Ninguna  

**Alcance:**
- Ruta: `/workspace/[businessId]/configuracion/seguridad` (o en perfil de usuario)
- Implementar autenticación de dos factores usando Supabase Auth MFA:
  - Registro de factor TOTP (Google Authenticator, Authy)
  - QR code para escanear
  - Códigos de respaldo (recovery codes)
  - Verificación obligatoria al iniciar sesión si 2FA está activo
- Toggle por usuario: "Activar verificación en dos pasos"
- Opción de negocio: "Requerir 2FA para administradores"

**Criterios de aceptación:**
- Un usuario puede activar 2FA escaneando un QR con Google Authenticator
- Al iniciar sesión con 2FA activo, se solicita el código de 6 dígitos
- Los códigos de respaldo funcionan como alternativa al TOTP
- Un administrador puede requerir 2FA obligatorio para roles administrativos

---

### CONF-005 — Crear página de enlaces tipo Linktree
**ID:** CONF-005 | **Prioridad:** P3 | **Dependencias:** Ninguna  

**Alcance:**
- Ruta pública: `/negocio/[slug]` o `/links/[slug]`
- Configuración: `/workspace/[businessId]/configuracion/pagina-enlaces`
- Campos:
  - Nombre del negocio, logo, descripción corta, color/tema
  - Lista de enlaces: título, URL, ícono, orden, activo/inactivo
  - Enlaces predefinidos: "Ver menú", "Pedir domicilio", "WhatsApp", "Instagram", "Google Maps"
- Vista pública responsive: logo arriba, lista de botones de enlaces centrados, pie con "Powered by NEGOVA"
- El slug se configura en los datos del negocio

**Criterios de aceptación:**
- Se puede configurar 5 enlaces con título, URL e ícono
- La página pública muestra los enlaces ordenados con el branding del negocio
- Los enlaces inactivos no se muestran en la página pública
- La página es responsive y carga en menos de 2 segundos
- El enlace "Ver menú" lleva al menú QR público del negocio

---

### FID-001 — Implementar sistema de puntos de fidelización
**ID:** FID-001 | **Prioridad:** P3 | **Dependencias:** CLI-001, INT-001 | **Estado:** Completada (14/14 tests aprobados)  

**Alcance:**
- Migración: tabla `loyalty_points` (business_id, customer_id, points_balance, total_earned, total_redeemed)
- Migración: tabla `loyalty_transactions` (business_id, customer_id, points, type, reference_id, created_at)
- Configuración:
  - Puntos por cada $X pesos gastados (ej: 1 punto por cada $1.000)
  - Valor de redención: X puntos = $Y de descuento
  - Activar/desactivar programa de fidelización
- Flujo:
  - Al completar una venta con cliente identificado → acumular puntos
  - En POS: botón "Redimir puntos" → consultar saldo → aplicar descuento
- UI cliente: en perfil del cliente se ve saldo de puntos e historial

**Criterios de aceptación:**
- [x] Al vender $50.000 a un cliente con programa activo (1 pt/$1000), se acumulan 50 puntos
- [x] En POS se puede redimir puntos como descuento
- [x] El saldo del cliente se actualiza atómicamente
- [x] El historial de puntos muestra acumulaciones y redenciones con referencia

---

### HELP-001 — Implementar centro de ayuda en workspace
**ID:** HELP-001 | **Prioridad:** P3 | **Dependencias:** Ninguna  

**Alcance:**
- Ruta: `/workspace/[businessId]/ayuda`
- Secciones:
  1. **Guías rápidas:** artículos cortos por módulo (Cómo crear un producto, Cómo abrir caja, etc.)
  2. **Preguntas frecuentes:** FAQ expandible/colapsable
  3. **Videos tutoriales:** embeds de YouTube/Loom (si existen)
  4. **Contactar soporte:** formulario con asunto, descripción y capturas
- Contenido estático en MDX o JSON (no requiere CMS externo inicialmente)
- Botón "?" flotante en todas las páginas que lleva al centro de ayuda
- Contextual: si el usuario está en POS y hace click en "?", ir a la guía del POS

**Criterios de aceptación:**
- El centro de ayuda muestra al menos 1 artículo por cada módulo principal
- Las FAQs se expanden/colapsan correctamente
- El botón "?" es accesible desde cualquier página del workspace
- El formulario de soporte envía un email al equipo (o registra en BD)

