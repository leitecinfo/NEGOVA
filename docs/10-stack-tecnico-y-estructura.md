# Stack Tecnológico y Estructura de Proyecto — NEGOVA

Este documento define de forma precisa la arquitectura, stack técnico cerrado y la estructura de carpetas oficial para **NEGOVA**, garantizando escalabilidad, mantenibilidad y un enfoque SaaS multi-tenant sin dependencias redundantes ni servicios desacoplados innecesarios.

---

## 1. Stack Principal

| Área | Tecnología | Descripción |
| --- | --- | --- |
| **Framework** | Next.js (App Router) | Núcleo del frontend/backend integrado con Server Components y Server Actions |
| **Lenguaje** | TypeScript | Modo estricto habilitado sin código JS en desarrollo |
| **UI** | React | Biblioteca de componentes de interfaz |
| **Estilos** | Tailwind CSS | Sistema utilitario con NEGOVA Design System |
| **Componentes** | shadcn/ui | Componentes copiables dentro del código base adaptables a NEGOVA |
| **Iconos** | Lucide React | Familia única de iconografía uniforme |
| **Backend / DB** | Supabase (PostgreSQL) | Backend as a Service con PostgreSQL, Auth y Storage |
| **Autenticación** | Supabase Auth | Manejo de sesiones, roles, logins y flujos de contraseña |
| **Storage** | Supabase Storage | Almacenamiento de archivos y multimedia por negocio |
| **Hosting** | Vercel | Despliegue optimizado para Next.js App Router |
| **Validación** | Zod | Esquemas de validación unificados en cliente y servidor |
| **Formularios** | React Hook Form | Gestión eficiente de formularios React |
| **Tablas** | TanStack Table | Tablas interactivas avanzadas para vistas administrativas |
| **Estado Global** | Zustand | Estado global estrictamente UI (sidebar, tenant activo, UI prefs) |
| **Fechas** | date-fns | Manipulación y formateo de fechas y periodos |
| **Gráficas** | Recharts | Métricas y analíticas visuales para dashboards |
| **Notificaciones** | Sonner | Componente toast de notificaciones sin alertas nativas |
| **Utilidades de Clase** | clsx + tailwind-merge | Combinación limpia de clases de Tailwind CSS |
| **Animaciones** | Framer Motion | Animaciones sutiles (Sidebar, modales, transiciones de carga) |
| **Pagos** | Stripe | Procesamiento de pagos, suscripciones y cobros recurrentes |
| **Email** | Resend | Envío de correos transaccionales |
| **Testing** | Vitest + Testing Library | Pruebas unitarias y de integración |
| **E2E Testing** | Playwright | Pruebas end-to-end para flujos críticos (Auth, Checkout, Tenant setup) |
| **Calidad de Código** | ESLint + Prettier | Linter estricto y formateador uniforme |

---

## 2. Decisiones Arquitectónicas Clave

1. **Sin Backend Node separado ni Prisma:** Todo el flujo backend se canaliza mediante Next.js Route Handlers / Server Actions y Supabase PostgreSQL con RLS (Row Level Security).
2. **Multi-tenancy nativo mediante Supabase RLS:** La aislamiento de datos entre Negocios no depende únicamente de la lógica de aplicación (`where business_id = ...`), sino de políticas estrictas de RLS en base de datos.
3. **No alertas nativas:** Se prohíbe el uso de `window.alert`, `window.confirm` o `window.prompt`. Toda interacción requiere dialogs personalizados o notificaciones Sonner.
4. **Zustand acotado:** Solo para estado UI global. Los datos de servidor se obtienen vía Server Components/Actions y Supabase Client/Server SDK.

---

## 3. Estructura Completa de Carpetas

```text
negova/
│
├── public/
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── recuperar-contrasena/
│   │   │   │   └── page.tsx
│   │   │   └── restablecer-contrasena/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── negocios/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── crear/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── editar/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── usuarios/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── agregar/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── [userId]/
│   │   │   │       │       └── editar/
│   │   │   │       │           └── page.tsx
│   │   │   │       ├── suscripcion/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── facturacion/
│   │   │   │           └── page.tsx
│   │   │   ├── usuarios/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── crear/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── editar/
│   │   │   │           └── page.tsx
│   │   │   ├── suscripciones/
│   │   │   │   └── page.tsx
│   │   │   └── facturacion/
│   │   │       └── page.tsx
│   │   │
│   │   ├── api/
│   │   │   └── webhooks/
│   │   │       └── stripe/
│   │   │           └── route.ts
│   │   │
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── app-header.tsx
│   │   │   ├── app-shell.tsx
│   │   │   └── mobile-navigation.tsx
│   │   └── shared/
│   │       ├── data-table.tsx
│   │       ├── page-header.tsx
│   │       ├── status-badge.tsx
│   │       ├── empty-state.tsx
│   │       ├── loading-state.tsx
│   │       └── confirm-dialog.tsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── actions/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── businesses/
│   │   │   ├── components/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── schemas/
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   ├── users/
│   │   │   ├── components/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── subscriptions/
│   │   │   ├── components/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   └── billing/
│   │       ├── components/
│   │       ├── actions/
│   │       ├── queries/
│   │       ├── schemas/
│   │       └── types.ts
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── admin.ts
│   │   │   └── middleware.ts
│   │   ├── stripe/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── webhooks.ts
│   │   ├── resend/
│   │   │   └── client.ts
│   │   ├── permissions/
│   │   │   ├── roles.ts
│   │   │   └── permissions.ts
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   └── use-sidebar.ts
│   │
│   ├── stores/
│   │   └── app-store.ts
│   │
│   ├── schemas/
│   ├── types/
│   │   ├── database.ts
│   │   ├── auth.ts
│   │   ├── business.ts
│   │   ├── user.ts
│   │   ├── subscription.ts
│   │   └── billing.ts
│   │
│   ├── config/
│   │   ├── navigation.ts
│   │   ├── site.ts
│   │   └── plans.ts
│   └── constants/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.local
├── .env.example
├── .gitignore
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```
