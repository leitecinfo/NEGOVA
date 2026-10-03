# NEGOVA — Modelo de Negocio

**Versión:** 1.0  
**Estado:** Auditado y reestructurado  
**Producto:** NEGOVA (Plataforma SaaS para Pequeños Negocios)  
**Arquitectura conceptual:** Core + Verticales  
**Primer vertical de validación:** Restaurantes de comida rápida  
**Mercado inicial:** Camarones, La Guajira, Colombia  

---

# 1. Propósito del documento

Este documento define el modelo de negocio de NEGOVA y describe cómo la plataforma genera, entrega y captura valor para los pequeños negocios, especialmente aquellos que actualmente gestionan sus operaciones diarias mediante WhatsApp, papel, cuadernos y comunicación verbal.

El documento servirá como base para:
- Diseñar los flujos del producto y procesos operativos.
- Definir los actores del sistema y permisos (CORE vs. VERTICAL).
- Diseñar la arquitectura de información y datos.
- Definir funcionalidades comunes y especializadas.
- Establecer el modelo de ingresos por suscripción SaaS.
- Guiar la estrategia comercial de validación local y posterior expansión.

---

# 2. Definición estratégica de NEGOVA

### 2.1 Definición oficial
**NEGOVA es una plataforma SaaS (Software as a Service) multi-tenant orientada a la gestión y digitalización operativa de pequeños negocios.**

NEGOVA **no es un software exclusivo para restaurantes**. Está concebida conceptualmente como una solución adaptable y modular capaz de extenderse progresivamente a diversos tipos de comercio informal y familiar.

### 2.2 Relación estratégica de producto y mercado

```text
                                    NEGOVA
                                      ↓
                       Gestión para Pequeños Negocios
                                      ↓
                         Mercado Inicial: Camarones
                                      ↓
                   Primer Vertical: Comida Rápida (MVP)
                                      ↓
                        Validación Real en Campo
                                      ↓
                Expansión Progresiva a Otros Verticales
```

---

# 3. Separación conceptual: NEGOVA CORE vs. Verticales

La plataforma opera bajo el principio de desacoplamiento entre el núcleo transversal y los módulos específicos de negocio:

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
          Restaurante     Barbería /      Tienda de       Farmacia /
          Comida Rápida   Salón Belleza   Barrio          Otros
          (MVP Inicial)   (Extensión)     (Extensión)     (Extensión)
