# NEGOVA — Definición del Producto (Secciones 1 a 5)

**Versión:** 1.0  
**Estado:** Auditado y reestructurado  
**Producto:** NEGOVA  
**Arquitectura conceptual:** Core + Verticales  
**Primer vertical de validación:** Restaurantes de comida rápida  
**Mercado inicial:** Camarones, La Guajira, Colombia  

---

## 1. Información general

### 1.1 Nombre del producto

**NEGOVA**

### 1.2 Tipo de producto

Plataforma SaaS (Software as a Service) modular y multi-tenant orientada a la gestión y digitalización operativa de pequeños negocios.

### 1.3 Principio arquitectónico fundamental: Core + Verticales

NEGOVA **no es un software exclusivo para restaurantes**. 

La plataforma está concebida bajo una arquitectura modular compuesta por:
1. **NEGOVA CORE:** Núcleo común que provee capacidades esenciales e transversales para cualquier pequeño negocio (administración de cuenta, usuarios, roles, clientes, catálogo base de productos/servicios, registro de ventas, control de gastos, configuración e información operativa).
2. **VERTICALES DE NEGOCIO:** Módulos especializados que adaptan la operativa a tipos específicos de comercio sin alterar el núcleo común.

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
          Restaurantes    Barberías       Tiendas de      Farmacias /
          Comida Rápida   y Salones       Barrio          Otros
          (MVP Inicial)   (Extensión)     (Extensión)     (Extensión)
