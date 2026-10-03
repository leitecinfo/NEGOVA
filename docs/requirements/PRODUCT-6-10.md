# NEGOVA — Definición del Producto (Secciones 6 a 10)

**Versión:** 1.0  
**Estado:** Auditado y reestructurado  
**Producto:** NEGOVA  
**Arquitectura conceptual:** Core + Verticales  
**Primer vertical de validación:** Restaurantes de comida rápida  
**Mercado inicial:** Camarones, La Guajira, Colombia  

---

## 6. Requerimientos funcionales

Para mantener la independencia y escalabilidad de la plataforma, los requerimientos funcionales se estructuran estrictamente entre las capacidades transversales de la plataforma (CORE) y las especializadas del primer caso de uso (VERTICAL RESTAURANTE).

---

### 6.1 Requerimientos funcionales del CORE [NEGOVA CORE]

#### RFC-001 — Registro y administración del negocio
El sistema deberá permitir el registro inicial de una cuenta comercial (tenant), definiendo:
- Nombre comercial del negocio.
- Tipo / Vertical de negocio.
- Teléfono y datos de contacto principales.
- Ubicación básica (departamento, municipio, dirección/referencia).
- Estado de la cuenta en la plataforma.

#### RFC-002 — Configuración del negocio
El propietario o administrador deberá poder configurar y actualizar los datos de su establecimiento:
- Nombre visible, descripción y logotipo.
- Teléfonos de contacto y enlaces directos.
- Horarios de atención comercial.
- Información pública para clientes.
- Métodos de pago aceptados (efectivo, transferencias, datos de cuentas bancarias/billeteras digitales).

#### RFC-003 — Control de estado del negocio (Abierto / Cerrado)
El sistema deberá permitir alternar en tiempo real el estado comercial del negocio (`Abierto`, `Cerrado`, `Temporalmente no disponible`). Si el negocio está cerrado, cualquier canal digital público deberá notificar a los clientes que no se reciben pedidos u operaciones.

#### RFC-004 — Gestión de usuarios y colaboradores
El propietario deberá poder registrar trabajadores/colaboradores dentro de su cuenta, asignando credenciales de acceso y datos de contacto.

#### RFC-005 — Roles y permisos operativos
El sistema deberá permitir asignar perfiles o permisos diferenciados a los trabajadores para controlar las acciones permitidas (ej. restringir la visualización de gastos o métricas financieras a usuarios operativos).

#### RFC-006 — Aislamiento estricto multi-tenant
El sistema garantizará que ningún usuario de un negocio pueda acceder, consultar o modificar datos pertenecientes a otro negocio registrado.

#### RFC-007 — Catálogo base de productos y servicios
El sistema deberá permitir gestionar el catálogo comercial base:
- Creación, edición y eliminación de categorías.
- Creación y edición de productos/servicios con nombre, descripción, imagen referencial y precio de venta.
- Control manual e instantáneo de disponibilidad (`Disponible` / `Agotado`).

#### RFC-008 — Registro de ventas e ingresos
El sistema deberá registrar de forma persistente cada transacción de venta completada, asociando:
- Identificador único de transacción.
- Detalle de ítems vendidos y valor unitario/total.
- Método de pago utilizado (Efectivo / Transferencia).
- Fecha, hora y usuario que registró la operación.

#### RFC-009 — Registro de gastos operativos
El propietario o personal autorizado deberá poder registrar salidas de dinero diarias del negocio:
- Monto del gasto.
- Concepto o categoría básica (insumos, compras locales, servicios, imprevistos).
- Fecha, hora y notas adicionales.

#### RFC-010 — Resumen e información financiera operativa
El sistema deberá generar reportes sencillos y comprensibles para el propietario sobre la jornada:
- Total de ingresos por ventas.
- Total de gastos registrados.
- Desglose por método de pago (Efectivo vs. Transferencias).
- Resultado operativo del día y de periodos seleccionados.

---

### 6.2 Requerimientos funcionales del vertical: Restaurante de comida rápida [VERTICAL RESTAURANTE]

#### RFR-001 — Menú digital interactivo para clientes
El sistema deberá generar una vista pública y responsive del menú del restaurante, accesible vía enlace o código QR, que permita a los clientes consultar categorías, platos, precios y disponibilidad en tiempo real.

