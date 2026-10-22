# NEGOVA — Documento Canónico de Contexto y Arquitectura Integral

> **Propósito de este documento:** Este archivo contiene la especificación completa, conceptual, técnica, de negocio y de estado actual de **NEGOVA**. Está diseñado para servir como fuente única de verdad para el equipo, desarrolladores y asistentes de inteligencia artificial (como ChatGPT o Claude), permitiendo reanudar o contextualizar cualquier sesión de trabajo con total precisión y profundidad.

---

## 1. Resumen Ejecutivo y Ficha Técnica

| Parámetro | Detalle Canónico |
| :--- | :--- |
| **Nombre del Producto** | **NEGOVA** |
| **Definición** | Plataforma SaaS (Software as a Service) multi-tenant orientada a la gestión y digitalización operativa de pequeños comercios. |
| **Propósito Principal** | Ayudar a los pequeños negocios a organizar ventas, gastos, pedidos, inventario y operaciones diarias desde el celular, sustituyendo cuadernos, hojas sueltas y chats caóticos de WhatsApp por herramientas ultra-simples y sin fricción. |
| **Arquitectura de Negocio** | **Core + Verticales** (Núcleo común desacoplado + módulos especializados por tipo de comercio). |
| **Primer Vertical de Validación** | **Restaurantes de comida rápida** (MVP inicial). |
| **Mercado Inicial de Prueba** | **Camarones, La Guajira, Colombia** (validación real en campo en entorno semi-informal). |
| **Mercado Expansivo** | Micro y pequeños negocios familiares en municipios y barrios de Colombia y Latinoamérica. |
| **Modelo de Monetización** | Suscripción SaaS mensual o anual (sin comisiones por venta ni cobros por fletes). |
| **Stack Principal** | Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind CSS, Supabase (PostgreSQL + RLS + Auth + Storage), Google Gemini AI. |

---

## 2. ¿Qué es NEGOVA?

### 2.1 Definición y Filosofía
NEGOVA **no es un software corporativo tradicional ni es exclusivamente para restaurantes**. Es una plataforma modular en la nube pensada específicamente para el comercio minorista e informal: negocios atendidos por sus propios dueños, con estructuras de 1 a 6 colaboradores, que nunca han utilizado un ERP o un sistema POS por considerarlos costosos, difíciles de configurar o dependientes de computadores e impresoras especiales.

### 2.2 Principio de Adaptabilidad Operativa
> *"NEGOVA se adapta a la realidad operativa de cada tipo de pequeño negocio, y no el negocio a NEGOVA."*

Cada tipo de comercio tiene una dinámica particular:
- Un restaurante de comida rápida trabaja con comandas urgentes en horas pico, modificadores de platos ("sin cebolla", "con tocineta"), control de mesas y domiciliarios locales.
- Una barbería gestiona citas, turnos y comisiones de barbero.
- Una tienda de barrio gestiona abarrotes al detalle, cuentas de "fiado" (crédito de confianza) y compras rápidas.

NEGOVA mantiene un **núcleo administrativo universal (CORE)** e introduce **capas de especialización (VERTICALES)** según la actividad comercial seleccionada.

---

## 3. Arquitectura Conceptual: NEGOVA CORE vs. Verticales

```text
                           NEGOVA (Plataforma SaaS)
                                      │
                                   ┌──┴──┐
                                   │     │
                              NEGOVA CORE (Núcleo Común)
                                   │
                   ┌───────────────┼───────────────┬───────────────┐
                   │               │               │               │
              [VERTICAL 1]    [FUTURO]        [FUTURO]        [FUTURO]
              Restaurante     Barberías /     Tiendas de      Farmacias /
              Comida Rápida   Salones         Barrio          Servicios
              (MVP Actual)    (Extensión)     (Extensión)     (Extensión)
```