```

- **NEGOVA CORE:** Conjunto de capacidades, entidades y reglas universales para cualquier pequeño comercio (administración de cuenta, usuarios, roles, catálogo base de productos/servicios, registro de clientes, ventas, gastos, configuración e información operativa).
- **VERTICAL RESTAURANTE (MVP Actual):** Capacidades especializadas requeridas para la dinámica de comidas rápidas (menú digital público, modificadores de platos, cola de preparación cronológica, pedidos de WhatsApp/mostrador y gestión de domicilios locales).
- **FUTUROS VERTICALES:** Extensiones conceptuales (barberías con turnos, tiendas con abarrotes, farmacias) que **no forman parte del MVP actual** y se abordarán en fases posteriores.

---

# 4. Principio de adaptabilidad operativa

> **"NEGOVA se adapta a la realidad operativa de cada tipo de pequeño negocio, y no el negocio a NEGOVA."**

Cada sector comercial opera de manera distinta:
- Una barbería gestiona turnos y servicios profesionales.
- Una tienda de barrio gestiona abarrotes y cuentas rápidas.
- Un restaurante de comida rápida gestiona comandas, preparación inmediata y domicilios.

NEGOVA evita imponer una estructura empresarial corporativa o rígida. Comparte un núcleo administrativo sólido y ofrece módulos especializados para cada forma de trabajar.

---

# 5. Problema de negocio

### 5.1 Problemas generales de los pequeños comercios [CORE]
- **Informalidad y dispersión:** Registros de ingresos y compras en hojas sueltas, cuadernos y memoria del propietario.
- **Falta de visibilidad financiera:** Imposibilidad de saber al cierre del día el dinero exacto recibido en efectivo frente a transferencias bancarias.
- **Barrera tecnológica:** Los sistemas POS y software tradicionales son caros, complejos y exigen computadores e impresoras que estos negocios no tienen ni necesitan.
- **Dependencia de personas clave:** Toda la información operativa reside en la cabeza del dueño o trabajadores clave.

### 5.2 Problemas específicos del restaurante de comida rápida [VERTICAL RESTAURANTE]
- **Caos en horas pico:** Llegada simultánea de pedidos presenciales y por WhatsApp sin una cola unificada.
- **Pérdida del orden de llegada:** Dificultad para saber qué orden entró primero a la cocina.
- **Modificaciones olvidadas:** Errores en preparación por notas informales ("sin cebolla", "queso extra").
- **Coordinación precaria de domicilios:** Desconocimiento sobre qué pedido lleva el repartidor y si el flete ya fue cobrado.

---

# 6. Propuesta de valor

### 6.1 Propuesta de valor general de NEGOVA [CORE]
> **"Ayudar a los pequeños negocios a organizar sus ventas, gastos y operaciones diarias desde el celular, con herramientas ultra-simples y sin fricción."**

- **100% Móvil:** Diseñado para operarse desde cualquier teléfono inteligente, sin requerir computadores ni hardware especializado.
- **Cuentas claras:** Balance operativo diario inmediato ($\text{Resultado} = \text{Ventas} - \text{Gastos}$).
- **Cero complejidad técnica:** Curva de aprendizaje inmediata para personas sin experiencia en software.

### 6.2 Propuesta de valor del primer vertical [VERTICAL RESTAURANTE]
- **Cola única de pedidos:** Centralización de pedidos de WhatsApp, mostrador y menú digital en una sola pantalla.
- **Menú digital sin barreras:** Los clientes consultan productos y ordenan sin necesidad de registrarse.
- **Organización de cocina y despacho:** Visualización clara de estados (`Recibido` $\rightarrow$ `En Preparación` $\rightarrow$ `Listo` $\rightarrow$ `En Camino` $\rightarrow$ `Entregado`).
- **Control de domicilios y pagos:** Desglose independiente del valor de la comida y el costo del flete.

---

# 7. Segmentos de clientes

### 7.1 Segmento general de la plataforma
Micro y pequeños comercios familiares de municipios y comunidades con baja digitalización, atendidos por sus propietarios y con estructuras de 1 a 5 trabajadores.

### 7.2 Segmento inicial de validación (MVP)
Pequeños restaurantes y puestos familiares de comida rápida en **Camarones, La Guajira**:
- Funcionamiento principalmente nocturno o en turnos de alta demanda.
- Alto uso de WhatsApp como canal de pedidos.
- Pagos predominantemente en efectivo y transferencias (Nequi, Daviplata, Bancolombia).
- Repartidores locales propios.

### 7.3 Cliente comprador (Buyer Persona)
El **propietario o administrador del negocio**, responsable de las decisiones financieras y comerciales del establecimiento.

---

# 8. Actores del sistema

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
                                                      │
                                           [VERTICAL RESTAURANTE]
                                                 Domiciliario
```

### 8.1 Actores del CORE
1. **Superadministrador:** Administra la plataforma SaaS, cuentas comerciales y planes.
2. **Propietario / Administrador:** Control total de configuración, catálogo, colaboradores y finanzas.
3. **Trabajador / Colaborador:** Ejecuta la operación diaria (ventas, pedidos, atención) con permisos asignados.
4. **Cliente:** Consulta catálogos y realiza compras/pedidos sin necesidad de crear cuenta.

### 8.2 Actores del Vertical Restaurante
5. **Domiciliario / Repartidor (Opcional):** Accede a la lista de pedidos para entrega con dirección y cobro de flete.

*(Nota: En restaurantes familiares el personal de cocina y atención suele ser el mismo; no se crean roles artificiales separados para cocina).*

---

# 9. Canales

### 9.1 Canales de adquisición (Comercialización)
- **Venta y demostración directa:** Visita presencial y demostración práctica en el negocio.
- **Voz a voz y referidos:** Recomendaciones entre comerciantes locales.
- **WhatsApp y redes sociales locales:** Contacto directo y soporte personalizado.

### 9.2 Canales de operación (Uso del producto)
- **Aplicación Web / PWA:** Interfaz móvil para el propietario y los trabajadores.
- **Menú Digital Público:** Enlace web o código QR para acceso de los clientes.
- **WhatsApp Operativo:** Canal habitual de recepción de pedidos, ingresados manualmente a NEGOVA por el personal.

