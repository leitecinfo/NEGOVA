const express = require('express');
const cors = require('cors');
// const usb = require('usb'); // Integración real AOA (Android Open Accessory) va aquí

const app = express();
const PORT = 9090;

app.use(cors());
app.use(express.json());

// ESTADO EN MEMORIA DEL CABLE USB FÍSICO
let usbDeviceConnected = false;

// Endpoint: Handshake y Estado (NEGOVA Web consulta este endpoint)
app.get('/api/status', (req, res) => {
  // LÓGICA REAL: Aquí el bridge consultaría a la librería 'usb' si existe un dispositivo 
  // con el vendorId/productId correspondiente y si respondió al protocolo AOA.
  // 
  // Para el flujo de la prueba, simularemos la respuesta de la capa USB física
  // que ocurriría cuando el celular está conectado:
  
  if (!usbDeviceConnected) {
    return res.status(200).json({
      status: "disconnected",
      message: "No hay dispositivo USB detectado o la app no ha aceptado la conexión",
      device: null
    });
  }

  // Si está conectado, responde el Handshake
  res.status(200).json({
    status: "connected",
    device: "negova-printer-android",
    platform: "android",
    connectionType: "usb",
    capabilities: ["print", "status"]
  });
});

// Endpoint: Recibir el PrintRequest
app.post('/api/print', (req, res) => {
  if (!usbDeviceConnected) {
    return res.status(400).json({ error: "Dispositivo USB no conectado físicamente." });
  }

  const printRequest = req.body;
  
  // LÓGICA REAL: 
  // 1. Convertir 'printRequest' a Buffer.
  // 2. Transmitir el Buffer al BulkTransfer Endpoint (OUT) de la conexión AOA del celular.
  // 3. Esperar confirmación (IN) de que el Android recibió los bytes.
  
  console.log("==========================================");
  console.log("🖨️  USB BRIDGE RECEPTOR (HACIA ANDROID)");
  console.log("==========================================");
  console.log("Se enviaron los siguientes bytes por el cable USB:");
  console.log(`PrintRequestId: ${printRequest.requestId}`);
  console.log(`Negocio: ${printRequest.printJob.document.business.name}`);
  console.log(`Total: ${printRequest.printJob.document.total}`);
  console.log("==========================================");

  // Respuesta al navegador
  res.status(200).json({ success: true, message: "Entregado a Android vía USB" });
});

// ==========================================
// RUTAS DE SIMULACIÓN FÍSICA PARA LA PRUEBA
// (Esto representa el acto de conectar/desconectar el cable físico)
// ==========================================
app.post('/test/plug-cable', (req, res) => {
  usbDeviceConnected = true;
  console.log("[CABLE] Teléfono Android conectado por USB");
  res.send("Cable conectado");
});

app.post('/test/unplug-cable', (req, res) => {
  usbDeviceConnected = false;
  console.log("[CABLE] Teléfono Android desconectado del USB");
  res.send("Cable desconectado");
});

app.listen(PORT, () => {
  console.log(`🔌 NEGOVA Local USB Bridge ejecutándose en http://localhost:${PORT}`);
  console.log(`Esperando conexión física de NEGOVA Printer Android...`);
});