```

> **Nota de alcance:** Los futuros verticales (barberías, tiendas, farmacias, ferreterías, etc.) representan la visión de escalabilidad conceptual de la plataforma. **No forman parte del desarrollo ni de las funcionalidades del MVP actual**.

### 1.4 Primer vertical de validación

**Restaurantes pequeños y familiares de comida rápida.**

Este vertical ha sido seleccionado como el primer caso de uso real para implementar y validar la plataforma en campo debido a su alta dinámica operativa y necesidad de agilidad.

### 1.5 Mercado geográfico inicial

**Camarones, La Guajira, Colombia.**

Camarones representa el entorno inicial de prueba y validación en condiciones reales de conectividad y dinámica comercial comunitaria antes de la expansión a otros municipios de Colombia y Latinoamérica.

### 1.6 Público objetivo inicial

Propietarios, administradores y trabajadores de pequeños negocios (iniciando con restaurantes de comida rápida) que actualmente operan mediante WhatsApp, cuadernos, papel, comunicación verbal y procesos manuales.

### 1.7 Propósito y visión

- **Propósito:** Ayudar a los pequeños negocios a digitalizar y organizar su operación diaria mediante herramientas sencillas, rápidas y adaptadas a su forma real de trabajar, reduciendo la dependencia de procesos manuales sin imponer modelos corporativos complejos.
- **Visión:** Convertirse progresivamente en la plataforma de referencia para la digitalización de pequeños negocios en Colombia y Latinoamérica, ofreciendo herramientas accesibles, intuitivas y adaptadas a la realidad de cada vertical.

### 1.8 Propuesta de valor

NEGOVA centraliza las operaciones esenciales del pequeño negocio en una herramienta móvil y ágil, permitiendo gestionar pedidos, ventas, productos, clientes, pagos y finanzas operativas sin requerir infraestructura tecnológica costosa ni conocimientos técnicos avanzados.

### 1.9 Principio fundamental de diseño

> **NEGOVA se adapta al negocio, no el negocio a NEGOVA.**

El sistema parte de la realidad operativa del comerciante y busca digitalizarla con cero fricción, sin introducir pasos burocráticos que ralenticen la atención.

### 1.10 Filosofía del producto

1. **Simplicidad:** Interfaces directas y libres de sobrecarga cognitiva.
2. **Rapidez:** Tiempos de respuesta inmediatos y flujo de pocos toques.
3. **Facilidad de aprendizaje:** Curva de adopción casi nula.
4. **Adaptación al contexto local:** Operación natural en teléfonos y conexiones móviles.
5. **Reducción de carga manual:** Eliminación de errores por notas en papel y memoria.
6. **Claridad operativa:** Cuentas claras para el propietario al cierre del día.
7. **Bajo nivel de fricción:** No exigir requisitos innecesarios (ej. no obligar al cliente a crear cuenta para comprar).

---

## 2. Problemas

Para garantizar un diseño de producto limpio, separamos los problemas estructurales que afectan a los pequeños comercios en general de los problemas específicos del vertical gastronómico rápido.

### 2.1 Problemas generales de los pequeños negocios [CORE]

1. **Baja digitalización e informalidad operativa:** La gran mayoría de pequeños negocios gestiona sus actividades mediante cuadernos, hojas sueltas, notas en el celular y la memoria de los trabajadores.
2. **Información dispersa y no conectada:** Las ventas, gastos, datos de clientes y productos están fragmentados en diferentes medios, impidiendo una visión unificada del estado del negocio.
3. **Ausencia de herramientas tecnológicas adaptadas:** Los sistemas de software empresarial tradicionales (ERP/POS corporativos) son costosos, complejos de configurar y exigen hardware especializado (computadores, impresoras térmicas, lectores de barras) que los pequeños negocios no poseen ni necesitan.
4. **Dependencia absoluta de la memoria y personas clave:** Si el propietario o un trabajador clave se ausenta, se pierde el control de precios, deudores, clientes habituales o cuentas del día.
5. **Cálculo manual e impreciso de ventas y gastos:** Los registros manuales al final de la jornada dificultan saber con certeza cuánto dinero ingresó en efectivo, cuánto por transferencias y cuál fue el resultado operativo real.
6. **Falta de información histórica para decisiones:** Imposibilidad de saber con precisión qué productos se venden más, cuáles días son más rentables o cómo evolucionan los ingresos con el tiempo.

### 2.2 Problemas específicos del vertical: Restaurantes de comida rápida [VERTICAL RESTAURANTE]

1. **Gestión manual y caótica de pedidos:** En horas pico, la llegada simultánea de pedidos presenciales y por WhatsApp genera confusión, olvido de órdenes, retrasos en cocina y errores en los despachos.
2. **Pérdida de la cola u orden de preparación:** La operación se basa en el orden de llegada de los pedidos. Al anotarse en papeles o chats dispersos, se pierde la visibilidad de qué orden llegó primero y cuál debe prepararse a continuación.
3. **Falta de visibilidad sobre el estado de las órdenes:** Dificultad para saber en tiempo real si un pedido está recibido, en preparación, listo para recoger o despachado.
4. **Información desestructurada en chats de WhatsApp:** Los pedidos por chat contienen mensajes fragmentados (ej. "dos hamburguesas", "una sin cebolla", "para enviar a la esquina del parque") que requieren relectura constante y generan errores en preparación.
5. **Gestión informal de modificaciones de productos:** Solicitudes frecuentes de cambios (sin salsas, adición de queso, cambio de ingrediente) comunicadas verbalmente que suelen olvidarse durante la cocción.
6. **Disponibilidad de productos ligada a ingredientes:** En comida rápida, si se agota un insumo clave (ej. salchichas), todos los platos asociados quedan inhabilitados inmediatamente; sin un mecanismo rápido para marcarlos como agotados, se siguen ofreciendo productos que no se pueden preparar.
7. **Coordinación informal de entregas y domicilios:** Negocios con uno o pocos domiciliarios que desconocen qué pedidos están listos para salir, cuáles están en camino y si el valor del domicilio ya fue cancelado o debe cobrarse contra entrega.
8. **Separación y confusión entre el valor de la comida y el domicilio:** El cliente frecuentemente paga la comida por transferencia y el domicilio en efectivo al repartidor, lo que complica el cuadre de caja si no se registran por separado.

---

## 3. Objetivos

### 3.1 Objetivos de NEGOVA como plataforma [CORE]

1. **Construir una base SaaS multi-tenant sólida y escalable:** Diseñar un núcleo común capaz de gestionar negocios aislados, usuarios, permisos, catálogos base, transacciones y métricas financieras operativas.
2. **Democratizar la digitalización para micro y pequeños comercios:** Ofrecer una solución accesible desde cualquier teléfono inteligente, eliminando la barrera de entrada de hardware especializado.
3. **Centralizar la información operativa:** Permitir que los propietarios tengan control total y visibilidad instantánea de sus ventas, gastos y clientes en tiempo real.
4. **Habilitar la extensibilidad por verticales:** Establecer una arquitectura limpia que permita incorporar en el futuro nuevos verticales (barberías, tiendas, etc.) mediante módulos específicos sin alterar el Core.

### 3.2 Objetivos del MVP: Vertical Restaurante de Comida Rápida [VERTICAL RESTAURANTE]

1. **Centralizar los canales de pedidos:** Unificar en una sola cola operativa los pedidos recibidos por WhatsApp, de forma presencial y mediante el menú digital.
2. **Optimizar los tiempos de preparación y entrega:** Reducir errores y demoras en la preparación mediante una visualización clara del estado de cada orden.
3. **Agilizar el registro de pedidos en horas pico:** Permitir al personal registrar un pedido en pocos toques desde el celular sin fricción.
4. **Proveer un Menú Digital autogestionable y sin barreras:** Permitir a los clientes consultar productos actualizados y realizar pedidos directamente sin obligarlos a registrarse.
5. **Organizar el flujo de domicilios y cobros:** Controlar el estado de los envíos locales, separando claramente el cobro de productos del valor de entrega.
6. **Validar la adopción en campo:** Demostrar en Camarones, La Guajira, que un restaurante tradicional/familiar puede adoptar NEGOVA en su día a día y reemplazar el cuaderno de notas.

---

## 4. Usuarios y actores

NEGOVA distingue entre los actores generales de la plataforma y los actores específicos que intervienen en determinados verticales.

### 4.1 Actores generales de la plataforma [CORE]

```text
                            NEGOVA PLATAFORMA
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
         Superadministrador                     Negocio (Tenant)
          (Gestión SaaS)                              │
                                          ┌───────────┴───────────┐
                                          │                       │
                                     Propietario /           Trabajador /
                                     Administrador           Colaborador
                                          │                       │
                                          └───────────┬───────────┘
                                                      │
                                                   Cliente