#### RFR-002 — Modificadores y personalizaciones de platos
El sistema deberá permitir configurar opciones de modificación sobre los productos del menú:
- Modificadores de exclusión/inclusión (ej. "sin cebolla", "con salsa de la casa").
- Adiciones con costo extra (ej. "queso adicional +$2.000", "doble carne +$4.000").
- Variantes o tamaños de producto cuando aplique.

#### RFR-003 — Disponibilidad manual ágil de ingredientes/platos
El restaurante podrá inhabilitar inmediatamente un producto o grupo de productos si un ingrediente clave se ha terminado, impidiendo que los clientes lo ordenen en el menú digital.

#### RFR-004 — Recepción multicanal y cola de pedidos centralizada
El sistema deberá unificar en una sola cola operativa cronológica todos los pedidos recibidos, provengan de:
- Pedidos generados directamente por clientes en el Menú Digital.
- Pedidos recibidos por WhatsApp registrados manualmente por el personal.
- Pedidos presenciales en el local registrados por el personal.

#### RFR-005 — Registro manual ultra-rápido de pedidos
La interfaz para el personal deberá permitir cargar un pedido en pocos toques (seleccionar productos, añadir notas rápidas de modificación, indicar tipo de entrega y guardar) en menos de 30 segundos.

#### RFR-006 — Gestión de estados de preparación del pedido
El personal podrá avanzar los pedidos a través de un flujo de estados claro:
$$\text{Recibido} \longrightarrow \text{En Preparación} \longrightarrow \text{Listo} \longrightarrow \text{En Camino / Listo para Recoger} \longrightarrow \text{Entregado} \quad (\text{o Cancelado})$$

#### RFR-007 — Gestión de domicilios y repartidor
Para pedidos con entrega a domicilio:
- Registro de dirección o referencia comunitaria del cliente.
- Definición y cobro del valor del domicilio de forma diferenciada al valor de la comida.
- Asignación del pedido al domiciliario del negocio.
- Vista simplificada para el repartidor con datos de entrega y monto a cobrar.
- Confirmación de entrega por parte del domiciliario o el operador.

#### RFR-008 — Gestión de pagos específicos de restaurante
Soporte para escenarios habituales del mercado:
- Pago de comida por transferencia y pago de domicilio en efectivo contra entrega.
- Registro del estado de pago (`Pendiente`, `Pagado`, `Pago Parcial / Pendiente Domicilio`).
- Registro del motivo en caso de cancelación del pedido.

---

## 7. Requerimientos no funcionales

Los requerimientos no funcionales definen los atributos de calidad, rendimiento y seguridad que aplican a la plataforma NEGOVA en su totalidad.

---

### 7.1 Rendimiento y velocidad de respuesta
- **RNF-001 — Respuesta ágil:** Las transacciones críticas (cambio de estado de pedido, registro de venta, apertura de cola de pedidos) deberán responder en menos de 2 segundos bajo condiciones normales de conexión móvil.
- **RNF-002 — Flujos de interacción reducidos:** Las pantallas operativas deben diseñarse para completar tareas repetitivas en el menor número posible de toques.
- **RNF-003 — Carga eficiente de datos:** Optimización del consumo de datos mediante paginación, carga diferida de imágenes y minimización de payload en redes móviles.

### 7.2 Experiencia móvil y diseño táctil (Mobile First)
- **RNF-004 — Diseño Mobile First:** Toda la operativa debe ser 100% funcional y cómoda en teléfonos inteligentes de gama baja y media.
- **RNF-005 — Interfaz táctil ergonómica:** Botones y áreas interactivas con tamaño adecuado para dedos, evitando campos minúsculos o formularios densos.
- **RNF-006 — Adaptabilidad responsive:** Interfaz adaptable fluidamente a tablets y navegadores de escritorio sin perder coherencia.

### 7.3 Usabilidad y baja fricción
- **RNF-007 — Facilidad de aprendizaje:** Curva de aprendizaje inmediata para personas sin experiencia previa en software.
- **RNF-008 — Lenguaje cotidiano y claro:** Uso de terminología directa y comprensible para el comerciante local (ej. "Ventas", "Gastos", "Pedidos", "Agotado").
- **RNF-009 — Cero barreras para el cliente:** El cliente final puede consultar el menú y ordenar sin necesidad de registro previo ni contraseñas.