### A. NEGOVA CORE (Núcleo Transversal)
Capacidades universales compartidas por cualquier comercio registrado:
- **Multi-tenancy:** Aislamiento estricto de datos por `business_id` mediante Row Level Security (RLS).
- **Gestión de Cuentas y Negocios:** Alta de empresas, datos fiscales, perfiles y configuración general.
- **Usuarios y Roles con Permisos Granulares:** Asignación de permisos individuales por módulo (ventas, caja, inventario, gastos, reportes).
- **Catálogo Base de Productos y Servicios:** Nombre, precio, categoría, disponibilidad, stock básico.
- **Gestión de Ventas y Comprobantes:** Registro de ventas, medios de pago (efectivo, Nequi, Daviplata, Bancolombia, tarjeta), comprobantes correlativos y tickets térmicos de 58mm/80mm.
- **Caja y Arqueos Diarios:** Apertura de turno, movimientos de entrada/salida y cierre de caja.
- **Control de Gastos y Egresos:** Registro clasificado de gastos operativos para balance financiero real.
- **Directorio de Clientes y Proveedores:** Historial de consumos, saldos pendientes y créditos.
- **Nómina Básica y Personal:** Registro de turnos, anticipos y pagos a colaboradores.

### B. Vertical Restaurante (MVP Inicial Activo)
Capacidades especializadas para establecimientos gastronómicos y comida rápida:
- **Menú Digital Público Interactivo:** Catálogo web accesible por código QR o enlace directo, con selección de variantes y adicionales.
- **Gestión de Modificadores:** Variantes de tamaño/presentación y grupos de modificadores con reglas de selección (mínimo, máximo, precio delta).
- **Gestión de Mesas y QR Seguros:** Creación de mesas con tokens criptográficos HMAC para evitar pedidos falsificados.
- **Cola Única de Pedidos (KDS / Pantalla de Cocina):** Centralización cronológica de pedidos presenciales, de WhatsApp y del menú digital en una sola cola con estados claros.
- **Control de Domicilios y Fletes:** Desglose independiente entre el costo de los alimentos y el valor del flete para repartidores locales.
- **Integración con WhatsApp:** Asistente inteligente y notificaciones automatizadas.

---

## 4. Problema de Negocio que Resuelve

### 4.1 Problemas del Pequeño Comercio Informal (CORE)
1. **Informalidad y dispersión:** Cuentas anotadas en papel, cuadernos que se pierden o cuentas memorizadas.
2. **Ceguera financiera al final del turno:** Desconocimiento de cuánto dinero entró en efectivo versus transferencias (Nequi/Daviplata/Bancolombia) y cuánto se gastó en compras de emergencia.
3. **Barrera de entrada del software tradicional:** Los POS convencionales exigen PCs de escritorio, impresoras de marca exclusiva y suscripciones inaccesibles en dólares.
4. **Dependencia absoluta del propietario:** Si el dueño no está presente, nadie sabe con certeza precios, existencias ni cuentas por cobrar.

### 4.2 Problemas Específicos de la Comida Rápida (Vertical)
1. **Caos en horas pico:** Llegada simultánea de pedidos en mostrador y chats de WhatsApp sin un orden cronológico claro.
2. **Pérdida de pedidos y confusiones en cocina:** Papelitos con notas tipo *"hamburguesa sin cebolla y con queso extra"* que se extravían en la plancha.
3. **Fricción en la entrega de domicilios:** Descoordinación con los repartidores locales sobre qué pedido entregan, cuánto deben cobrar y qué corresponde al envío.

---

## 5. Segmentos de Clientes y Buyer Personas

### 5.1 Segmento General
Micro y pequeños negocios familiares en Colombia y Latinoamérica (1 a 6 personas), con operaciones intensivas en WhatsApp y pagos móviles.

### 5.2 Segmento de Validación Inicial (Piloto en Campo)
- **Ubicación:** Camarones, La Guajira, Colombia.
- **Tipo de negocio:** Puestos y locales de comida rápida (salchipaperías, hamburgueserías, pizzerías, asaderos).
- **Características operativas:** Operación vespertina/nocturna, clientes que piden por WhatsApp, pagos por Nequi/efectivo, uso de domiciliarios de confianza propios del pueblo o del negocio.