```

1. **Superadministrador de NEGOVA:**
   - Rol técnico/administrativo global de la plataforma SaaS.
   - Administra los negocios registrados, suscripciones, planes y soporte general del sistema. No interviene en la operativa interna del negocio.
2. **Propietario / Administrador del negocio:**
   - Responsable principal del establecimiento.
   - Posee control total sobre la configuración de su negocio, catálogo de productos/servicios, gestión de trabajadores y permisos, consulta de ventas, registro de gastos, reportes y métricas de cierre.
3. **Trabajador / Colaborador:**
   - Persona que apoya la operación diaria (puede desempeñar múltiples funciones: atender, registrar pedidos, cobrar).
   - Accede a las funciones operativas asignadas por el propietario según su rol (registro de ventas, actualización de estados, consulta de catálogo).
4. **Cliente:**
   - Persona que adquiere productos o servicios del negocio.
   - Interactúa mediante canales digitales (ej. Menú Digital) o de forma presencial/telefónica.
   - **Regla CORE:** El cliente **no está obligado a crear una cuenta** para interactuar o comprar.

### 4.2 Actores específicos del vertical: Restaurantes de comida rápida [VERTICAL RESTAURANTE]

1. **Domiciliario / Repartidor (Opcional):**
   - Persona encargada de la entrega física de los pedidos a domicilio.
   - **Nota conceptual:** Este actor **no es universal del Core**. Solo existe en negocios gastronómicos o comerciales que gestionen entregas locales.
   - **Funciones:** Visualiza únicamente los pedidos asignados para despacho, dirección de entrega, valor a cobrar por el domicilio y confirmación de entrega realizada.
2. **Consideración sobre personal operativo (Cocina / Caja):**
   - En pequeños restaurantes, una misma persona o familiares atienden la caja, preparan alimentos y coordinan despachos. NEGOVA **no exige roles separados de cocina**; la cola de pedidos es compartida y visible para el equipo operativo.

---

## 5. Alcance

### 5.1 Alcance del CORE (Plataforma Base)

El núcleo de NEGOVA implementará:
- **Gestión Multi-Tenant:** Aislamiento total de datos por negocio registrado.
- **Autenticación y Seguridad:** Control de acceso seguro para propietarios y colaboradores con roles/permisos.
- **Configuración del Negocio:** Datos comerciales, logotipo, horarios, teléfonos y métodos de pago.
- **Catálogo Base de Productos y Servicios:** Gestión de categorías, nombres, precios y estados de disponibilidad.
- **Módulo de Ventas e Ingresos:** Registro centralizado de transacciones operativas.
- **Módulo de Gastos Operativos:** Registro de salidas de dinero básicas (insumos, servicios, imprevistos).
- **Reportes Financieros Operativos:** Resumen diario y periódico de balance simplificado:
  $$\text{Resultado Operativo} = \text{Ventas} - \text{Gastos}$$

### 5.2 Alcance del MVP: Vertical Restaurante de Comida Rápida

El MVP implementará específicamente sobre el Core:
- **Menú Digital Interactivo:** Visualización pública responsive para clientes, categorizada y con soporte para productos agotados.
- **Personalización de Productos (Modificadores):** Opciones como "sin cebolla", "salsa extra", adiciones y selecciones de tamaño.
- **Recepción Multicanal de Pedidos:**
  - Registro de pedidos desde el Menú Digital público.
  - Registro manual ultra-rápido de pedidos presenciales y pedidos recibidos por WhatsApp.
- **Cola Operativa de Pedidos Unificada:** Visualización cronológica y por estados operativos (`Recibido` $\rightarrow$ `En Preparación` $\rightarrow$ `Listo` $\rightarrow$ `En Camino` $\rightarrow$ `Entregado` / `Cancelado`).
- **Módulo de Domicilios Locales:** Asignación de repartidor, registro de dirección/referencia y separación del valor de envío.
- **Gestión de Pagos Operativos:** Soporte para pagos en Efectivo y Transferencias bancarias, con gestión de pago mixto o cobro contra entrega del domicilio.

### 5.3 Límite explícito de alcance (Lo que NO incluye el MVP)

Para garantizar foco y agilidad de despliegue en Camarones, el MVP **excluye explícitamente**:
- Otros verticales de negocio (barberías, tiendas, ferreterías, farmacias).
- Facturación electrónica y sistemas contables avanzados.
- Bots automatizados de WhatsApp o inteligencia artificial conversacional.
- Integración automática con pasarelas de pago bancarias complejas (se opera con registro de transferencia/efectivo).
- Control milimétrico de inventario por recetas, gramos o mermas.
- Integración con plataformas externas de delivery (Rappi, iFood, etc.).
- Requerimiento de hardware especializado (POS físico, lectores de código de barras, impresoras fiscales).