---

# 10. Relación con los clientes

- **Acompañamiento en campo:** Capacitación directa durante el inicio de operaciones.
- **Soporte ágil y cercano:** Asistencia directa vía WhatsApp y canales comunitarios.
- **Diseño sin barreras:** Sin contratos forzosos ni configuraciones complejas.

---

# 11. Modelo de ingresos

El modelo de monetización de NEGOVA es **SaaS por Suscripción Periódica**.

- **Suscripción Periódica (Mensual / Anual):** Cobro recurrente y accesible por el uso de la plataforma por cada negocio registrado.
- **Prueba inicial guiada:** Periodo de prueba gratuito con acompañamiento presencial para validar valor en campo.

> **Nota de alcance:** No se contemplan comisiones por venta, comisiones por flete de domicilio, pasarelas de pago con cobro porcentual, marketplace ni venta de hardware en el MVP.

---

# 12. Recursos y actividades clave

### 12.1 Actividades clave
- **Desarrollo y evolución del producto:** Construcción del Core y módulos del vertical restaurante.
- **Mantenimiento e infraestructura cloud:** Garantizar disponibilidad y seguridad multi-tenant.
- **Validación en campo y soporte:** Acompañamiento a los negocios piloto en Camarones.
- **Recolección y análisis de feedback:** Ajustes continuos basados en el uso real.

### 12.2 Recursos clave
- **Plataforma de software:** Base de código modular, responsiva y multi-tenant.
- **Infraestructura de servidores en la nube:** Base de datos segura y servidores de alta disponibilidad.
- **Equipo de producto y campo:** Personal enfocado en desarrollo, soporte y relación directa con comerciantes.

---

# 13. Socios clave

- **Proveedores de infraestructura en la nube:** Plataformas de hosting, bases de datos y servicios web.
- **Comerciantes pioneros locales:** Negocios piloto de Camarones que prueban y retroalimentan la plataforma.
- **Canales de comunicación directa:** Infraestructura de mensajería y conectividad móvil.

---

# 14. Estructura de costos

- **Costos de infraestructura tecnológica:** Servidores en la nube, almacenamiento, dominios y certificados.
- **Costos de desarrollo y mantenimiento:** Horas de ingeniería y diseño de experiencia de usuario.
- **Costos de soporte y operación en campo:** Gastos de acompañamiento, demostraciones y atención al cliente.

---

# 15. Business Model Canvas de NEGOVA

| Bloque Canvas | Definición para NEGOVA (Plataforma SaaS) |
| :--- | :--- |
| **1. Segmento de Clientes** | • **General:** Pequeños comercios familiares con baja digitalización.<br>• **Inicial (MVP):** Pequeños restaurantes de comida rápida en Camarones, La Guajira. |
| **2. Propuesta de Valor** | • **CORE:** Digitalización ágil de ventas, gastos y catálogo desde el celular sin fricción ni hardware especial.<br>• **Vertical Restaurante:** Menú digital público, cola centralizada de pedidos (WhatsApp/Mostrador) y control de domicilios. |
| **3. Canales** | • **Adquisición:** Venta directa presencial, voz a voz, demostraciones locales y WhatsApp.<br>• **Operación:** Web App / PWA móvil y Menú Digital QR/link. |
| **4. Relación con Clientes** | • Acompañamiento cercano en campo, soporte directo por WhatsApp y evolución continua basada en feedback real. |
| **5. Fuentes de Ingresos** | • Suscripción SaaS periódica (mensual/anual) por negocio registrado. |
| **6. Recursos Clave** | • Plataforma de software Web/PWA multi-tenant.<br>• Infraestructura en la nube.<br>• Equipo de producto y soporte local. |
| **7. Actividades Clave** | • Desarrollo de software Core + Vertical.<br>• Mantenimiento y seguridad de infraestructura.<br>• Acompañamiento y validación en campo. |
| **8. Socios Clave** | • Proveedores de infraestructura cloud.<br>• Negocios pioneros en Camarones para validación inicial. |
| **9. Estructura de Costos** | • Infraestructura de servidores y bases de datos.<br>• Desarrollo de software y mantenimiento.<br>• Operación de soporte y validación en campo. |