### 5.3 Actores del Sistema
1. **Superadministrador (SaaS):** Administra los comercios afiliados, estados de suscripción y soporte global.
2. **Propietario / Administrador:** Dueño del establecimiento. Control total de catálogo, precios, finanzas, empleados y configuración.
3. **Colaborador / Trabajador (Mesero, Cajero, Cocina):** Opera la plataforma desde su propio teléfono móvil según los permisos asignados por el dueño.
4. **Domiciliario / Repartidor:** Consulta pedidos asignados, direcciones, teléfonos de contacto y montos exactos a recaudar por concepto de comida y flete.
5. **Cliente Final (Comensal):** Escanea el código QR en la mesa o abre el enlace del menú digital en Instagram/WhatsApp. Arma su pedido y lo envía sin tener que descargar aplicaciones ni registrarse.

---

## 6. Modelo de Negocio y Precios Oficiales (Canónicos)

NEGOVA opera bajo un modelo **SaaS B2B por suscripción periódica recurrente** en Pesos Colombianos (COP). No cobra comisiones sobre las ventas ni tarifas por transacción de domicilios.

### 6.1 Catálogo Canónico de Planes

| Plan | Tarifa Mensual (COP) | Tarifa Anual Equivalente | Límites y Capacidades Principales |
| :--- | :--- | :--- | :--- |
| **Inicio** | **$29.900 / mes** | Configurable con descuento anual | • Hasta **2 usuarios** (Dueño + 1 colaborador)<br>• Hasta **200 productos** en catálogo<br>• 1 sucursal / punto físico<br>• Registro rápido de ventas y gastos diarios<br>• Control de apertura y cierre de caja<br>• Comprobantes de venta y tickets térmicos<br>• Directorio básico de clientes<br>• **30 días de prueba gratuita** sin tarjeta |
| **Crece** *(Más Popular)* | **$59.900 / mes** | Configurable con descuento anual | • Hasta **3 usuarios** de acceso<br>• Hasta **1.000 productos** en catálogo<br>• Inventario con variantes y categorías<br>• **Control de fiados y cuentas por cobrar**<br>• Compras a proveedores y egresos detallados<br>• Arqueos de caja por turnos<br>• Estadísticas comparativas de ventas<br>• **Asistente NEGOVA AI (Gemini)** para consultas operativas<br>• Soporte prioritario |
| **Negocio** *(Completo)* | **$99.900 / mes** | Configurable con descuento anual | • Hasta **6 colaboradores** con roles y permisos específicos<br>• Hasta **3.000 productos** en catálogo<br>• Múltiples turnos y puntos de cobro en local<br>• Reportes avanzados de rentabilidad y márgenes<br>• **IA Operativa avanzada** para análisis por colaborador<br>• Acompañamiento y soporte directo por WhatsApp |

> **Regla de Honestidad Técnica:** NEGOVA prohíbe comercializar recursos "ilimitados" o prometer planes Enterprise ficticios sin infraestructura que los respalde.

---

## 7. Stack Tecnológico y Decisiones de Arquitectura

```text
┌────────────────────────────────────────────────────────┐
│                   CLIENTE / BROWSER                    │
│   Next.js 15 App Router · React 19 · Tailwind CSS      │
│   shadcn/ui · Lucide React · Sonner (Toasts)           │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / Server Actions
┌───────────────────────────▼────────────────────────────┐
│                  VERCEL EDGE / NODE                    │
│   Next.js Server Actions & Route Handlers              │
│   Google Gemini AI SDK (@google/genai)                 │
│   Meta WhatsApp Business Cloud Webhooks                │
└───────────────────────────┬────────────────────────────┘
                            │ RLS Multi-tenant
┌───────────────────────────▼────────────────────────────┐
│                  SUPABASE CLOUD                        │
│   PostgreSQL 15+ con Row Level Security (RLS)          │
│   Supabase Auth (Sesiones JWT y roles)                 │
│   Supabase Storage (Logos, imágenes de productos, PDFs)│
│   Colas transaccionales: FOR UPDATE SKIP LOCKED        │
└────────────────────────────────────────────────────────┘
```