### 7.4 Disponibilidad y tolerancia a redes móviles
- **RNF-010 — Alta disponibilidad:** Disponibilidad del servicio orientada a cubrir los horarios de operación de los comercios.
- **RNF-011 — Tolerancia a variabilidad de red:** Manejo adecuado de interrupciones temporales de señal móvil, evitando bloqueos inesperados y ofreciendo mensajes claros al usuario.
- **RNF-012 — Confirmación no silenciosa:** Ninguna transacción se dará por completada visualmente si el servidor no ha confirmado su persistencia.

### 7.5 Seguridad, aislamiento y privacidad
- **RNF-013 — Autenticación segura:** Manejo robusto de credenciales y sesiones protegidas para el acceso de propietarios y trabajadores.
- **RNF-014 — Aislamiento multi-tenant estricto:** Separación lógica y de consultas para garantizar que ningún negocio acceda a la información de otro.
- **RNF-015 — Mínimo privilegio:** Los roles de trabajadores tendrán acceso acotado a las funciones operativas asignadas por el propietario.
- **RNF-016 — Protección de datos:** Tratamiento confidencial y seguro de la información comercial de los negocios y sus clientes.

### 7.6 Arquitectura, escalabilidad y mantenibilidad
- **RNF-017 — Modularidad Core + Verticales:** Código y esquema de datos desacoplados que faciliten incorporar nuevos módulos de verticales sin alterar las entidades nucleares.
- **RNF-018 — Escalabilidad horizontal:** Capacidad para soportar el crecimiento en número de negocios, usuarios y volumen transaccional diario.
- **RNF-019 — Código mantenible y documentado:** Estándares limpios de desarrollo y documentación técnica estructurada.

---

## 8. Reglas de negocio

Las reglas de negocio establecen las directrices lógicas y operativas inmutables del sistema.

---

### 8.1 Reglas de negocio del CORE [NEGOVA CORE]

- **RN-001 — Independencia total entre negocios:** Cada negocio opera en un entorno cerrado y privado. Los productos, clientes, ventas, gastos y configuraciones pertenecen de manera exclusiva al negocio creador.
- **RN-002 — Control y propiedad administrativa:** El propietario tiene la máxima potestad sobre la configuración comercial, gestión de personal y visualización financiera de su establecimiento.
- **RN-003 — Estructura de personal flexible:** El sistema no asume jerarquías rígidas ni departamentos separados. Un negocio puede operar con una sola persona realizando todas las labores o con varios colaboradores.
- **RN-004 — Todo producto vendible debe poseer precio:** Ningún ítem puede ser publicado para venta o incluido en transacciones sin un valor monetario asignado.
- **RN-005 — Persistencia inmutable del historial financiero:** Una vez completada una venta o registrado un gasto, debe conservarse el registro histórico con fecha, hora y responsable para fines de auditoría del propietario.

---

### 8.2 Reglas de negocio del vertical: Restaurante de comida rápida [VERTICAL RESTAURANTE]

- **RN-006 — Los productos agotados no pueden ordenarse:** Si un plato o bebida se marca como `Agotado`, se inhabilita de inmediato en el Menú Digital para prevenir pedidos que no se puedan despachar.
- **RN-007 — Dinámica de disponibilidad flexible:** La disponibilidad de productos puede modificarse en cualquier momento del día tantas veces como sea necesario.
- **RN-008 — Prioridad por cola operativa:** Los pedidos se procesan primariamente según el orden cronológico de recepción y la capacidad de preparación de la cocina. La indicación de una hora de entrega preferida por el cliente no altera automáticamente el orden de la cola sin intervención del operador.
- **RN-009 — Modificaciones asociadas al ítem:** Cualquier instrucción de preparación especial ("sin salsa", "queso extra") queda explícitamente vinculada al producto individual dentro de la orden.
- **RN-010 — Separación contable del valor del domicilio:** El costo del flete/domicilio es independiente del valor de los productos consumidos y puede liquidarse por separado (ej. cobro en efectivo por el domiciliario).
- **RN-011 — Cierre formal de pedidos:** Un pedido solo pasa a estado `Entregado` cuando se ha confirmado tanto la entrega de la comida como el registro de su correspondiente estado de pago.

---

## 9. Restricciones

Las restricciones definen los límites de contexto, técnicos y de alcance bajo los cuales se desarrolla el producto.

---

### 9.1 Restricciones generales de NEGOVA [CORE]

