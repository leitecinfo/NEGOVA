# NEGOVA — Sistema de Diseño Oficial (DESIGN_SYSTEM.md)

> **Documento Oficial de Referencia Visual y Arquitectura de UI**  
> **Estado:** Vigente y de Aplicación Obligatoria  
> **Repositorio:** `D:\Proyectos\NEGOVA`  
> **Última Auditoría Global:** Octubre 2026

---

## Tabla de Contenidos

1. [Propósito y Fuentes de Verdad](#1-propósito-y-fuentes-de-verdad)
2. [Identidad Visual, Paleta y Tokens de Color](#2-identidad-visual-paleta-y-tokens-de-color)
3. [Tipografía y Jerarquía Textual](#3-tipografía-y-jerarquía-textual)
4. [Geometría, Espaciado, Sombras y Elevación](#4-geometría-espaciado-sombras-y-elevación)
5. [Botones y Acciones](#5-botones-y-acciones)
6. [Campos y Controles de Entrada](#6-campos-y-controles-de-entrada)
7. [Contenedores, Tarjetas y Superficies](#7-contenedores-tarjetas-y-superficies)
8. [Modales, Diálogos y Overlays](#8-modales-diálogos-y-overlays)
9. [Tablas, Listados y Paginación](#9-tablas-listados-y-paginación)
10. [Navegación y Estructura de Layout](#10-navegación-y-estructura-de-layout)
11. [Feedback, Notificaciones y Estados](#11-feedback-notificaciones-y-estados)
12. [Iconografía, Avatares y Elementos Gráficos](#12-iconografía-avatares-y-elementos-gráficos)
13. [Formularios y Flujos Operativos](#13-formularios-y-flujos-operativos)
14. [Componentes y Patrones de Dominio](#14-componentes-y-patrones-de-dominio)
15. [Responsive y Accesibilidad](#15-responsive-y-accesibilidad)
16. [Inventario Completo de Componentes Compartidos](#16-inventario-completo-de-componentes-compartidos)
17. [Auditoría de Inconsistencias y Plan de Consolidación](#17-auditoría-de-inconsistencias-y-plan-de-consolidación)
18. [Reglas Obligatorias para Futuros Desarrollos](#18-reglas-obligatorias-para-futuros-desarrollos)
19. [Checklist de Cumplimiento Pre-Deploy](#19-checklist-de-cumplimiento-pre-deploy)

---

## 1. Propósito y Fuentes de Verdad

El propósito de este manual es consolidar y gobernar la interfaz gráfica real de NEGOVA. El sistema abarca:
- **Plataforma SaaS / Workspace Multi-Tenant:** `src/app/workspace/[businessId]/*`
- **Panel Administrativo del Sistema:** `src/app/admin/*` y `src/app/(admin)/*`
- **Módulos Operativos (POS, Mesas, Pedidos, Ventas, Clientes, Usuarios, Nómina):** `src/app/workspace/*` y `src/components/*`
- **Catálogo / Menú Digital Público (QR Gastronómico y Comercial):** `src/app/menu/*` y `src/components/menu/*`
- **Páginas Públicas y Landing Institucional:** `src/app/*` y `src/components/landing/*`
- **Flujos de Autenticación y Seguridad:** `src/app/(auth)/*`

### Matriz de Fuentes de Verdad en el Código

| Dominio | Archivo Fuente de Verdad | Rol y Realidad Técnica |
| :--- | :--- | :--- |
| **Variables y Temas CSS** | `src/app/globals.css` | Define `:root` (light) y `.dark`, keyframes de animación, personalización del scrollbar naranja `#ED500A` y reglas globales. |
| **Configuración Tailwind** | `tailwind.config.ts` | Conecta variables HSL a utilidades semánticas (`bg-background`, `text-foreground`, etc.) y fuentes de Google. |
| **Carga de Fuentes** | `src/app/layout.tsx` | Carga tipografías vía `next/font/google`: Hanken Grotesk (`--font-hanken-grotesk`), Inter (`--font-inter`) y JetBrains Mono (`--font-jetbrains-mono`). |
| **Componentes UI Canónicos** | `src/components/ui/*.tsx` | **Única suite oficial de componentes reutilizables**. Los archivos en `src/components/admin/ui/` son puentes delegadores. |
| **Shell y Layout del Workspace** | `src/components/layout/*` | Define el `AppLayoutShell`, `AppSidebar` colapsable/expandible, `AppTopbar` con reloj Bogotá UTC-5, breadcrumbs y `GlobalScrollbar`. |
| **Notificaciones en Vivo** | `src/app/layout.tsx` + `sonner` | Instancia única `<Toaster position="top-right" richColors />`. Prohibición absoluta de diálogos nativos del navegador. |

---

## 2. Identidad Visual, Paleta y Tokens de Color

### 2.1 Colores de Marca y Acento de Acción

El color identitario y motriz de NEGOVA es el **Naranja Energético**. Gobierna los botones primarios, estados activos, cursores de navegación, scrollbars, bordes de selección y anillos de foco:

| Nombre | Hex | HSL Real en CSS | Uso en la Aplicación |
| :--- | :--- | :--- | :--- |
| **Brand Orange (Principal)** | `#ED500A` | `18 92% 48%` (`--accent`) | Botones primarios, badge de acento, tab seleccionado, ring de foco, scrollbar, iconos destacados. |
| **Brand Orange Hover** | `#D44405` | — | Estado `:hover` en botones de acción y enlaces primarios. |
| **Brand Orange Active** | `#B83B04` | — | Estado `:active` en botones al presionarse. |
| **Brand Orange Glow/Ring** | `rgba(237, 80, 10, 0.3)` | `focus:ring-[#ED500A]/30` | Resplandor perimetral de foco en inputs, modales y tarjetas seleccionadas. |
| **Brand Orange Tint** | `rgba(237, 80, 10, 0.1)` | `bg-orange-500/10` | Fondos de badges activos, filas resaltadas y chips de selección. |

### 2.2 Fondos, Superficies y Bordes (Doble Modo: Claro y Oscuro)

NEGOVA está optimizado con superficies semánticas contrastadas:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MODO CLARO (Default según AppThemeProvider)                            │
│  • Fondo Canvas General:    #F8F9FD (hsl 228 50% 98%)                  │
│  • Tarjetas y Paneles:      #FFFFFF (Pure White)                       │
│  • Bordes Canónicos:        border-slate-200/80 ó hsl(218 20% 90%)     │
│  • Insets / Muted:          #E4E5EE ó slate-100                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MODO OSCURO (.dark)                                                    │
│  • Fondo Canvas General:    #0B0E14 (hsl 218 29% 6% - Deep Noir)       │
│  • Tarjetas, Tablas y Paneles: #0D0F16 (Superficie Canónica 2dp)       │
│  • Modales y Popovers:      #111420 (Superficie Elevada 4dp)           │
│  • Bordes Canónicos:        border-white/[0.08] ó hsl(227 18% 13%)     │
│  • Insets / Muted:          #141620 ó white/[0.04]                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Tipografía de Contenido y Contraste

- **Texto Principal (Alto Contraste):**
  - Claro: `#0B0E14` (o `text-slate-900`)
  - Oscuro: `#F8F9FD` (o `text-white`)
- **Texto Secundario / Labels:**
  - Claro: `text-slate-600` / `text-slate-700`
  - Oscuro: `text-slate-300` / `text-slate-400`
- **Texto Muted / Placeholders / Timestamps:**
  - Claro: `text-slate-400`
  - Oscuro: `text-slate-500` (WCAG AA contraste garantizado > 4.5:1)

### 2.4 Colores Semánticos y Estados de Negocio

Los estados funcionales y de datos en toda la aplicación se implementan de forma estrictamente homogénea mediante la siguiente paleta:

| Estado Semántico | Color Base | Estilo Fondo Claro | Estilo Fondo Oscuro | Borde |
| :--- | :--- | :--- | :--- | :--- |
| **Éxito / Disponible / Pagado** | Emerald (`#10B981`) | `bg-emerald-50 text-emerald-700` | `dark:bg-emerald-500/10 dark:text-emerald-400` | `border-emerald-200 dark:border-emerald-500/20` |
| **Advertencia / Pendiente / Alerta** | Amber (`#F59E0B`) | `bg-amber-50 text-amber-700` | `dark:bg-amber-500/10 dark:text-amber-400` | `border-amber-200 dark:border-amber-500/20` |
| **Peligro / Error / Cancelado** | Red (`#DC2626`) | `bg-red-50 text-red-700` | `dark:bg-red-500/10 dark:text-red-400` | `border-red-200 dark:border-red-500/20` |
| **Informativo / En Proceso** | Blue (`#2563EB`) | `bg-blue-50 text-blue-700` | `dark:bg-blue-500/10 dark:text-blue-400` | `border-blue-200 dark:border-blue-500/20` |
| **Especial / Rol / IA** | Purple (`#7C3AED`) | `bg-purple-50 text-purple-700` | `dark:bg-purple-500/10 dark:text-purple-400` | `border-purple-200 dark:border-purple-500/20` |
| **Neutro / Inactivo / Archivado** | Slate (`#64748B`) | `bg-slate-50 text-slate-700` | `dark:bg-white/[0.04] dark:text-slate-400` | `border-slate-200 dark:border-white/10` |

---

## 3. Tipografía y Jerarquía Textual

### 3.1 Familias Tipográficas Oficiales

NEGOVA implementa una combinación de tres fuentes primarias cargadas por Next.js Font Optimization en `src/app/layout.tsx`:

1. **`font-title` (Hanken Grotesk):**  
   - Variable: `--font-hanken-grotesk`
   - Uso: Títulos de página (`<h1>`), encabezados de sección (`<h2>`, `<h3>`), modales, nombres de tarjetas y KPI values destacados.
   - Carácter: Geométrico, sólido, moderno y corporativo.
2. **`font-body` (Inter):**  
   - Variable: `--font-inter`
   - Uso: Texto de lectura, descripciones, etiquetas de formularios, botones, inputs y cuerpo de tablas.
   - Carácter: Máxima legibilidad en pantallas retina y estándar.
3. **`font-mono` (JetBrains Mono):**  
   - Variable: `--font-jetbrains-mono`
   - Uso: Precios monetarios (`COP $...`), códigos de pedido (`#ORD-9821`), números de comprobante, fechas, horas y badges numéricos.
   - Carácter: Datos tabulares alineados y escaneo visual inmediato.

> **Nota sobre fuentes de plantillas gastronómicas:**  
> En el catálogo público QR (`src/components/menu/`) conviven fuentes estéticas temáticas cargadas vía `@import` en `globals.css`: *Cinzel* (Plantilla Elegante), *Outfit* / *Plus Jakarta Sans* (Plantilla Urbana) y *DM Sans*. Estas son exclusivas del módulo de menú público y **nunca deben usarse en el Workspace o panel administrativo**.

### 3.2 Escala Jerárquica y Pesos

| Nivel | Clases Tailwind Reales | Font-Family | Peso | Leading & Tracking |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | `text-xl sm:text-2xl` | `font-title` | `font-bold` (700) | `tracking-tight leading-tight` |
| **Section Title (H2)** | `text-lg sm:text-xl` | `font-title` | `font-bold` (700) | `leading-snug` |
| **Modal / Card Title (H3)** | `text-base sm:text-lg` | `font-title` | `font-bold` / `font-semibold` | `leading-snug` |
| **Item Title / Table Row Title** | `text-sm font-semibold` | `font-body` | 600 | `leading-normal` |
| **Body Regular / Inputs** | `text-xs sm:text-sm` | `font-body` | `font-normal` (400) | `leading-relaxed` |
| **Form Labels / Acciones** | `text-xs font-semibold` | `font-body` | 600 | `leading-normal` |
| **Helper Text / Tooltips** | `text-[11px]` | `font-body` | `font-medium` (500) | `leading-normal text-slate-400` |
| **Badges / Tags / Status** | `text-[10px] sm:text-[11px]` | `font-mono` / `font-body` | `font-bold` (700) | `uppercase tracking-wider` |
| **KPI Big Numbers** | `text-2xl sm:text-3xl` | `font-title` ó `font-mono` | `font-extrabold` (800) | `tracking-tight` |

### 3.3 Tratamiento de Precios y Moneda

Todas las cifras monetarias del sistema deben formatearse mediante `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.  
- **Visualización:** Siempre en `font-mono font-bold`.
- **Precios en catálogo con variantes:** Mostrar prefijo `"Desde $..."` con un badge de conteo de opciones `"+N opciones"`.

---

## 4. Geometría, Espaciado, Sombras y Elevación

### 4.1 Radios de Borde (Border Radius)

En los componentes reales de NEGOVA se aplica una escala de radios suave y moderna:

- `rounded-2xl` (16px): **Contenedores maestros**. Utilizado en `AppPageContainer`, tarjetas de métricas (`KpiCard`), tablas (`DataTable`), contenedores de filtros (`TableToolbar`), modales (`CustomModal`, `ConfirmModal`), tarjetas de productos y drawers.
- `rounded-xl` (12px): **Controles interactivos**. Utilizado en botones estándar (`Button size="md"`), inputs de texto (`Input`), selects (`Select`), items de lista, avatares y buscador (`SearchInput`).
- `rounded-lg` (8px): **Subcomponentes y microelementos**. Botones compactos (`Button size="sm"`), badges (`Badge`), tabs internos y casillas.
- `rounded-full` (9999px): **Pills y estados circulares**. Chips de categorías horizontales, dots de estado, switch toggles y scrollbar thumb.

> **Regla de Consistencia:**  
> Queda prohibido usar esquinas cuadradas (`rounded-none` o `rounded-sm`) en controles o tarjetas. La identidad de NEGOVA es amigable, redondeada y de precisión moderna.

### 4.2 Sombras y Elevación

NEGOVA implementa la **Regla de la Elevación Única**:
- Una superficie define su elevación mediante un **borde nítido** (`border-slate-200/80` en claro, `border-white/[0.08]` en oscuro) más una **sombra muy sutil** (`shadow-xs` o `shadow-2xs`).
- **Modales y Diálogos Flotantes:** `shadow-2xl` con backdrop oscurecido y desenfoque (`bg-black/50 backdrop-blur-sm`).
- Se prohíben sombras difusas pesadas de color negro sólido que enturbien la interfaz.

### 4.3 Dimensiones y Alturas Estándar de Controles

Para garantizar alineación visual milimétrica en formularios y toolbars:
- **Control Pequeño (`sm`):** `h-8` (32px), `px-3`, texto `11px`, radio `rounded-lg`.
- **Control Estándar (`md`):** `h-10` (40px), `px-3.5` a `px-4`, texto `xs` (12px), radio `rounded-xl`.
- **Control Grande (`lg`):** `h-12` (48px), `px-5`, texto `sm` (14px), radio `rounded-xl`.

---

## 5. Botones y Acciones

### 5.1 Especificación de `Button` (`src/components/ui/button.tsx`)

El componente `Button` es el único estándar para interactuar con la plataforma. Dispone de soporte nativo para `Link` mediante la prop `href`, estado `isLoading` con spinner `Loader2`, iconos `leftIcon` y `rightIcon`.

```tsx
import { Button } from "@/components/ui/button";

// Acción primaria
<Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
  Nuevo Registro
</Button>

// Acción secundaria en outline
<Button variant="outline" size="sm" onClick={handleExport}>
  Exportar Reporte
</Button>
```

### 5.2 Matriz de Variantes de Botones

| Variante | Clases Base | Hover / Active | Propósito y Regla de Uso |
| :--- | :--- | :--- | :--- |
| **`primary`** | `bg-[#ED500A] text-white shadow-xs` | `hover:bg-[#D44405] active:bg-[#B83B04]` | **Solo 1 botón primario** por bloque o modal. Acción principal afirmativa ("Guardar", "Crear", "Pagar"). |
| **`secondary`** | `bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200` | `hover:bg-slate-200 dark:hover:bg-white/15 active:bg-slate-300` | Acciones complementarias de soporte ("Gestionar", "Filtrar", "Ver detalle"). |
| **`outline`** | `border border-slate-200 dark:border-white/10 bg-transparent text-slate-700 dark:text-slate-200` | `hover:bg-slate-50 dark:hover:bg-white/[0.05] active:bg-slate-100` | Botones de cancelación, recargar datos, cerrar modales y navegación secundaria. |
| **`ghost`** | `bg-transparent text-slate-600 dark:text-slate-400 border-transparent` | `hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]` | Botones dentro de filas de tablas, toolbars compactos y navegación en tabs. |
| **`destructive`** | `bg-red-600 text-white shadow-xs` | `hover:bg-red-700 active:bg-red-800` | Acciones irreversibles ("Eliminar", "Archivar", "Desvincular"). Debe ir acompañado de `ConfirmModal`. |
| **`success`** | `bg-emerald-600 text-white shadow-xs` | `hover:bg-emerald-700 active:bg-emerald-800` | Acciones terminales de cobro o confirmación exitosa de entregas/pedidos. |

### 5.3 `IconButton` y `ButtonGroup`

- **`IconButton`:** Diseñado con proporción 1:1 (`w-8 h-8`, `w-10 h-10`, `w-12 h-12`). Exige obligatoriamente la prop `title` para garantizar el atributo accesible `aria-label`.
- **`ButtonGroup`:** Contenedor flex `inline-flex items-center gap-1.5` para agrupar botones de acción rápida en cabeceras de tablas.

---

## 6. Campos y Controles de Entrada

### 6.1 `Input` (`src/components/ui/input.tsx`)

- **Estructura:** Contenedor vertical con `label` (`text-xs font-semibold`), asterisco rojo para `required`, soporte para `leftIcon` (ej. lupa o candado), `rightElement` (ej. botón ver contraseña), mensaje de `error` (`text-red-500`) o `helperText` (`text-slate-400`).
- **Altura canónica:** `h-10` con `rounded-xl`.
- **Foco:** `focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] focus:outline-hidden`.

### 6.2 `Select` y `SearchSelect`

- **`Select` (`src/components/ui/select.tsx`):** Selector nativo estilizado con flecha `ChevronDown` posicionada a la derecha, soporte para `options` estructuradas o `children`, y modo de color asegurado para desplegables (`color-scheme` explícito en dark/light).
- **`SearchSelect` (`src/components/ui/search-select.tsx`):** Selector avanzado de alto rendimiento con caja de búsqueda en tiempo real, scroll optimizado, limpieza rápida (`clearable`), descripciones de fila y soporte de iconos. Ideal para clientes, productos, cuentas contables y sucursales.

### 6.3 `SearchInput` (`src/components/ui/search-input.tsx`)

Buscador especializado con icono de lupa fijo, spinner de estado asíncrono (`isLoading`), tecla de atajo rápido, botón de borrado rápido (`X`) y callback `onSubmit` / `onChange`.

---

## 7. Contenedores, Tarjetas y Superficies

### 7.1 Contenedor Maestro de Página: `AppPageContainer`

Ubicación: `src/components/layout/app-page-container.tsx`  
Es el marco estructural que envuelve cada vista del Workspace:
- **Cabecera integrada:** Título en `font-title` con tamaño responsivo (`text-xl sm:text-2xl`), soporte para descripción explicativa, `badge` de estado y bloque de `actions` a la derecha.
- **Ancho máximo configurable:** `maxWidth="7xl"` (por defecto), `"6xl"`, `"5xl"` o `"full"`.
- **Separador sutil:** Borde inferior `border-b border-slate-200 dark:border-white/[0.06]`.

```tsx
<AppPageContainer
  title="Catálogo de Productos"
  description="Administra los platos, artículos y servicios disponibles en tu comercio."
  badge={<StatusBadge status="active" label="Sincronizado" />}
  actions={
    <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
      Nuevo Producto
    </Button>
  }
>
  {/* Contenido de la vista */}
</AppPageContainer>
```

### 7.2 Tarjetas de Métricas: `KpiCard` y `KpiGrid`

Ubicación: `src/components/ui/kpi-card.tsx`  
- **Jerarquía:** Título superior con icono en caja redondeada `rounded-xl`, valor principal en tipografía grande adaptativa y subtexto o badge de tendencia (`trend`).
- **Variantes semánticas:** `default`, `orange`, `emerald`, `amber`, `red`, `purple`, `blue`.
- **Interacción:** Soporte para `onClick` y estado seleccionado `isSelected` con anillo de foco `ring-2 ring-[#ED500A]/30`.
- **`KpiGrid`:** Grid responsivo automático con soporte para 2, 3, 4 ó 5 columnas.

---

## 8. Modales, Diálogos y Overlays

> [!CRITICAL]
> **Prohibición de Diálogos Nativos:**  
> Queda terminantemente prohibido el uso de `window.alert()`, `window.confirm()` o `window.prompt()`. Toda interacción modal debe utilizar los componentes oficiales sobre `ModalPortal`.

### 8.1 `CustomModal` (`src/components/ui/custom-modal.tsx`)

Modal multipropósito para formularios, información y alertas de sistema:
- **Backdrop:** `fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm animate-in fade-in`.
- **Caja de diálogo:** `rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl p-6`.
- **Anchos soportados:** `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`.
- **Iconos contextuales:** `info` (azul), `warning` (ámbar), `error` (rojo), `success` (esmeralda).

### 8.2 `ConfirmModal` (`src/components/ui/confirm-modal.tsx`)

Modal especializado para confirmar operaciones críticas o destructivas:
- **Variantes:** `danger` (botón rojo), `warning` (botón ámbar), `default` (botón naranja).
- **Seguridad:** Bloqueo de doble clic con soporte para `Promise` en `onConfirm` y spinner `Loader2`.
- **Accesibilidad:** Atributos `role="dialog"` y `aria-modal="true"`.

---

## 9. Tablas, Listados y Paginación

### 9.1 `DataTable` (`src/components/ui/data-table.tsx`)

El motor de visualización tabular del proyecto cuenta con:
1. **Encabezados:** Tipografía monoespaciada `font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500`.
2. **Filas:** Altura ergonómica con padding vertical `py-3.5 px-4`, hover sutil `hover:bg-slate-50/70 dark:hover:bg-white/[0.02]` y soporte opcional de fila clickeable (`onRowClick`).
3. **Columna Fija en Scroll Horizontal (`stickyFirstColumn`):** Permite fijar la primera columna (ej. Código o Nombre de Cliente) mientras el usuario desliza horizontalmente el resto de datos.
4. **Transformación Móvil (`renderMobileCard`):** En resoluciones menores a `md`, la tabla oculta el formato tabular denso y renderiza tarjetas móviles limpias y legibles automáticamente.

### 9.2 `TableToolbar` (`src/components/ui/table-toolbar.tsx`)

Barra de control que unifica:
- Buscador reactivo integrado (`SearchInput`).
- Selector de categorías o estados por pestañas (`tabs`).
- Filtros desplegables y botón de recarga con animación de giro (`RefreshCw`).
- Diseños disponibles: `inline` (para herramientas compactas) y `stacked` (para filtrado multicriterio avanzado).

### 9.3 `Pagination` (`src/components/ui/pagination.tsx`)

Control de paginación con desglose de registros visibles (`Mostrando 1–10 de 154 registros`), selector de salto a página primera/última opcional y botones anterior/siguiente desactivados con opacidad al cargar.

---

## 10. Navegación y Estructura de Layout

### 10.1 `AppSidebar` y Navegación de Módulos

Ubicación: `src/components/layout/app-sidebar.tsx`  
- **Modo Expandido (260px):** Muestra el isotipo oficial, selector de módulos agrupados por secciones colapsables (Operaciones, Catálogo, Gestión, Administración, Sistema) con badges de conteo y enlaces con detección activa inteligente de ruta (`isRouteActive`).
- **Modo Colapsado (72px):** Muestra los iconos principales de operación directa y un botón de acceso directo a un **Flyout flotante de búsqueda** (`isModulesFlyoutOpen`) que permite filtrar y acceder a cualquier módulo en 1 segundo.
- **Móvil (`AppMobileSidebar`):** Drawer lateral con backdrop desenfocado que se abre mediante el botón hamburguesa del topbar.

### 10.2 `AppTopbar` (`src/components/layout/app-topbar.tsx`)

Barra superior fija (`sticky top-0 z-20 h-16`) con fondo translúcido `backdrop-blur-md`:
- **Izquierda:** Botón menú hamburguesa (solo móvil) + `AppBreadcrumbs` con nombres reales mapeados según la ruta.
- **Derecha:** Reloj digital en vivo con zona horaria oficial del negocio (`Bogotá UTC-5`), selector de notificaciones y `AppUserMenu` con avatar, perfil, rol y selector de tema claro/oscuro.

### 10.3 `GlobalScrollbar` (`src/components/layout/global-scrollbar.tsx`)

Scrollbar ultrafino de 6px con thumb naranja de 44px de altura (`#ED500A`), sin pista de fondo, interactivo para drag y click. Oculta la barra tosca nativa de Windows en navegadores desktop y se desactiva en móviles táctiles para respetar el scroll inercial natural de iOS y Android.

---

## 11. Feedback, Notificaciones y Estados

### 11.1 Notificaciones Toast (Sonner)

Todas las respuestas a acciones del usuario se comunican mediante Sonner:
- `toast.success(mensaje, { description?: ... })`: Confirmación de operaciones exitosas (guardado, archivado, copiado al portapapeles).
- `toast.error(mensaje, { description?: ... })`: Errores de validación, red o permisos.
- `toast.info(mensaje)`: Avisos de estado o recomendaciones de operación.

### 11.2 `Badge` y `StatusBadge`

- **`Badge` (`src/components/ui/badge.tsx`):** Etiquetas de uso general con soporte para punto indicador (`dot`), icono y variantes de color (`orange`, `emerald`, `amber`, `red`, `blue`, `purple`, `slate`).
- **`StatusBadge` (`src/components/ui/status-badge.tsx`):** Etiqueta especializada de estados de negocio. Mapea automáticamente estados como `active` (Activo, esmeralda), `trial` (En prueba, azul), `pending` (Pendiente, ámbar), `suspended`/`blocked` (Bloqueado, rojo) e `inactive`/`cancelled` (Cancelado, slate).

### 11.3 Skeletons de Carga, Pantallas Vacías y Manejo de Errores (Estándar DS-002)

Todos los módulos del Workspace y del Panel de Administración deben implementar de forma obligatoria y consistente la tríada de estados visuales del Design System:

1. **Estado de Carga (`src/components/ui/loading-skeleton.tsx`):**
   - **`TableSkeleton`:** Simula cabecera y filas parpadeantes (`animate-pulse`) durante peticiones o transiciones asíncronas (`rows={5}`, `cols={n}`).
   - **`KpiSkeleton`:** Simula el grid de tarjetas de métricas (`count={4}`).
   - **`CardSkeleton`:** Simula tarjetas o grids de tarjetas de productos, recetas, ubicaciones o proveedores.
   - **`LoadingSkeleton`:** Bloque genérico de shimmer para encabezados, botones y líneas de texto.
   - **`DataTable`:** Al recibir `isLoading={true}`, renderiza automáticamente `TableSkeleton` ajustado al número de columnas.

2. **Estado Vacío (`src/components/ui/empty-state.tsx`):**
   - Pantalla limpia y amigable cuando una consulta no tiene registros o un filtro no arroja resultados.
   - **Propiedades obligatorias:**
     - `icon`: Icono contextual de Lucide centrado en caja redondeada con fondo suave.
     - `title`: Título claro y conciso del estado (ej. `"No se encontraron clientes"`).
     - `description`: Explicación instructiva indicando el motivo o cómo empezar.
     - `actionLabel` + (`actionHref` o `onAction`): Acción primaria para crear el primer registro (ej. `"Nuevo cliente"`).
     - `resetLabel` + `onReset`: Acción secundaria para restablecer filtros cuando hay una búsqueda o filtro activo.
   - **`DataTable`:** Si `data.length === 0`, renderiza el `emptyState` provisto o un fallback informativo estándar para nunca dejar un `<tbody>` en blanco.

3. **Estado de Error (`src/components/ui/error-state.tsx`):**
   - Tarjeta contenida con borde sutil, icono de advertencia, título explicativo y mensaje de error amigable.
   - **Propiedad obligatoria de recuperación:** `onRetry` que ejecuta la función de recarga o reintento de la consulta.
   - Soporte opcional para acción secundaria de navegación (`secondaryActionLabel` y `secondaryActionHref`, ej. `"Ir al Inicio"`).
   - Implementado tanto a nivel de componente (`DataTable.errorState`, tabs y paneles cliente) como en el boundary global de Next.js (`src/app/workspace/[businessId]/error.tsx`).

---

## 12. Iconografía, Avatares y Elementos Gráficos

### 12.1 Biblioteca Oficial de Iconos

- **Biblioteca Exclusiva:** `lucide-react`. Está **estrictamente prohibido** instalar FontAwesome, Material Icons o Heroicons para evitar inconsistencias de grosor o peso visual.
- **Grosores y tamaños habituales:**
  - Microiconos en badges y botones compactos: `w-3.5 h-3.5`
  - Iconos estándar en botones e inputs: `w-4 h-4`
  - Iconos en topbar y acciones de fila: `w-5 h-5`
  - Iconos en cajas de KPIs y estados vacíos: `w-6 h-6` a `w-8 h-8`

### 12.2 `UserAvatar` (`src/components/ui/user-avatar.tsx`)

Componente universal de usuario:
- Si el usuario cuenta con foto real (`src`), renderiza la imagen con `object-cover`.
- Si no tiene imagen o si la URL externa falla, delega determinísticamente en `Avvvatars` con el estilo `"shape"` o `"character"` (iniciales) y un radio squircle de 9px (`radius=9`).

---

## 13. Formularios y Flujos Operativos

### Convenciones Obligatorias en Formularios

1. **Estructura en Modales o Paneles:**
   - Formularios rápidos (creación de categoría, cliente o mesa): Desplegar dentro de `CustomModal` con `maxWidth="lg"` o `"xl"`.
   - Formularios complejos (creación de producto con variantes, modificadores e inventario): Usar modal con pestañas internas (`maxWidth="4xl"`).
2. **Validación:**
   - Todos los inputs requeridos muestran un asterisco naranja `text-[#ED500A]`.
   - Los errores de campo se renderizan debajo del input en `text-[11px] text-red-500 font-medium font-body`.
3. **Pie de Formulario (Actions Bar):**
   - Alineado a la derecha (`flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]`).
   - Botón secundario a la izquierda ("Cancelar") con variante `outline`.
   - Botón de guardado a la derecha con variante `primary` e `isLoading={isPending}`.

---

## 14. Componentes y Patrones de Dominio

### 14.1 Módulo POS (Punto de Venta)

Ubicación: `src/components/pos/*`
- **Layout de pantalla dividida:** Catálogo de productos con grid táctil a la izquierda y carrito de compra fijo con totales y selector de destino a la derecha.
- **Modales integrados:**
  - `ModifierSelectionModal`: Permite seleccionar términos de cocción, adiciones y salsas con cálculo dinámico del precio en tiempo real.
  - `OrderDestinationModal`: Configura si el pedido es para Llevar, Domicilio o Mesa física.
  - `OrderSuccessModal`: Confirma la orden emitida con botón de impresión directa de comanda o ticket térmico.

### 14.2 Menú Digital Público (Catálogo QR)

Ubicación: `src/components/menu/*`
- Admite cuatro plantillas gráficas (`template_id`):
  1. **Urbana:** Fast food, tipografías condensadas de alto impacto y cards oscuras.
  2. **Comercial:** Retail, minimercados y farmacias, con visualización compacta y foco en precio.
  3. **Elegante:** Bistrós, vinos y gastronomía fina, con acentos dorados champagne (`#D4AF37`) y tipografía clásica.
  4. **Visual:** Fotografía culinaria a gran escala en formato lookbook.
- **Integración WhatsApp:** Carrito lateral `MenuCartDrawer` que genera el enlace `https://wa.me/...` formateando los platos, cantidades y total sin fricción.

---

## 15. Responsive y Accesibilidad

### 15.1 Breakpoints Oficiales del Proyecto

| Breakpoint | Ancho Mínimo | Comportamiento del Layout |
| :--- | :--- | :--- |
| **`sm`** | `640px` | Pasa de 1 a 2 columnas en KpiCards y formularios; activa botones de texto completo. |
| **`md`** | `768px` | **Breakpoint de Tablas:** Cambia de tarjetas móviles a la tabla `DataTable` desktop completa. |
| **`lg`** | `1024px` | **Breakpoint del Sidebar:** Oculta el menú hamburguesa y fija el `AppSidebar` en la pantalla. |
| **`xl`** | `1280px` | Catálogo de productos pasa a 4 columnas; toolbars se expanden horizontalmente. |
| **`2xl`** | `1536px` | Monitor ancho para paneles POS de doble estación y paneles de control. |

### 15.2 Accesibilidad (a11y)

- **Contraste mínimo:** Toda combinación de texto sobre fondo cumple la norma WCAG AA (ratio ≥ 4.5:1).
- **Enfoque visible:** Todo elemento interactivo dispone de `focus:ring-2 focus:ring-[#ED500A]/30`.
- **Navegación por teclado:** Modales capturan el foco y se cierran con la tecla `Escape`.
- **Tamaños táctiles mínimos:** Todo botón o enlace en móvil tiene una altura mínima de 40px (`h-10`) o 44px en catálogos táctiles para prevenir toques erróneos.

---

## 16. Inventario Completo de Componentes Compartidos

| Componente | Ubicación en el Código | Props Principales | Propósito |
| :--- | :--- | :--- | :--- |
| **`Button`** | `src/components/ui/button.tsx` | `variant`, `size`, `isLoading`, `leftIcon`, `rightIcon`, `href` | Botón estándar y enlace con estilo de botón para toda la aplicación. |
| **`IconButton`** | `src/components/ui/button.tsx` | `icon`, `title`, `variant`, `size`, `isLoading`, `href` | Botón cuadrado para acciones con icono puro (requiere `title`). |
| **`ButtonGroup`** | `src/components/ui/button.tsx` | `children`, `className` | Agrupador horizontal de acciones. |
| **`Input`** | `src/components/ui/input.tsx` | `label`, `error`, `helperText`, `leftIcon`, `rightElement`, `required` | Entrada de texto, número, contraseña o búsqueda simple. |
| **`Select`** | `src/components/ui/select.tsx` | `label`, `options`, `value`, `onChange`, `error`, `placeholder` | Selector desplegable estilizado con soporte de opciones y children. |
| **`SearchInput`** | `src/components/ui/search-input.tsx` | `value`, `onChange`, `onSubmit`, `onClear`, `isLoading`, `placeholder` | Campo de búsqueda con lupa, spinner y limpieza instantánea. |
| **`SearchSelect`** | `src/components/ui/search-select.tsx` | `options`, `value`, `onChange`, `clearable`, `searchPlaceholder` | Combobox de búsqueda interactivo con popover filtrable. |
| **`Badge`** | `src/components/ui/badge.tsx` | `variant`, `size`, `dot`, `icon`, `children` | Etiqueta de categorización, conteo o resaltado. |
| **`StatusBadge`** | `src/components/ui/status-badge.tsx` | `status`, `label`, `variant`, `showDot`, `icon` | Badge semántico que mapea automáticamente los estados de negocio. |
| **`KpiCard`** | `src/components/ui/kpi-card.tsx` | `title`, `value`, `subtext`, `icon`, `variant`, `isSelected`, `trend` | Tarjeta de métrica con icono contextual y tendencia. |
| **`KpiGrid`** | `src/components/ui/kpi-card.tsx` | `cols` (2, 3, 4, 5), `children` | Rejilla responsive calibrada para tarjetas de métricas. |
| **`DataTable`** | `src/components/ui/data-table.tsx` | `columns`, `data`, `keyExtractor`, `stickyFirstColumn`, `renderMobileCard`, `pagination` | Tabla de datos con soporte móvil, columna fija y estados. |
| **`TableToolbar`** | `src/components/ui/table-toolbar.tsx` | `searchQuery`, `onSearchChange`, `tabs`, `filters`, `actions`, `onRefresh` | Barra superior para tablas con búsqueda, filtros y acciones. |
| **`Pagination`** | `src/components/ui/pagination.tsx` | `currentPage`, `totalPages`, `totalItems`, `onPageChange`, `pageSize` | Paginador con conteo de registros y botones de navegación. |
| **`Tabs`** | `src/components/ui/tabs.tsx` | `tabs`, `activeTab`, `onChange`, `size` | Barra horizontal de pestañas con soporte de badges e iconos. |
| **`CustomModal`** | `src/components/ui/custom-modal.tsx` | `isOpen`, `onClose`, `title`, `description`, `type`, `maxWidth`, `children` | Modal general para formularios y avisos de sistema. |
| **`ConfirmModal`** | `src/components/ui/confirm-modal.tsx` | `isOpen`, `onClose`, `onConfirm`, `title`, `variant` (danger/warning), `isLoading` | Diálogo de confirmación para acciones críticas y destructivas. |
| **`ModalPortal`** | `src/components/ui/modal-portal.tsx` | `children` | Renderizador de portales en el body (`document.body`). |
| **`EmptyState`** | `src/components/ui/empty-state.tsx` | `icon`, `title`, `description`, `actionLabel`, `onAction`, `onReset` | Vista vacía para tablas, listas o búsquedas sin resultados. |
| **`ErrorState`** | `src/components/ui/error-state.tsx` | `title`, `description`, `onRetry`, `isRetrying` | Vista de error de carga con botón de reintento. |
| **`LoadingSkeleton`** | `src/components/ui/loading-skeleton.tsx`| `className` | Barra de carga con animación pulse. |
| **`TableSkeleton`** | `src/components/ui/loading-skeleton.tsx`| `rows`, `cols` | Estructura esqueleto de tabla mientras se reciben datos del servidor. |
| **`KpiSkeleton`** | `src/components/ui/loading-skeleton.tsx`| `count` | Esqueleto de tarjetas métricas. |
| **`UserAvatar`** | `src/components/ui/user-avatar.tsx` | `src`, `name`, `value`, `size`, `radius`, `style` | Avatar universal que combina foto de usuario o Avvvatars geométricos. |
| **`AppPageContainer`**| `src/components/layout/app-page-container.tsx` | `title`, `description`, `badge`, `actions`, `maxWidth`, `children` | Contenedor principal de página con cabecera y bordes estándar. |

---

## 17. Auditoría de Inconsistencias y Plan de Consolidación

La auditoría transversal de todo el código de NEGOVA ha revelado las siguientes inconsistencias reales que deben conocerse y corregirse progresivamente:

### 17.1 Desconexión entre Tokens de Color de Tailwind y Botones de Acción
- **Problema:** En `tailwind.config.ts` y `globals.css`, la variable `--primary` está definida como un gris corporativo neutro (`hsl 220 3% 37%`), mientras que el verdadero color primario de acción en toda la plataforma es el **Naranja NEGOVA** (`#ED500A` / `--accent`). Por esta razón, componentes como `Button` y tarjetas tuvieron que codificar estilos fijos como `bg-[#ED500A]` en lugar de consumir `bg-primary`.
- **Corrección Recomendada:** En una fase de consolidación, alinear los tokens de Tailwind para que `--primary` represente el Naranja NEGOVA (`18 92% 48%`) o estandarizar el uso de `accent` para acciones afirmativas.

### 17.2 Desconexión de la Variable `--radius`
- **Problema:** En `globals.css`, `--radius: 0.25rem;` (4px), pero los componentes reales utilizan sistemáticamente `rounded-xl` (12px) y `rounded-2xl` (16px).
- **Corrección Recomendada:** Actualizar la variable CSS `--radius: 0.75rem;` (12px) para reflejar fielmente la geometría real del sistema.

### 17.3 Duplicación de Diálogos de Confirmación
- **Problema:** Coexisten `src/components/ui/confirm-modal.tsx` (114 líneas) y `src/components/admin/ui/admin-confirm-dialog.tsx` (164 líneas). El módulo de pedidos (`orders-list-client.tsx`) utiliza `AdminConfirmDialog`, mientras que el módulo de productos y POS utilizan `ConfirmModal`.
- **Corrección Recomendada:** Consolidar en `src/components/ui/confirm-modal.tsx` y convertir `admin-confirm-dialog.tsx` en un re-exportador idéntico al resto de componentes delegados en `admin/ui`.

### 17.4 Reinvención Local de Controles en Módulos de Catálogo y Clientes
- **Problema:**
  - En `src/app/workspace/[businessId]/productos/products-manager-client.tsx`, la barra de búsqueda y los botones fueron codificados manualmente con etiquetas HTML nativas (`<input className="...">`, `<button className="...">`) en vez de importar `<SearchInput>` y `<Button>`.
  - En `src/app/workspace/[businessId]/clientes/customers-list-client.tsx`, se utilizaron clases de la escala `neutral-*` (`bg-neutral-900`, `border-neutral-200`) en lugar de la paleta oficial `slate-*` / `[#0D0F16]` que rige en el resto del proyecto.
- **Corrección Recomendada:** Refactorizar ambos módulos para que consuman `DataTable`, `TableToolbar`, `SearchInput` y `Button` de `@/components/ui`.

### 17.5 Mezcla de Importaciones Directas y Aliases `admin/ui`
- **Problema:** Varios archivos del Workspace importan desde `@/components/admin/ui` (ej. `AdminDataTable`, `AdminSelect`), mientras que módulos nuevos importan directamente desde `@/components/ui`.
- **Corrección Recomendada:** Homogeneizar todos los imports hacia `@/components/ui`.

---

## 18. Reglas Obligatorias para Futuros Desarrollos

Cualquier funcionalidad nueva, página, modal o ajuste visual que se desarrolle en NEGOVA debe respetar estrictamente estas 10 directrices:

1. **Buscar y Reutilizar Primero:** Antes de redactar cualquier etiqueta HTML o clase de Tailwind, consultar el [Inventario de Componentes Compartidos](#16-inventario-completo-de-componentes-compartidos). Está prohibido escribir `<button>` o `<input>` manuales cuando existan `Button`, `Input`, `Select` o `SearchInput`.
2. **Uso de Colores Oficiales:** Utilizar exclusivamente la paleta oficial de modo claro/oscuro y el naranja `#ED500A` para acciones primarias. Prohibido inventar colores arbitrarios o mezclar escalas (`zinc`, `neutral` o `gray`) con la base `slate`.
3. **Prohibición Total de Diálogos Nativos:** Nunca utilizar `alert()`, `confirm()` ni `prompt()`. Todo diálogo de confirmación debe implementarse con `ConfirmModal` y todo mensaje de feedback con `toast` de Sonner.
4. **Geometría Coherente:** Respetar los radios oficiales: `rounded-2xl` para contenedores y modales, `rounded-xl` para botones e inputs, `rounded-lg` para badges y `rounded-full` para pills.
5. **Iconografía Única con Lucide:** Emplear únicamente iconos provenientes de `lucide-react`. Mantener consistencia en tamaños (`w-4 h-4` para controles, `w-5 h-5` para acciones).
6. **Estructura con `AppPageContainer`:** Toda página de primer nivel dentro del Workspace debe comenzar con `<AppPageContainer title="..." description="...">`.
7. **Diseño Responsive Obligatorio:** Toda tabla de datos debe incorporar la propiedad `renderMobileCard` o activar scroll horizontal para garantizar usabilidad completa en teléfonos móviles.
8. **Tipografía Semántica:** No modificar las familias tipográficas. Los títulos usan `font-title`, el cuerpo `font-body` y las cifras o códigos `font-mono`.
9. **Estados Completos:** Toda vista asíncrona debe implementar sus cuatro estados visuales: Carga (`TableSkeleton` o `KpiSkeleton`), Vacío (`EmptyState`), Error (`ErrorState`) y Datos.
10. **Actualización del Sistema:** Si una nueva necesidad de negocio requiere crear un componente reutilizable nuevo, este debe colocarse en `src/components/ui/` y documentarse en este archivo `DESIGN_SYSTEM.md`.

---

## 19. Checklist de Cumplimiento Pre-Deploy

Antes de dar por finalizada cualquier tarea de desarrollo o interfaz en NEGOVA, verificar:

- [ ] ¿Se utilizó `AppPageContainer` como envoltorio de la página?
- [ ] ¿Los botones usan el componente `<Button>` con sus variantes semánticas oficiales?
- [ ] ¿Los campos de entrada utilizan `<Input>`, `<Select>` o `<SearchSelect>`?
- [ ] ¿Se eliminó cualquier llamada a `window.alert`, `window.confirm` o `window.prompt`?
- [ ] ¿Las confirmaciones usan `<ConfirmModal>` montado sobre `ModalPortal`?
- [ ] ¿El feedback asíncrono utiliza `toast.success` o `toast.error` de `sonner`?
- [ ] ¿Los estados vacíos implementan `<EmptyState>` con icono y acción de resolución?
- [ ] ¿Los estados de carga muestran `<TableSkeleton>`, `<KpiSkeleton>` o spinners en botones?
- [ ] ¿Los precios y cifras numéricas están formateados con `font-mono` y en moneda local?
- [ ] ¿La interfaz se probó y funciona impecablemente en modo claro y en modo oscuro (`.dark`)?
- [ ] ¿La vista se probó en pantalla pequeña (ancho 375px–640px) sin desbordamientos horizontales accidentales?
