# Fase 10 — Pruebas de Integración, E2E y Regresión

**Objetivo:** Validar que todos los módulos funcionan correctamente de forma aislada y en conjunto, con aislamiento multiempresa garantizado.  
**Depende de:** Fases 1-9 (todos los módulos implementados)  
**Prioridad general:** P3 (refinamiento)

---

## Tareas

### TEST-001 — Pruebas E2E de todos los flujos principales
**ID:** TEST-001 | **Prioridad:** P3 | **Dependencias:** Todas las fases previas | **Estado:** Completada (7/7 flujos aprobados, 10.2s)  

**Alcance:**
- Framework: Playwright (`@playwright/test`)
- **Flujos a cubrir (mínimo):**

  1. **Flujo POS completo:**
     - Login → Abrir caja → Buscar producto → Agregar al carrito → Aplicar modificadores → Cobrar en efectivo → Verificar cambio → Confirmar venta → Imprimir ticket → Verificar en historial de ventas
  2. **Flujo de mesa:**
     - Login → Ir a mesas → Iniciar orden en mesa → Agregar productos → Enviar comanda → Agregar más productos → Cobrar con tarjeta → Liberar mesa → Verificar en ventas
  3. **Flujo de domicilio:**
     - Cliente pide por menú QR → Notificación al negocio → Aceptar pedido → Asignar repartidor → Marcar en camino → Entregar con PIN → Verificar cierre
  4. **Flujo de inventario:**
     - Crear producto con stock → Vender producto → Verificar que stock se redujo → Registrar entrada de inventario → Verificar que stock aumentó
  5. **Flujo de compra:**
     - Crear proveedor → Crear orden de compra → Confirmar → Verificar entrada en inventario → Verificar cuenta por pagar
  6. **Flujo de cierre de caja:**
     - Abrir turno → Realizar 3 ventas → Registrar gasto → Cerrar turno → Verificar montos coinciden → Exportar cierre
  7. **Flujo de cliente con crédito:**
     - Crear cliente → Venta a crédito → Verificar cuenta por cobrar → Registrar abono → Verificar saldo actualizado

- Cada flujo es un archivo de test independiente
- Variables de entorno para credenciales de prueba
- Seeds de datos para entorno de testing

**Criterios de aceptación:**
- [x] Los 7 flujos pasan en ejecución consecutiva sin intervención manual
- [x] El tiempo total de ejecución es menor a 10 minutos (10.2s)
- [x] Cada test limpia sus datos al finalizar (o usa datos aislados con seed único)
- [x] Los tests se pueden ejecutar con `npm run test:e2e`

---

### TEST-002 — Pruebas de aislamiento multiempresa
**ID:** TEST-002 | **Prioridad:** P3 | **Dependencias:** SEC-001, PERM-001  

**Alcance:**
- **Objetivo:** Verificar que RLS aísla completamente los datos entre negocios
- **Setup:** Crear 2 negocios de prueba (A y B) con usuarios diferentes
- **Tests por tabla crítica:**

  | Tabla | Test |
  |-------|------|
  | products | Usuario A NO puede ver/editar productos de B via client |
  | categories | Usuario A NO puede ver categorías de B |
  | restaurant_orders | Usuario A NO puede ver órdenes de B |
  | business_sale_documents | Usuario A NO puede ver ventas de B |
  | customers | Usuario A NO puede ver clientes de B |
  | business_users | Usuario A NO puede ver empleados de B |
  | inventory_stock | Usuario A NO puede ver stock de B |
  | cash_sessions | Usuario A NO puede ver turnos de B |
  | delivery_orders | Usuario A NO puede ver domicilios de B |

- **Tests de server actions:**
  - Llamar action con `businessId` de otro negocio → debe retornar error 403
  - Llamar action sin sesión → debe retornar error 401
  - Llamar action con rol sin permiso → debe retornar error 403

- **Tests de rutas públicas:**
  - Menú QR de negocio A no muestra productos de negocio B
  - Seguimiento de domicilio solo funciona con código válido del negocio correcto

**Criterios de aceptación:**
- TODAS las tablas con `business_id` tienen RLS activo con filtro correcto
- Ningún usuario puede acceder a datos de un negocio al que no pertenece
- Las server actions rechazan correctamente `businessId` no autorizado
- Se documenta la lista completa de tablas y su estado RLS

---

### TEST-003 — Pruebas de regresión de módulos existentes
**ID:** TEST-003 | **Prioridad:** P3 | **Dependencias:** Todas las fases previas  

**Alcance:**
- **Objetivo:** Verificar que los módulos que ya funcionan no se rompen con los cambios de las fases 1-9
- **Módulos a verificar:**

  1. **Menú QR público:**
     - Las 4 plantillas siguen renderizando correctamente
     - El carrito funciona con modificadores
     - El checkout envía notificación por WhatsApp
     - Los estilos de cada plantilla no se perdieron
  2. **Gestión de mesas:**
     - CRUD de mesas funciona
     - QR de mesa genera y se puede escanear
     - Revocación de QR invalida el código anterior
     - Abrir y cerrar orden de mesa funciona
  3. **Productos y categorías:**
     - CRUD completo sin errores
     - Las imágenes se suben y muestran correctamente
     - Los límites de plan siguen aplicándose
     - Los filtros y búsqueda funcionan
  4. **Portal de repartidor:**
     - Login con token criptográfico funciona
     - Verificación con PIN funciona
     - Anti-brute-force activo (bloqueo tras 5 intentos)
  5. **Roles y permisos:**
     - La matriz de permisos se edita correctamente
     - Los permisos individuales (overrides) funcionan
     - Los cambios de permisos se reflejan inmediatamente

- **Ejecución:** tests unitarios por módulo + tests de componentes con Testing Library
- **Regla:** si un test de regresión falla después de un cambio, el cambio NO se despliega hasta corregir

**Criterios de aceptación:**
- Los 5 módulos existentes pasan todas sus pruebas de regresión
- No hay errores de consola en navegación normal por el workspace
- Las migraciones nuevas no rompen las existentes (rollback funciona)
- Se establece un script `npm run test:regression` que ejecuta todas las pruebas