- **R-001 — Naturaleza Web / PWA:** NEGOVA se desarrolla inicialmente como aplicación web moderna accesible desde navegador, con capacidades progresivas (PWA) para instalación en pantalla de inicio.
- **R-002 — Dependencia de conectividad a Internet:** La plataforma opera en línea con persistencia centralizada en la nube; no se garantiza operación offline completa en la versión inicial.
- **R-003 — Aislamiento multi-tenant por software:** La separación de datos se gestionará a nivel de arquitectura y modelo de datos centralizado con identificador estricto de negocio (`tenant_id`).
- **R-004 — Simplicidad técnica:** No se introducirán dependencias de software complejas que dificulten el despliegue o eleven innecesariamente los costos operativos de la plataforma SaaS.

---

### 9.2 Restricciones específicas del MVP: Restaurante de comida rápida [VERTICAL RESTAURANTE]

- **R-005 — Contexto inicial de baja digitalización (Camarones, La Guajira):** La solución debe estar concebida para comerciantes que nunca antes han usado software administrativo.
- **R-006 — El celular como dispositivo central:** No se debe requerir computador de escritorio, computadores portátiles ni tablets de alta gama para operar el restaurante.
- **R-007 — Sin hardware especializado:** El MVP no exigirá impresoras térmicas de comandas, lectores de código de barras, cajones monederos ni terminales POS dedicadas.
- **R-008 — Sin inventario milimétrico ni recetas obligatorias:** No se exigirá el registro de gramos, recetas o ingredientes para permitir el funcionamiento de los pedidos y ventas.
- **R-009 — Convivencia con WhatsApp sin bot automatizado:** WhatsApp continuará siendo el canal de comunicación habitual de los clientes; los pedidos recibidos por este medio se registran manualmente en NEGOVA por el personal.
- **R-010 — Domicilios locales y flota propia:** El modelo asume entregas realizadas por personal propio del negocio en el perímetro local, sin integración con empresas de logística externa.
- **R-011 — Métodos de pago tradicionales:** El MVP se enfoca en Efectivo y Transferencias bancarias directas (Nequi, Daviplata, Bancolombia, etc.), sin pasarelas de pago con tarjeta integradas.
- **R-012 — Finanzas operativas simples:** El módulo financiero se limita a control de caja, ventas diarias y gastos directos, sin sustituir un software de contabilidad formal ni declaraciones tributarias.

---

## 10. Criterios de éxito y aceptación

Definición de las condiciones observables para validar que el producto cumple sus metas de valor.

---

### 10.1 Criterios de éxito de NEGOVA como plataforma [CORE]

- **CE-001 — Aislamiento y robustez multi-tenant:** Cero filtración de información entre diferentes negocios registrados; cada cuenta accede exclusivamente a sus propios registros.
- **CE-002 — Adopción sin asistencia técnica continua:** Un comerciante puede registrarse, configurar su negocio, cargar su catálogo inicial y comenzar a operar de forma autónoma en menos de 15 minutos.
- **CE-003 — Velocidad de consulta y balance diario:** El propietario puede consultar su balance de ventas y gastos diarios en un solo clic de forma inmediata.
- **CE-004 — Base técnica extensible:** La estructura de datos y lógica del Core permite añadir un nuevo vertical sin necesidad de alterar las tablas o endpoints comunes.

---

### 10.2 Criterios de éxito y aceptación del MVP Restaurante [VERTICAL RESTAURANTE]

- **CE-005 — Reducción del uso de papel y cuadernos:** El restaurante piloto en Camarones gestiona el 100% de sus pedidos del turno nocturno a través de la cola de pedidos de NEGOVA sin recurrir a comandas en papel.
- **CE-006 — Registro ágil de pedidos de WhatsApp/Mostrador:** El personal registra una orden completa proveniente de WhatsApp o mostrador en menos de 30 segundos.
- **CE-007 — Cero pedidos perdidos u olvidados:** Durante las horas pico de atención, todos los pedidos registrados mantienen su trazabilidad de estado hasta la entrega sin pérdidas ni duplicaciones.
- **CE-008 — Menú digital funcional sin fricción:** Los clientes pueden abrir el menú digital desde su celular, elegir productos con modificadores y enviar su orden sin necesidad de crear cuenta ni descargar aplicaciones.
- **CE-009 — Claridad en cobro y liquidación de domicilios:** Al final del turno, el administrador puede liquidar con exactitud el total de dinero recaudado por concepto de domicilios y los métodos de pago recibidos.