### 7.1 Componentes del Stack
- **Framework:** Next.js 15+ con App Router y Server Actions (sin servidor Express desacoplado).
- **Lenguaje:** TypeScript estricto (`strict: true`).
- **Base de Datos y Auth:** Supabase (PostgreSQL relacional) con políticas de aislamiento RLS a nivel de motor.
- **Estilos e Interfaz:** Tailwind CSS con tokens de diseño propios (`#ED500A` primario, tipografías balanceadas, modo oscuro/claro). Componentes basados en Radix / shadcn/ui.
- **Inteligencia Artificial:** Google Gemini AI para el asistente de negocio y el bot de pedidos de WhatsApp.
- **Notificaciones y Toasts:** Sonner.
- **Prohibición Absoluta de Código:** Está **estrictamente prohibido el uso de alertas nativas del navegador** (`window.alert`, `window.confirm`, `window.prompt`). Toda confirmación o aviso debe hacerse mediante Modales UI personalizados o Toasts de Sonner.

---

## 8. Módulos Funcionales de la Plataforma

### 8.1 Administración SaaS (`/admin`)
- Control de negocios registrados (tenants), cambio de planes, seguimiento de facturación y logs de auditoría.
- Acceso delegado para soporte técnico seguro con registro en bitácora.

### 8.2 Espacio de Trabajo del Negocio (`/workspace/[businessId]`)
- **Dashboard:** Resumen diario de ventas, medios de pago, productos top y alertas de caja.
- **Punto de Venta (POS):** Pantalla ágil para registrar pedidos al mostrador, seleccionar productos, asignar adicionales y cobrar de inmediato.
- **Gestión de Mesas (`/mesas`):** Mapeo de mesas, estado (libre, ocupada, por cobrar), cuentas abiertas y generación de QR imprimibles con firma criptográfica.
- **Cola de Pedidos (`/pedidos`):** Cola de preparación estilo KDS en tiempo real con tarjetas ordenadas cronológicamente y transición de estados (`Recibido` $\rightarrow$ `En Preparación` $\rightarrow$ `Listo` $\rightarrow$ `Entregado`).
- **Módulo de Domicilios (`/pedidos/domicilios`):** Asignación de repartidores, cálculo de flete independiente y verificación de cobro.
- **Catálogo de Productos y Modificadores (`/productos`):** Categorías, productos con variantes, grupos de modificadores (obligatorios o adicionales) y control de disponibilidad en 1 clic.
- **Caja y Movimientos:** Registro de ingresos, retiros y arqueo ciego o guiado por turno.
- **Nómina y Personal (`/personal` y `/nomina`):** Lista de colaboradores, asignación de permisos individuales por pantalla, turnos y vales/anticipos.
- **Configuración de Negocio (`/configuracion`):** Datos del comercio, logo, cuentas bancarias para transferencias (QR Nequi/Daviplata) e impresión de tickets.

### 8.3 Menú Digital Público (`/menu/[slugOrId]`)
- Catálogo web optimizado para teléfonos móviles accesible mediante enlace o QR.
- **4 Plantillas visuales predefinidas:**
  1. *Comercial:* Catálogo limpio, corporativo y claro.
  2. *Urbana Fast Food:* Energética, moderna y de alto contraste (ideal salchipaperías y hamburgueserías).
  3. *Elegante & Clásica:* Tipografía sobria y diseño editorial.
  4. *Visual:* Enfoque prioritario en fotografías gastronómicas.
- Modalidad alternativa: Visualizador optimizado de archivo propio (PDF o imagen de la carta).
- **Carrito de compras interactivo:** Selección de variantes, adicionales y notas especiales sin requerir inicio de sesión.
- **Despacho configurable:** Modalidad en mesa (validando QR), para llevar (recogida en local) o domicilio (con dirección de entrega).

---

## 9. Estado Actual del Desarrollo (Lo que se está haciendo AHORA MISMO)

> [!IMPORTANT]
> **Foco Actual:** Todo el esfuerzo operativo y de desarrollo está concentrado en el **Vertical de Restaurantes de Comida Rápida**, abordando simultáneamente dos frentes complementarios:

