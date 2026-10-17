# Hardware POS — Implementación Futura

## Decisión Arquitectónica (Octubre 2026)

NEGOVA actualmente funciona **completamente sin hardware POS externo**.

La plataforma ha sido diseñada como una aplicación web/PWA cloud-native donde los negocios pueden operar sin depender de dispositivos físicos específicos como impresoras térmicas ESC/POS, lectores de códigos de barras, básculas, o cajones de dinero seriales/USB.

En una etapa anterior, existió una aplicación puente llamada **NEGOVA Printer** (Android) y diversos adaptadores (WebUSB, WebSocket Bridge) para facilitar la comunicación con periféricos. Toda esta arquitectura fue **eliminada** para reducir fricción técnica, deuda técnica, y porque el target comercial actual no requiere este nivel de hardware especializado de forma obligatoria.

## Funcionalidad Digital Conservada

El retiro del hardware **no significa el retiro de los comprobantes**. Se conserva íntegramente:

* La generación de documentos y comprobantes de venta digitales.
* La **Vista Previa de Comprobante** (Modal universal que simula el formato de ticket de 80mm).
* La descarga y compartición (PDF/WhatsApp).
* La facturación interna de NEGOVA hacia sus clientes (suscripciones) ubicada en `/admin/facturacion`.

## Directrices para el Futuro

En una futura etapa comercial se podrá ofrecer opcionalmente un servicio de implementación POS que incluya hardware (impresora térmica, lector, cajón). 

Esta funcionalidad será **estrictamente opcional** y no será un requisito para utilizar NEGOVA.

La futura integración deberá diseñarse de forma desacoplada para permitir diferentes fabricantes y métodos de conexión. La posible arquitectura futura podrá contemplar abstracciones como:

* `PrintingService`
* `PrinterAdapter`
* `CashDrawerService`
* `CashDrawerAdapter`

**Regla de oro:** NO deben implementarse estas interfaces en el código base actual si su única finalidad es preparar terreno para un hardware que todavía no se va a comercializar. La implementación deberá evaluarse exclusivamente cuando exista una necesidad comercial real y se conozcan los equipos específicos que se van a soportar.

## Separación de Contextos (Plataforma vs Workspace)

Es vital no confundir la "Facturación de la plataforma" con la "Facturación del negocio".

* `/admin/facturacion`: Módulo de cobro de suscripciones de NEGOVA a los tenants. **NO ES UN POS.** No maneja ventas físicas.
* `Workspace del negocio`: Espacio donde a futuro residirá el verdadero POS, la caja registradora, el inventario y las ventas al por menor. El hardware POS pertenecerá a este contexto.
