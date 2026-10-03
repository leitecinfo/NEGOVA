# Arquitectura Modular: NEGOVA CORE vs. Verticales

**Versión:** 1.0  
**Estado:** Definido  
**Producto:** NEGOVA  
**Documento:** 01-core-y-verticales.md  

---

## 1. Propósito y Principio Rector

El propósito de este documento es establecer la separación arquitectónica y conceptual formal entre el **NÚCLEO COMÚN (NEGOVA CORE)** y los **MÓDULOS ESPECÍFICOS POR VERTICAL (Verticales de Negocio)**.

> ### 📌 Regla de Oro Arquitectónica
> **Toda funcionalidad, entidad, servicio o flujo debe clasificarse estrictamente como parte del CORE o como específica de un VERTICAL.**  
> Ningún concepto específico de un rubro (como platos, mesas, comandas, turnos de corte, citas o recetas) puede acoplarse al núcleo del sistema.

---

## 2. Mapa Estructural de Separación

```text
NEGOVA PLATFORM
│
├── 🧠 NEGOVA CORE (Capacidades Transversales y Fundacionales)
│   ├── 🏢 Negocio (Tenant, Perfil comercial, Parámetros básicos)
│   ├── 👥 Usuarios y Permisos (Autenticación, RBAC, Propietario, Trabajadores)
│   ├── 👤 Clientes (Directorio unificado, Datos de contacto, Historial de compras)
│   ├── 💰 Ventas e Ingresos (Registro transaccional, Inmutabilidad histórica)
│   ├── 📉 Gastos y Egresos (Gastos operativos, Categorías, Egresos independientes)
│   ├── 💳 Pagos y Métodos (Transacciones, Efectivo/Transferencias, Pagos parciales)
│   └── ⚙️ Configuración del Sistema (Parámetros globales, Aislamiento Multi-tenant)
│
└── 🍔 VERTICAL RESTAURANTE (Comida Rápida - MVP Inicial de Validación)
    ├── 📜 Menú y Modificadores (Categorías, Platos, Ingredientes extra / exclusiones)
    ├── 🛎️ Pedidos Multicanal (Mostrador, WhatsApp manual, Menú digital autogestión)
    ├── 📋 Cola Centralizada de Pedidos (Orden cronológico estricto de llegada)
    ├── 🍳 Preparación y Cocina (Estados: Recibido → En preparación → Listo)
    ├── 🛵 Gestión de Domicilios (Direcciones textuales, Tarifa de flete independiente)
    └── 🟢 Disponibilidad Manual (Conmutación ágil: Disponible / No disponible)
```

---

## 3. Matriz de Responsabilidades

| Dominio / Módulo | Nivel de Pertenencia | Descripción de Responsabilidad |
| :--- | :--- | :--- |
| **Identidad y Tenant** | **CORE** | Gestión de la cuenta del negocio, aislamiento de base de datos y multi-tenancy estricto. |
| **Usuarios y Roles** | **CORE** | Autenticación, sesiones y asignación de permisos (Propietario, Personal). |
| **Gestión Financiera** | **CORE** | Registro de ingresos, gastos, cálculo de balances y métodos de pago (Efectivo/Transferencia). |
| **Directorio de Clientes** | **CORE** | Almacenamiento no bloqueante de datos de contacto e historial de transacciones. |
| **Catálogo General** | **CORE** | Entidad genérica de ítems comercializables, precios y persistencia histórica. |
| **Menú de Comidas** | **VERTICAL RESTAURANTE** | Especialización con modificadores ("sin cebolla", extras) y categorías de platos. |
| **Cola de Cocina** | **VERTICAL RESTAURANTE** | Visualización operativa secuencial de órdenes en preparación para comida rápida. |
| **Despacho y Flete** | **VERTICAL RESTAURANTE** | Gestión de direcciones de entrega comunitaria y desglose del costo de domicilio. |
| **Disponibilidad Rápida** | **VERTICAL RESTAURANTE** | Desactivación manual inmediata de productos por agotamiento de insumos en turno. |

---

## 4. Criterios de Extensibilidad hacia Futuros Verticales

El diseño desacoplado garantiza que la incorporación de nuevos sectores de la economía popular no requerirá reconstruir el CORE:

```text
                                 ┌──► VERTICAL RESTAURANTE (Menú, Comandas, Domicilios)
                                 │
     ┌──────────────────┐        ├──► VERTICAL BARBERÍA (Servicios, Citas, Profesionales)
     │   NEGOVA CORE    ├────────┤
     │ (Tenancy, Users, │        ├──► VERTICAL TIENDA / MINIMARKET (Venta mostrador, Unidades)
     │  Ventas, Gastos, │        │
     │     Pagos)       ├────────┼──► VERTICAL FARMACIA (Presentaciones, Laboratorios)
     └──────────────────┘        │
                                 └──► VERTICAL FERRETERÍA (Medidas, Materiales)
```

> **Aclaración para el MVP:** Los verticales futuros son únicamente visión de escalabilidad arquitectónica. **No forman parte del alcance de desarrollo del MVP**, el cual se enfoca al 100% en el **Vertical Restaurante de comida rápida en Camarones, La Guajira**.

---

## 5. Reglas de Implementación en Código y Base de Datos

1. **Esquema de Base de Datos Limpio:** Las tablas del CORE (`tenants`, `users`, `clients`, `transactions`, `expenses`, `payments`) no contienen columnas específicas de restaurante (como `cooking_notes`, `delivery_fee`, `table_number`).
2. **Entidades Especializadas / Extensiones:** La lógica de restaurantes se modela en esquemas o tablas satélite vinculadas (`restaurant_orders`, `order_items`, `product_modifiers`, `delivery_info`).
3. **Servicios Aislados:** Los servicios del CORE no importan módulos de restaurantes. Los módulos de restaurantes consumen las interfaces y contratos provistos por el CORE.