### Frente 1: Menú Digital Interactivo y Ciclo de Pedidos
- **Objetivo:** Que el comensal arme su pedido completo en su teléfono celular (seleccionando cantidades, tamaños, salsas, adicionales y observaciones) y que al confirmar, la orden se registre directamente en la plataforma NEGOVA para que el usuario del negocio la reciba, confirme y mande a cocina.
- **Lo que se está resolviendo y puliendo:**
  1. **Validación de Modalidades en el Servidor (`createPublicMenuOrderAction`):**
     - *En Mesa (`dine_in`):* Se exige el escaneo de un código QR con token criptográfico HMAC emitido por el negocio. Evita que un comensal remoto ordene a una mesa física.
     - *Para Llevar (`takeout`):* Se exigen datos básicos (nombre y teléfono) para que el establecimiento sepa a quién llamar al estar lista la orden.
     - *A Domicilio (`delivery`):* Se exige nombre, teléfono, dirección y referencias de entrega.
  2. **Personalización de Productos (`ProductDetailModal`):**
     - Selección de variantes con ajuste dinámico de precio base.
     - Selección de grupos de modificadores respetando límites de validación (por ejemplo: "Elige obligatoriamente 1 salsa" o "Elige hasta 3 complementos").
  3. **Recepción y Confirmación:**
     - El pedido ingresa automáticamente a la base de datos de NEGOVA con estado inicial `pending_confirmation` o `received` en la tabla `restaurant_orders`.
     - El personal en caja o cocina ve aparecer la comanda en su pantalla en tiempo real con sonido y alerta visual para aceptarla o rechazarla.

### Frente 2: Integración de NEGOVA con WhatsApp
- **Objetivo:** Conectar el canal de mensajería más usado por los comensales (WhatsApp) directamente con el sistema de pedidos y el POS de NEGOVA, reduciendo la carga manual del comerciante.
- **Arquitectura de la integración:**
  1. **Aislamiento Multi-Tenant de Meta Cloud API:**
     - Tabla `business_whatsapp_configs` para la información pública del número Meta del negocio.
     - Tabla blindada `business_whatsapp_secrets` (con RLS exclusivo para `service_role`) para almacenar tokens de acceso cifrados y tokens de verificación de webhook.
  2. **Cola Asíncrona Persistente de Mensajes (`whatsapp_incoming_events`):**
     - Deduplicación estricta de mensajes por `wamid` (WhatsApp Message ID) para evitar procesar dos veces el mismo mensaje.
     - Procesamiento atómico con PostgreSQL `FOR UPDATE SKIP LOCKED` mediante la función RPC `claim_whatsapp_incoming_events`.
     - Mecanismo de reintentos exponenciales y rescate automático de eventos trabados ("zombies").
  3. **Agente Conversacional con Inteligencia Artificial (`WhatsAppAiService`):**
     - Conectado con la API de Google Gemini (`@google/genai`).
     - **Regla de Oro:** El bot solo ofrece y vende los productos reales, disponibles y con precio oficial del catálogo del negocio (aislamiento por `business_id`). No inventa platos inexistentes.
     - Identifica intenciones de compra, consulta dudas de la carta, calcula totales y registra el pedido directamente en el POS del negocio.
     - Máquina de estados (`whatsapp_conversations`): transición transparente entre `ai_active` (IA respondiendo) y `human_pending` / `human_active` cuando un operador humano interviene en el chat.
  4. **Notificaciones Automatizadas hacia el Negocio (`enqueueOrderWhatsAppNotification`):**
     - Alarma automática a través de WhatsApp cuando un cliente ingresa un pedido para llevar (`takeout`) o a domicilio (`delivery`).
     - *Regla de Negocio:* Los pedidos de mesa (`dine_in`) no saturan el WhatsApp del comerciante; se gestionan exclusivamente en la pantalla de pedidos/KDS.

---

## 10. Diagrama de Flujo del Pedido Unificado

