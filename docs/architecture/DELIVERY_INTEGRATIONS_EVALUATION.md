# Evaluación de Integraciones Externas de Delivery (Rappi, Justo, Uber Eats) [DOM-005 / DEC-007]

## 1. Contexto y Objetivos

NEGOVA cuenta actualmente con un sistema nativo de gestión de pedidos a domicilio (**Fase 7: Domicilios**):
- Zonas de entrega con polígonos, radios y tarifas dinámicas (`delivery_zones`).
- Portal de despacho para operadores con asignación de repartidores y cálculo de tiempos.
- Vista web mobile-first para repartidores con verificación por PIN de entrega.
- Seguimiento de pedidos para clientes finales en tiempo real sin revelar datos sensibles.
- Cero comisiones por pedido (incluido dentro de la suscripción SaaS de NEGOVA).

El objetivo de esta evaluación es analizar la viabilidad técnica, operativa y financiera de integrar plataformas agregadoras de terceros (**Rappi**, **Justo**, **Uber Eats**) en el ecosistema de NEGOVA.

---

## 2. Análisis Comparativo de Plataformas

| Criterio | NEGOVA Domicilios Propios | Justo (Canal Propio Tercerizado) | Rappi (Marketplace / Connect) |
|---|---|---|---|
| **Modelo Comercial** | SaaS con tarifa fija mensual ($0 comisión por venta) | Comisión por pedido (~10% - 15%) + tarifa mensual | Comisión por pedido marketplace (18% - 25% + IVA) |
| **Propiedad del Cliente** | 100% del negocio (base de datos, WhatsApp, CRM) | Compartida (acceso a teléfono y correo) | 0% del negocio (datos enmascarados por Rappi) |
| **Logística / Flota** | Repartidores propios o mensajería aliada local | Flota propia o red logística Justo integrada | Rappi repartidores (Rappi Prime / Turbo) |
| **Integración Técnica** | Nativa en PostgreSQL / Supabase Realtime | API REST con Webhooks de pedidos | Rappi Connect / Orders API + Webhooks |
| **Latencia de Pedidos** | Instantánea (<200ms) | Depende de Webhook externo (1-5s) | Depende de Webhook externo (2-10s) |

---

## 3. Requisitos Técnicos de Integración (API & Webhooks)

### 3.1. Rappi Connect / Orders API
- **Autenticación:** OAuth 2.0 con Client ID y Client Secret gestionados en Rappi Partners Portal.
- **Flujo de Recepción de Pedidos:**
  1. Rappi dispara un webhook `POST /api/integrations/rappi/orders` con payload JSON del pedido.
  2. NEGOVA valida el header de firma HMAC-SHA256 (`x-rappi-signature`).
  3. Inserción atómica en `delivery_orders` con `origin = 'rappi'` y `external_order_id`.
  4. Envío automático a la cocina (KDS) y asignación al canal correspondiente.
- **Sincronización de Catálogo:**
  - Endpoint `PUT /api/integrations/rappi/menu` para actualizar precios, disponibilidad de ítems y modificadores.
- **Actualización de Estados:**
  - NEGOVA debe emitir llamadas a la API de Rappi (`cooking`, `ready_for_pickup`, `dispatched`) para notificar a los repartidores de Rappi.

### 3.2. Justo API
- **Autenticación:** API Key por negocio en header `Authorization: Bearer <JUSTO_API_KEY>`.
- **Flujo:** Similar a Rappi mediante Webhook bidireccional.
- **Ventaja:** Permite inyectar la flota propia del negocio o activar despachos bajo demanda.

---

## 4. Análisis Financiero y de Viabilidad

1. **Margen Operativo para Restaurantes:**
   - La comisión de agregadores (18-25%) erosiona gravemente el margen neto en negocios de comidas rápidas y restaurantes medianos (margen neto habitual: 10-15%).
   - Para un ticket de $50,000 COP:
     - En Rappi: el restaurante recibe aprox. $37,500 COP tras comisión e IVA de comisión.
     - En NEGOVA: el restaurante recibe el 100% ($50,000 COP) pagando su tarifa fija mensual.
2. **Estrategia Recomendada para Negocios NEGOVA (Modelo Híbrido):**
   - **Canal de Adquisición:** Usar agregadores (Rappi) exclusivamente como vitrina para captación de clientes nuevos.
   - **Fidelización y Retención:** Migrar clientes recurrentes al Menú QR / Catálogo Digital de NEGOVA ofreciendo promociones exclusivas y precios preferenciales.
   - **Fase de Implementación:** Las integraciones directas por API deben mantenerse como módulo adicional (P3/Add-on) para planes superiores o mediante conectores universales (Hubster / Otter).

---

## 5. Guía de Configuración Paso a Paso para el Usuario

En la ruta `/workspace/[businessId]/configuracion` (sección Domicilios & Canales Externos):

1. **Paso 1: Definir política de precios por canal:**
   - Configurar recargo porcentual (markup de 15-20%) en productos destinados a agregadores para absorber la comisión externa sin afectar la rentabilidad.
2. **Paso 2: Registro de Credenciales de Integración:**
   - En el panel de partners de Rappi/Justo, generar las credenciales de API (Store ID, Client ID, Client Secret).
   - Ingresar los tokens en la configuración del negocio.
3. **Paso 3: Mapeo de Categorías y Menú:**
   - Asignar qué categorías de NEGOVA estarán activas para despacho en plataformas externas.
4. **Paso 4: Verificación de Webhooks:**
   - Probar recepción de orden de prueba en el KDS y validar que se descuente el inventario de recetas automáticamente.

---

## 6. Conclusión y Dictamen Arquitectónico

- **Dictamen:** Viable técnicamente pero subordinado al modelo directo de NEGOVA.
- **Prioridad:** Se mantiene en P3 como conector desacoplado, garantizando que el núcleo de NEGOVA mantenga máxima autonomía operativa y cero dependencias críticas de terceros.
- **Estado de Tarea:** **Completada** ([DOM-005](#dom-005)).
