/**
 * Configuración centralizada de envíos por Resend para NEGOVA
 */

export const DEV_RECIPIENT_EMAIL = "leitec.info@gmail.com";
export const RESEND_FROM_EMAIL = "NEGOVA <onboarding@resend.dev>";

/**
 * Detecta si la ejecución se encuentra en un entorno de pruebas automatizadas
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

/**
 * Devuelve el destinatario efectivo.
 * En modo de desarrollo o sin dominio propio verificado en Resend,
 * redirige automáticamente todos los correos a leitec.info@gmail.com.
 */
export function getEffectiveEmailRecipient(intendedEmail: string): string {
  // Si no hay dominio verificado propio configurado, enviar a la cuenta autorizada en Resend
  if (!process.env.RESEND_CUSTOM_DOMAIN_VERIFIED) {
    return DEV_RECIPIENT_EMAIL;
  }
  return intendedEmail.trim().toLowerCase();
}

interface SendOtpEmailParams {
  to: string;
  otpCode: string;
  subjectTitle: string;
  reasonText: string;
}

/**
 * Envía un correo con código OTP de seguridad con plantilla HTML corporativa de NEGOVA
 */
export async function sendOtpEmail({
  to,
  otpCode,
  subjectTitle,
  reasonText,
}: SendOtpEmailParams): Promise<{ success: boolean; error?: string }> {
  // Guard de seguridad incondicional: Bloquear llamadas a la API real de Resend durante tests
  if (isTestEnvironment()) {
    return { success: true };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ RESEND_API_KEY no está configurada en las variables de entorno.");
      return { success: false, error: "Servicio de correo no configurado." };
    }

    const effectiveRecipient = getEffectiveEmailRecipient(to);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: effectiveRecipient,
        subject: `${otpCode} — ${subjectTitle}`,
        html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F1F3F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F3F9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header brand -->
          <tr>
            <td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid #F1F3F9;">
              <div style="display:inline-block;background:linear-gradient(135deg,#ED500A,#FF6B35);border-radius:10px;padding:8px 18px;margin-bottom:14px;">
                <span style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">NEGOVA</span>
              </div>
              <p style="margin:0;color:#94A3B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Verificación de Seguridad</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 6px;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">${subjectTitle}</p>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">
                ${reasonText}
              </p>

              <!-- OTP Box -->
              <div style="background-color:#FFF7F4;border:2px solid #ED500A;border-radius:12px;padding:28px 20px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#94A3B8;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Código de Seguridad</p>
                <div style="letter-spacing:14px;font-size:44px;font-weight:800;color:#ED500A;font-family:'Courier New',Courier,monospace;padding-left:14px;">${otpCode}</div>
              </div>

              <!-- Timer warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF7F4;border-radius:8px;border-left:3px solid #ED500A;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#64748B;font-size:13px;line-height:1.5;">
                      ⏱️ &nbsp;Este código <strong style="color:#0B0E14;">expira en 10 minutos</strong> y es de un solo uso. No lo compartas con nadie.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;text-align:center;">
                Destinatario original: <code style="color:#475569;">${to}</code><br>
                Si no solicitaste este código, ignora este mensaje o comunícate con soporte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F1F3F9;text-align:center;background-color:#F8F9FD;">
              <p style="margin:0;color:#CBD5E1;font-size:11px;letter-spacing:0.5px;">
                © ${new Date().getFullYear()} NEGOVA · Plataforma de Gestión Empresarial
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("❌ Error de la API de Resend al enviar correo:", errorData);
      return { success: false, error: errorData?.message || "Error al enviar correo con Resend" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("❌ Excepción al enviar correo mediante Resend:", err);
    return { success: false, error: err?.message || "Error de red al conectar con Resend." };
  }
}

export interface SendInvoiceEmailParams {
  to: string;
  businessName: string;
  planName: string;
  periodText: string;
  amountCop: number;
  invoiceNumber: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

/**
 * Envía el comprobante de cobro institucional de NEGOVA con el PDF adjunto
 */
export async function sendInvoiceEmail({
  to,
  businessName,
  planName,
  periodText,
  amountCop,
  invoiceNumber,
  pdfBase64,
  pdfFilename,
}: SendInvoiceEmailParams): Promise<{ success: boolean; error?: string }> {
  // Guard de seguridad incondicional: Bloquear llamadas a la API real de Resend durante tests
  if (isTestEnvironment()) {
    return { success: true };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ RESEND_API_KEY no está configurada.");
      return { success: false, error: "Servicio de correo no configurado." };
    }

    const effectiveRecipient = getEffectiveEmailRecipient(to);
    const formattedAmount = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amountCop);

