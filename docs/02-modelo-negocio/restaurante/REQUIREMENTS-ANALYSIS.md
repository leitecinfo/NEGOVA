# Análisis Técnico y de Requisitos — Vertical Restaurante de Comida Rápida
**NEGOVA Platform — Arquitectura Desacoplada: Core vs. Vertical Restaurante**  
**Fecha:** Octubre 2026 | **Versión:** 3.0.0 (Frontera Limpia Core vs Verticales) | **Estado:** Aprobado

---

## 1. Principio Rector: Arquitectura Multivertical Limpia

NEGOVA es una plataforma SaaS diseñada para atender múltiples tipos de negocio (tiendas de barrio, ferreterías, droguerías/farmacias, panaderías, barberías, papelerías y restaurantes).

> ### 📌 Regla de Oro de Separación Arquitectónica
> **El Core de NEGOVA jamás debe diseñarse alrededor de conceptos exclusivos de un solo rubro.**  
> Ninguna entidad transversal (como ventas, productos o gastos) debe contener columnas exclusivas de restaurantes (como `table_id`, `kitchen_notes`, `delivery_fee` o `cooking_status`).  
> **NEGOVA Core** provee las capacidades fundacionales comunes $\rightarrow$ **Vertical Restaurante** modela la operativa especializada gastronómica $\rightarrow$ **Futuros Verticales** se conectan al Core sin rehacer la plataforma.

---

## 2. Diferenciación Estricta: Estado Actual vs Por Implementar

Para evitar ambigüedades en la planificación:

### A. Core de NEGOVA Actualmente Implementado (Código y BD Activa)
Lo que **realmente existe, está desplegado en `supabase/migrations/` y funciona en `src/`**:
1. **Tenancy e Identidad:** `businesses`, `users`, `business_users`, `roles`, `permissions`, `role_permissions`.
2. **Seguridad y Sesión de Workspace:** [workspace-context.ts](file:///d:/Proyectos/NEGOVA/src/lib/auth/workspace-context.ts) (`requireWorkspaceSession`, `verifyWorkspaceAction`).
3. **Ventas y Comprobantes Oficiales:** Módulo activo `/workspace/[businessId]/ventas`, tabla `business_sale_documents`, secuencias correlativas en `business_document_sequences`, motor PDF en [pdf-engine.ts](file:///d:/Proyectos/NEGOVA/src/lib/pdf/pdf-engine.ts) y configuración de marca en `business_document_configs`.
4. **Notificaciones Transversales:** `platform_notifications` filtrable por `scope = 'business'`.
5. **Plataforma SaaS:** `platform_settings`, `platform_invoices`, `platform_expenses`, tickets y chat de soporte.

### B. Core de NEGOVA a Nivel de Diseño Genérico (Por Desplegar en Migraciones)
Estructuras conceptuales comunes que servirán para cualquier comercio (tienda, ferretería, restaurante) y que deben desplegarse como entidades genéricas sin contaminar:
1. `public.categories`: Clasificador genérico de catálogo por negocio.
2. `public.products`: Catálogo común de artículos/servicios con precio, estado, switch `is_available` y `metadata JSONB` para atributos propios de cada sector.
3. `public.expenses`: Registro común de egresos y gastos operativos del comercio.
4. `public.payments`: Transacciones de cobro genéricas asociadas a cualquier documento u orden.

### C. Vertical Restaurante Todavía No Implementado (Específico de Gastronomía)
Estructuras y pantallas que pertenecen **única y exclusivamente** a la operativa gastronómica rápida:
1. `public.restaurant_tables`: Gestión física del salón (mesas, barras, terrazas).
2. `public.restaurant_orders`: Comandas de cocina y despacho (cola de preparación, mesa vinculada, datos de delivery y flete).
3. `public.restaurant_order_items`: Líneas de comanda con notas de cocina ("sin cebolla", "término medio") y modificadores congelados.
4. Módulos de frontend en el Workspace: Cola de Cocina (KDS), Tablero de Mesas, Monitor de Delivery, Menú Digital Público (`/m/[slug]`), Calculadora General y Calculadora de Cambio en cobro.

---

## 3. Matriz de Clasificación: Core Genérico vs Específico de Restaurante

| Tabla / Entidad | ¿Debe ser Core Genérico? | ¿Debe ser Específica de Restaurante? | Razón Arquitectónica |
| :--- | :---: | :---: | :--- |
| **`categories`** | **SÍ** | NO | Toda empresa categoriza lo que vende: una ferretería (Herramientas, Pinturas), una droguería (Analgésicos), un restaurante (Hamburguesas, Bebidas). |
| **`products`** | **SÍ** | NO | Todo comercio vende artículos con nombre, precio, descripción, foto y estado. Sus particularidades (tallas en ropa, modificadores en comida) se manejan en `metadata JSONB`. |
| **`expenses`** | **SÍ** | NO | Toda empresa registra salidas de dinero (arriendo, servicios, proveedores, nómina). Es 100% transversal. |
| **`payments`** | **SÍ** | NO | Todo cobro transaccional (monto, método de pago, fecha, referencia) es transversal al negocio. |
| **`restaurant_tables`** | NO | **SÍ** | Solo los restaurantes, bares o cafeterías tienen mesas en salón. Una tienda, ferretería o farmacia no usa mesas. |
| **`restaurant_orders`** | NO | **SÍ** | Un pedido gastronómico tiene ciclo de cocina (`En preparación`, `Listo`), mesa asociada y delivery con flete. En cambio, una tienda o ferretería opera por venta directa de mostrador sin pasar por cocina. Separarla previene contaminar el Core con columnas de cocina. |
| **`restaurant_order_items`** | NO | **SÍ** | Representa el plato ordenado con sus notas de cocina ("sin cebolla") y adicionales elegidos por el comensal. |

---

## 4. Campos Específicos que NO Deben Contaminar el Core

Para blindar la integridad del Core de NEGOVA ante futuros verticales, los siguientes campos se mantienen **confinados en las entidades del vertical**:

* **Exclusivos de Restaurante (Viven en `restaurant_orders` / `restaurant_order_items`):**
  - `table_id`: Mesa asignada en el salón.
  - `kitchen_status`: Estados de preparación física (`received`, `in_preparation`, `ready`).
  - `kitchen_notes`: Instrucciones de cocción ("bien cocida", "sin ripio", "salsa aparte").
  - `delivery_fee`: Tarifa de flete del repartidor local independiente de los productos.
  - `delivery_address` y `delivery_reference`: Puntos de referencia comunitarios para entrega de comida caliente.
  - `driver_name` / `driver_id`: Repartidor asignado para llevar el pedido.
* **Genéricos de NEGOVA (Viven en `products`, `expenses`, `business_sale_documents`):**
  - `name`, `price`, `description`, `category_id`, `is_available`, `metadata JSONB`.
  - `subtotal`, `tax_total`, `discount_total`, `total`, `currency`.
  - `customer_name`, `customer_phone`, `customer_id`.
  - `document_number`, `issued_at`, `status`.

---

## 5. Validación del Flujo Operativo y Articulación con el Core

```text
               VERTICAL RESTAURANTE (Operativa Especializada)
               ┌────────────────────────────────────────────┐
               │ 1. Recepción Multicanal                    │
               │    (Mostrador / WhatsApp manual / Menú QR) │
               │ 2. Comanda en public.restaurant_orders     │
               │    (Platos de public.products con notas)   │
               │ 3. Asignación de Mesa o Datos de Delivery  │
               │ 4. Cola de Cocina                          │
               │    (Recibido ──► En preparación ──► Listo) │
               │ 5. Liquidación & Calculadora de Cambio     │
               └─────────────────────┬──────────────────────┘
                                     │
                                     ▼ Al cobrar y finalizar comanda
               ┌────────────────────────────────────────────┐
               │ NEGOVA CORE (Capacidades Reutilizadas)     │
               │ 6. Registro de cobro en public.payments    │
               │ 7. Emisión de Comprobante Oficial BSD      │
               │    (createBusinessSaleDocument)            │
               │ 8. Consecutivo seguro en sequences         │
               │ 9. Generación de PDF oficial               │
               │ 10. Flujo de Caja en Finanzas del Local    │
               │     (Ventas BSD - Gastos public.expenses)  │
               └────────────────────────────────────────────┘
```

---

## 6. Preparación para Futuros Verticales

Gracias a esta arquitectura desacoplada:

1. **Vertical Restaurante (Actual):**
   - Usa `public.categories`, `public.products`, `public.expenses`, `public.payments`.
   - Añade `public.restaurant_tables`, `public.restaurant_orders`, `public.restaurant_order_items`.
   - Factura en `public.business_sale_documents`.
2. **Vertical Tienda de Barrio / Minimarket (Futuro):**
   - Usa `public.categories`, `public.products`, `public.expenses`.
   - Vende directamente en mostrador emitiendo en `public.business_sale_documents` sin crear comandas de cocina ni mesas.
3. **Vertical Barbería / Salón de Belleza (Futuro):**
   - Usa `public.products` (como servicios y cortes) y `public.expenses`.
   - Añade módulo satélite de turnos/citas (`barber_appointments`).
   - Factura en `public.business_sale_documents`.

---

## 7. Estructura Definitiva del Aside del Restaurante

La navegación en [workspace-shell.tsx](file:///d:/Proyectos/NEGOVA/src/components/workspace/workspace-shell.tsx) refleja con total nitidez esta división:

* **Principal**
  * Dashboard (`/workspace/[businessId]`)
* **Operación**
  * Pedidos (`/workspace/[businessId]/pedidos`) *(Vertical)*
  * Ventas (`/workspace/[businessId]/ventas`) *(Core BSD)*
  * Productos / Menú (`/workspace/[businessId]/productos`) *(Core `products`)*
  * Mesas (`/workspace/[businessId]/mesas`) *(Vertical)*
  * Delivery (`/workspace/[businessId]/delivery`) *(Vertical)*
  * Menú digital (`/workspace/[businessId]/menu-digital`) *(Vertical)*
* **Gestión**
  * Usuarios (`/workspace/[businessId]/usuarios`) *(Core `business_users`)*
  * Roles y permisos (`/workspace/[businessId]/roles`) *(Core RBAC)*
* **Finanzas**
  * Finanzas y Caja (`/workspace/[businessId]/finanzas`) *(Core `expenses` + Ventas)*
* **Herramientas**
  * Calculadora (`/workspace/[businessId]/calculadora`) *(Utilidad transversal)*
* **Control**
  * Notificaciones (`/workspace/[businessId]/notificaciones`) *(Core `platform_notifications`)*
* **Cuenta**
  * Mi Perfil (`/workspace/[businessId]/perfil`) *(Core Perfil)*
