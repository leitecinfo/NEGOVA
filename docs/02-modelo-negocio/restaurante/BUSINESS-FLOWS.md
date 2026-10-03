# NEGOVA — Flujos de Negocio (Vertical Restaurante)

**Versión:** 1.0  
**Estado:** ✅ Sección 2.7 Completada (8 de 8 flujos)  
**Producto:** NEGOVA  
**Vertical:** Restaurantes de comida rápida  

---

# 1. Propósito de los flujos de negocio

Este documento centraliza y describe los 8 flujos de interacción y procesos operativos para el **Vertical de Restaurantes de comida rápida**, garantizando que la operativa real de los pequeños comercios quede organizada sin introducir complejidad innecesaria.

---

# 2. Índice canónico de flujos operativos (2.7)

Los 8 flujos del MVP se encuentran completamente definidos y modularizados:

| Código | Nombre del flujo | Canal / Proceso | Archivo detallado | Estado |
| :--- | :--- | :--- | :--- | :---: |
| **2.7.1** | [Flujo: Registro de pedido por WhatsApp](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.1-flujo-pedido-whatsapp.md) | WhatsApp (Manual) | [`2.7.1-flujo-pedido-whatsapp.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.1-flujo-pedido-whatsapp.md) | ✅ |
| **2.7.2** | [Flujo: Pedido desde menú digital](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.2-flujo-pedido-menu-digital.md) | Menú Web (Autogestión) | [`2.7.2-flujo-pedido-menu-digital.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.2-flujo-pedido-menu-digital.md) | ✅ |
| **2.7.3** | [Flujo: Registrar pedido presencial](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.3-flujo-pedido-presencial.md) | Mostrador / Local | [`2.7.3-flujo-pedido-presencial.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.3-flujo-pedido-presencial.md) | ✅ |
| **2.7.4** | [Flujo: Gestionar cola de pedidos](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.4-flujo-gestionar-cola-pedidos.md) | Centralización / Cola | [`2.7.4-flujo-gestionar-cola-pedidos.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.4-flujo-gestionar-cola-pedidos.md) | ✅ |
| **2.7.5** | [Flujo: Preparar pedido](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.5-flujo-preparar-pedido.md) | Cocina / Preparación | [`2.7.5-flujo-preparar-pedido.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.5-flujo-preparar-pedido.md) | ✅ |
| **2.7.6** | [Flujo: Gestionar domicilio](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.6-flujo-gestionar-domicilio.md) | Despacho / Domicilio | [`2.7.6-flujo-gestionar-domicilio.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.6-flujo-gestionar-domicilio.md) | ✅ |
| **2.7.7** | [Flujo: Registrar y gestionar pagos](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.7-flujo-registrar-gestionar-pagos.md) | Finanzas / Pagos | [`2.7.7-flujo-registrar-gestionar-pagos.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.7-flujo-registrar-gestionar-pagos.md) | ✅ |
| **2.7.8** | [Flujo: Gestionar disponibilidad de productos](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.8-flujo-gestionar-disponibilidad-productos.md) | Menú / Disponibilidad | [`2.7.8-flujo-gestionar-disponibilidad-productos.md`](file:///D:/Proyectos/NEGOVA/docs/02-modelo-negocio/restaurante/flujos/2.7.8-flujo-gestionar-disponibilidad-productos.md) | ✅ |

---

# 3. Principio de centralización en cola única

Todos los flujos de entrada confluyen obligatoriamente en la misma cola operativa de NEGOVA:

```text
  [Canal WhatsApp] ──(Carga manual por personal)──┐
                                                  │
  [Canal Mostrador] ─(Carga manual por personal)──┼──► [COLA COMÚN DE PEDIDOS] ──► [Cocina / Despacho]
                                                  │    (Orden por llegada)
  [Menú Digital] ────(Autogestión por cliente)────┘
```

- **Cero colas separadas:** No existen listas aisladas por canal.
- **Orden cronológico:** La preparación responde estrictamente a la cola de llegada.
- **Trazabilidad de estados:** $\text{Recibido} \rightarrow \text{En Preparación} \rightarrow \text{Listo} \rightarrow \text{Entregado}$.