    const attachments: Array<{ filename: string; content: string }> = [];
    if (pdfBase64) {
      attachments.push({
        filename: pdfFilename || `comprobante-${invoiceNumber}.pdf`,
        content: pdfBase64,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: effectiveRecipient,
        subject: `Comprobante de Cobro ${invoiceNumber} — NEGOVA (${planName})`,
        attachments: attachments.length > 0 ? attachments : undefined,
        html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F1F3F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F3F9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header brand -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #F1F3F9;">
              <div style="display:inline-block;background:linear-gradient(135deg,#ED500A,#FF6B35);border-radius:10px;padding:8px 18px;margin-bottom:12px;">
                <span style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">NEGOVA</span>
              </div>
              <p style="margin:0;color:#94A3B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Comprobante de Suscripción</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 16px;color:#0B0E14;font-size:20px;font-weight:700;">
                Hola, ${businessName} 👋
              </h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
                Gracias por confiar en <strong>NEGOVA</strong> como la plataforma de gestión para tu negocio.
                Adjuntamos el comprobante correspondiente al cobro de tu plan contratado.
              </p>

              <!-- Invoice Summary Card -->
              <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:24px 20px;margin:0 0 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#64748B;font-size:13px;">Comprobante:</td>
                    <td align="right" style="padding:6px 0;color:#0B0E14;font-size:14px;font-weight:700;font-family:monospace;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748B;font-size:13px;">Plan Contratado:</td>
                    <td align="right" style="padding:6px 0;color:#0B0E14;font-size:14px;font-weight:600;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748B;font-size:13px;">Período Facturado:</td>
                    <td align="right" style="padding:6px 0;color:#0B0E14;font-size:13px;">${periodText}</td>
                  </tr>
                  <tr style="border-top:1px solid #E2E8F0;">
                    <td style="padding:14px 0 0;color:#ED500A;font-size:15px;font-weight:700;">Valor a Pagar / Pagado:</td>
                    <td align="right" style="padding:14px 0 0;color:#ED500A;font-size:18px;font-weight:800;">${formattedAmount} COP</td>
                  </tr>
                </table>
              </div>

              <!-- Notice -->
              <p style="margin:0 0 20px;color:#64748B;font-size:13px;line-height:1.6;">
                📎 Hemos adjuntado el documento en formato <strong>PDF</strong> a este correo electrónico para tus registros comerciales.
              </p>

              <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;">
                Si tienes alguna inquietud sobre tu suscripción o necesitas asistencia, puedes responder a este correo o contactarnos a través de nuestra mesa de soporte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F1F3F9;text-align:center;background-color:#F8F9FD;">
              <p style="margin:0;color:#CBD5E1;font-size:11px;letter-spacing:0.5px;">
                © ${new Date().getFullYear()} NEGOVA · Tú haces la venta. NEGOVA mantiene todo actualizado.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("❌ Error de la API de Resend al enviar comprobante:", errorData);
      return { success: false, error: errorData?.message || "Error al enviar comprobante con Resend" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("❌ Excepción al enviar comprobante mediante Resend:", err);
    return { success: false, error: err?.message || "Error de red al conectar con Resend." };
  }
}

/**
 * Notificación por correo al equipo de soporte humano de NEGOVA
 * cuando la IA o el cliente solicitan escalación / atención humana.
 */
export async function sendSupportEscalationEmail({
  to,
  conversationNumber,
  businessName,
  userName,
  userEmail,
  userPhone,
  clientMessage,
  conversationId,
  reason = "El cliente solicitó hablar con un asesor humano",
}: {
  to?: string;
  conversationNumber: string;
  businessName: string;
  userName: string;
  userEmail?: string | null;
  userPhone?: string | null;
  clientMessage: string;
  conversationId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Guard de seguridad incondicional: Bloquear llamadas a la API real de Resend durante tests
  if (isTestEnvironment()) {
    return { success: true };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ RESEND_API_KEY no está configurada.");
      return { success: false, error: "Servicio de correo no configurado." };
    }

    const effectiveRecipient = getEffectiveEmailRecipient(to || DEV_RECIPIENT_EMAIL);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const chatUrl = `${appUrl}/admin/soporte?tab=chat&id=${conversationId}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: effectiveRecipient,
        subject: `🚨 [SOPORTE HUMANO] ${businessName} (${conversationNumber}) requiere atención`,
        html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8F9FA;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #E2E8F0;">
          <tr>
            <td style="background:#ED500A;padding:24px 30px;color:#ffffff;">
              <h2 style="margin:0;font-size:20px;font-weight:700;">🚨 Solicitud de Atención Humana</h2>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">
                Conversación ${conversationNumber} · ${businessName}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px;">
              <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
                La IA de Soporte ha recibido una solicitud de intervención humana para el siguiente cliente:
              </p>

              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:20px;">
                <table width="100%" style="font-size:13px;color:#475569;">
                  <tr>
                    <td style="padding:4px 0;font-weight:600;width:120px;">Negocio:</td>
                    <td style="padding:4px 0;color:#0F172A;font-weight:700;">${businessName}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-weight:600;">Contacto:</td>
                    <td style="padding:4px 0;color:#0F172A;">${userName}</td>
                  </tr>
                  ${userEmail ? `<tr><td style="padding:4px 0;font-weight:600;">Email:</td><td style="padding:4px 0;">${userEmail}</td></tr>` : ""}
                  ${userPhone ? `<tr><td style="padding:4px 0;font-weight:600;">Teléfono:</td><td style="padding:4px 0;">${userPhone}</td></tr>` : ""}
                  <tr>
                    <td style="padding:4px 0;font-weight:600;">Motivo:</td>
                    <td style="padding:4px 0;color:#DC2626;font-weight:600;">${reason}</td>
                  </tr>
                </table>
              </div>

              <div style="background:#FFF7ED;border-left:4px solid #ED500A;border-radius:4px;padding:14px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#C2410C;text-transform:uppercase;letter-spacing:0.5px;">Último mensaje del cliente:</p>
                <p style="margin:0;font-size:13px;color:#7C2D12;font-style:italic;">"${clientMessage}"</p>
              </div>

              <div style="text-align:center;margin:30px 0 10px;">
                <a href="${chatUrl}" style="display:inline-block;background-color:#ED500A;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;box-shadow:0 4px 12px rgba(237,80,10,0.3);">
                  👉 Abrir Consola de Soporte en NEGOVA
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px;border-top:1px solid #F1F5F9;text-align:center;background:#F8FAFC;color:#94A3B8;font-size:11px;">
              NEGOVA · Plataforma de Gestión Empresarial
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn("⚠️ Aviso al enviar correo de escalación por Resend:", errorData);
      return { success: false, error: errorData?.message || "Error Resend" };
    }

    return { success: true };
  } catch (err: any) {
    console.warn("⚠️ Excepción al enviar correo de escalación:", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Envía el correo de bienvenida al propietario de un nuevo negocio en NEGOVA
 */
export async function sendWelcomeBusinessEmail({
  to,
  businessName,
  ownerName,
}: {
  to: string;
  businessName: string;
  ownerName: string;
}): Promise<{ success: boolean; error?: string }> {
  // Guard de seguridad incondicional: Bloquear llamadas a la API real de Resend durante tests
  if (isTestEnvironment()) {
    return { success: true };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ RESEND_API_KEY no está configurada.");
      return { success: false, error: "Servicio de correo no configurado." };
    }

    const effectiveRecipient = getEffectiveEmailRecipient(to);
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/login` : "http://localhost:3000/login";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: effectiveRecipient,
        subject: `¡Bienvenido a NEGOVA! - ${businessName} creado con éxito`,
        html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F1F3F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F3F9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #F1F3F9;">
              <div style="display:inline-block;background:linear-gradient(135deg,#ED500A,#FF6B35);border-radius:10px;padding:8px 18px;margin-bottom:12px;">
                <span style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">NEGOVA</span>
              </div>
              <p style="margin:0;color:#94A3B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Bienvenido</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 16px;color:#0B0E14;font-size:20px;font-weight:700;">
                Hola, ${ownerName} 👋
              </h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
                Te confirmamos que tu negocio <strong>${businessName}</strong> ha sido creado correctamente y ya forma parte del ecosistema NEGOVA.
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
                Ya puedes acceder a la plataforma para gestionar tus ventas, inventario y configuración.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${loginUrl}" style="display:inline-block;background-color:#ED500A;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;box-shadow:0 4px 12px rgba(237,80,10,0.3);">
                  Acceder a mi panel
                </a>
              </div>
              <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.6;">
                Si necesitas ayuda para comenzar, nuestro equipo de soporte está siempre disponible para guiarte.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F1F3F9;text-align:center;background-color:#F8F9FD;">
              <p style="margin:0;color:#CBD5E1;font-size:11px;letter-spacing:0.5px;">
                © ${new Date().getFullYear()} NEGOVA · Tú haces la venta. NEGOVA mantiene todo actualizado.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn("❌ Error de la API de Resend al enviar bienvenida:", errorData);
      return { success: false, error: errorData?.message || "Error al enviar bienvenida" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("❌ Excepción al enviar bienvenida mediante Resend:", err);
    return { success: false, error: err?.message || "Error de red" };
  }
}

interface SendAdminAccessRequestEmailParams {
  to: string;
  ownerName: string;
  businessName: string;
  requesterName: string;
  ticketNumber: string;
  scopeLabel: string;
  durationHours: number;
  reason: string;
  workspaceUrl: string;
}

/**
 * Notifica al dueño del negocio cuando el personal de soporte solicita acceso administrativo temporal
 */
export async function sendAdminAccessRequestEmail({
  to,
  ownerName,
  businessName,
  requesterName,
  ticketNumber,
  scopeLabel,
  durationHours,
  reason,
  workspaceUrl,
}: SendAdminAccessRequestEmailParams): Promise<{ success: boolean; error?: string }> {
  if (isTestEnvironment()) {
    return { success: true };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ RESEND_API_KEY no está configurada en las variables de entorno.");
      return { success: false, error: "Servicio de correo no configurado." };
    }

    const effectiveRecipient = getEffectiveEmailRecipient(to);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: effectiveRecipient,
        subject: `[Seguridad] Solicitud de acceso de soporte para ${businessName} (Ticket ${ticketNumber})`,
        html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F1F3F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F3F9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #F1F3F9;">
              <div style="display:inline-block;background:linear-gradient(135deg,#0B0E14,#1E293B);border-radius:10px;padding:8px 18px;margin-bottom:12px;">
                <span style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">NEGOVA</span>
              </div>
              <p style="margin:0;color:#64748B;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Autorización de Asistencia Técnica</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 16px;color:#0B0E14;font-size:20px;font-weight:700;">
                Hola, ${ownerName} 👋
              </h2>
              <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
                El agente <strong>${requesterName}</strong> de soporte técnico de NEGOVA ha solicitado autorización de acceso de solo lectura a tu negocio <strong>${businessName}</strong> para atender el ticket <strong>${ticketNumber}</strong>.
              </p>

              <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#64748B;font-size:12px;font-weight:600;text-transform:uppercase;">Detalles de la solicitud:</p>
                <ul style="margin:0;padding-left:20px;color:#334155;font-size:13px;line-height:1.8;">
                  <li><strong>Alcance:</strong> ${scopeLabel}</li>
                  <li><strong>Duración solicitada:</strong> ${durationHours} horas</li>
                  <li><strong>Motivo técnico:</strong> ${reason}</li>
                </ul>
              </div>

              <div style="text-align:center;margin:28px 0;">
                <a href="${workspaceUrl}" style="display:inline-block;background-color:#ED500A;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;">
                  Revisar y Autorizar en NEGOVA
                </a>
              </div>

              <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.5;">
                🔒 <em>El acceso es estrictamente de solo lectura y puedes revocarlo en cualquier momento desde tu Workspace.</em>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn("❌ Error al enviar notificación de acceso delegado:", errorData);
      return { success: false, error: errorData?.message || "Error al enviar correo" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("❌ Excepción al enviar correo de acceso delegado:", err);
    return { success: false, error: err?.message || "Error de red" };
  }
}



