# Scripts SQL de Base de Datos — NEGOVA MVP

**Motor:** PostgreSQL 15+ / Supabase  
**Arquitectura:** NEGOVA CORE + Vertical Restaurante de Comida Rápida  
**Ubicación:** `docs/04-base-de-datos/scripts/`  

---

## 📋 Estructura Modular de Scripts

Los scripts se encuentran ordenados por dependencias y pueden ejecutarse individualmente o en bloque:

| # | Archivo | Descripción |
| :---: | :--- | :--- |
| **00** | [`00_master_setup.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/00_master_setup.sql) | Script maestro de ejecución global con directivas `\i`. |
| **01** | [`01_extensions_and_enums.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/01_extensions_and_enums.sql) | Extensiones (`pgcrypto`, `uuid-ossp`) y 13 tipos `ENUM` de control de estados. |
| **02** | [`02_core_tables.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/02_core_tables.sql) | Tablas del CORE: `businesses`, `users`, `roles`, `permissions`, `role_permissions`, `business_users`, `customers`, `expenses`. |
| **03** | [`03_restaurant_tables.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/03_restaurant_tables.sql) | Tablas del Vertical Restaurante: `categories`, `products`, `orders`, `order_items`, `payments`, `deliveries`, `order_status_history`. |
| **04** | [`04_indexes_and_constraints.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/04_indexes_and_constraints.sql) | Índices B-Tree de alta concurrencia para cola de cocina, fletes y clientes. |
| **05** | [`05_triggers_and_functions.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/05_triggers_and_functions.sql) | Triggers para `updated_at`, auditoría automática de estados y asignación de `# comanda`. |
| **06** | [`06_row_level_security.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/06_row_level_security.sql) | Políticas de seguridad Row-Level Security (RLS) para multi-tenant y menú web público. |
| **07** | [`07_seed_initial_data.sql`](file:///D:/Proyectos/NEGOVA/docs/04-base-de-datos/scripts/07_seed_initial_data.sql) | Roles base (`PROPIETARIO`, `PERSONAL`), permisos y datos de prueba del negocio piloto en Camarones. |

---

## 🚀 Cómo Ejecutar en Supabase

1. Abre el panel de tu proyecto en **Supabase** $\rightarrow$ **SQL Editor**.
2. Copia y ejecuta los scripts en el orden **01 al 07**, o ejecuta los contenidos en una sola pestaña.
3. Todas las tablas quedarán creadas en el esquema `public` con **RLS activado** y listas para conectar con la app móvil y el menú digital web.