```text
                                  CLIENTE
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
     [CÓDIGO QR MESA]         [ENLACE WEB/BIO]       [CHAT WHATSAPP]
     Escaneo en el local       Navega catálogo        Conversa con IA
           │                         │                         │
           ▼                         ▼                         ▼
   Menú Digital Mesa        Menú Domicilio/Llevar       Asistente Gemini
   (Token HMAC validado)    (Datos de entrega)        (Consulta catálogo)
           │                         │                         │
           └─────────────────────────┬─────────────────────────┘
                                     │
                                     ▼
                    [COLA ÚNICA DE PEDIDOS NEGOVA]
            (Tabla restaurant_orders / Canal digital_menu / whatsapp)
                                     │
                                     ▼
               [CONFIRMACIÓN POR EL PERSONAL DEL NEGOCIO]
                         (Aceptado en POS / KDS)
                                     │
                                     ▼
                        [COCINA / PREPARACIÓN]
                                     │
                                     ▼
                         [DESPACHO / ENTREGA]
             ┌───────────────────────┼───────────────────────┐
             │                       │                       │
      Mesa Liberada          Cliente Recoge        Repartidor Asignado
     (Cuenta saldada)       (Mostrador listo)     (Flete y comida cobrados)
```

---

## 11. Estructura de Base de Datos Clave (Esquema Principal)

```text
public.businesses                  (Empresas registradas en el SaaS)
├── public.business_users          (Usuarios asociados con roles)
├── public.categories              (Categorías de productos por negocio)
├── public.products                (Productos con precio, stock, descripción)
│   ├── public.product_variants    (Variantes: Pequeña, Grande, Doble)
│   └── public.product_modifier_groups (Grupos de salsas, toppings, guarniciones)
│       └── public.product_modifier_options (Opciones individuales con precio delta)
├── public.restaurant_tables       (Mesas del restaurante con qr_hash)
├── public.restaurant_orders       (Pedidos de cocina con estado y tipo de servicio)
│   └── public.restaurant_order_items (Líneas de pedido con modificadores elegidos)
├── public.sales                   (Ventas cerradas y facturadas)
│   └── public.sale_items          (Detalle de productos vendidos)
├── public.expenses                (Gastos operativos diarios)
├── public.business_digital_menus  (Configuración y plantillas del menú web)
├── public.business_whatsapp_configs (Configuración del número WhatsApp Cloud)
├── public.business_whatsapp_secrets (Tokens cifrados de WhatsApp - Solo backend)
├── public.whatsapp_conversations  (Sesiones de chat con clientes y estado IA)
└── public.whatsapp_incoming_events(Cola duradera de eventos WhatsApp con SKIP LOCKED)
```

---

## 12. Reglas de Desarrollo Obligatorias

1. **Cero Alertas Nativas:** Queda terminantemente prohibido usar `window.alert()`, `window.confirm()` o `window.prompt()`. Se deben emplear siempre modales personalizados (`components/ui/dialog`, `ModalPortal`) y toasts (`sonner`).
2. **Honestidad en el Código y Datos:** No se deben generar datos ficticios ni mocks que simulen persistencia si el backend ya existe. Toda funcionalidad debe consultar la base de datos real en Supabase respetando RLS.
3. **Aislamiento Multi-Tenant Estricto:** Toda consulta SQL, Server Action o lectura de base de datos debe filtrar explícitamente o asegurar que las políticas RLS incluyan la comprobación de `business_id`.
4. **Mobile-First Real:** La interfaz del personal y de los comensales debe estar diseñada primordialmente para smartphones (resoluciones de 360px a 430px de ancho) con botones táctiles cómodos, áreas de toque de al menos 44px y tipografía legible.

---

## 13. Glosario de Términos

- **Tenant:** Cada uno de los negocios o establecimientos independientes registrados en NEGOVA.
- **KDS (Kitchen Display System):** Pantalla o vista de cocina donde los pedidos aparecen en tarjetas ordenadas cronológicamente.
- **Modificador:** Opciones que alteran un producto gastronómico (ejemplo: adición de tocineta, tipo de pan, salsas).
- **Dine In:** Modalidad de consumo dentro del establecimiento (en mesa).
- **Takeout:** Modalidad para llevar (el cliente recoge el pedido en el mostrador).
- **Delivery:** Modalidad a domicilio (despacho con repartidor a una dirección).
- **Flete:** Valor cobrado exclusivamente por el servicio de entrega del domiciliario, separado contablemente de los alimentos.
- **SKIP LOCKED:** Técnica avanzada de bloqueo de filas en PostgreSQL que permite a múltiples workers procesar una cola concurrente sin colisiones ni esperas de bloqueo.
