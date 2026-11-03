import crypto from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/auth/users-service";
import { hasPermission } from "@/lib/auth/authorization";

const PIN_REGEX = /^\d{4,6}$/;
const ITERATIONS = 100000;
const KEY_LEN = 32;
const DIGEST = "sha256";

/**
 * Valida el formato numérico del PIN (4 a 6 dígitos exactos).
 */
export function isValidPinFormat(pin: string): boolean {
  if (!pin || typeof pin !== "string") return false;
  return PIN_REGEX.test(pin.trim());
}

/**
 * Genera un hash criptográfico robusto (PBKDF2-SHA256 con Salt aleatorio de 16 bytes).
 * El PIN nunca se almacena en texto plano en la base de datos.
 */
export function hashPin(pin: string): string {
  const cleanPin = pin.trim();
  if (!isValidPinFormat(cleanPin)) {
    throw new Error("El PIN debe tener entre 4 y 6 dígitos numéricos.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .pbkdf2Sync(cleanPin, salt, ITERATIONS, KEY_LEN, DIGEST)
    .toString("hex");

  return `pbkdf2$${ITERATIONS}$${salt}$${derivedKey}`;
}

/**
 * Verifica un PIN plano contra un hash PBKDF2 almacenado de forma segura contra ataques de temporización.
 */
export function verifyPinHash(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedKeyHex = parts[3];

  if (isNaN(iterations) || !salt || !expectedKeyHex) {
    return false;
  }

  try {
    const derivedKey = crypto.pbkdf2Sync(pin.trim(), salt, iterations, KEY_LEN, DIGEST);
    const expectedKey = Buffer.from(expectedKeyHex, "hex");

    if (derivedKey.length !== expectedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch (err) {
    console.error("[verifyPinHash Error]:", err);
    return false;
  }
}

/**
 * Asigna o actualiza el PIN de seguridad de un usuario en un comercio.
 */
export async function assignUserSecurityPin(
  businessId: string,
  userId: string,
  pin: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidPinFormat(pin)) {
      return { success: false, error: "El PIN debe tener entre 4 y 6 dígitos numéricos." };
    }

    const hashedPin = hashPin(pin);
    const admin = await getSupabaseAdminClient();

    const { error: updateErr } = await admin
      .from("business_users")
      .update({
        security_pin_hash: hashedPin,
        security_pin_updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("[assignUserSecurityPin DB Error]:", updateErr);
      return { success: false, error: "No se pudo guardar el PIN de seguridad." };
    }

    // Registrar en auditoría
    await recordAuditLog({
      businessId,
      userId: actorUserId || userId,
      action: "security_pin.assigned",
      entity: "business_user",
      entityId: userId,
      details: { targetUserId: userId },
      authorizedBy: actorUserId || userId,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[assignUserSecurityPin Error]:", err);
    return { success: false, error: err.message || "Error al configurar PIN de seguridad." };
  }
}

/**
 * Remueve el PIN de seguridad de un usuario en un comercio.
 */
export async function removeUserSecurityPin(
  businessId: string,
  userId: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    const { error: updateErr } = await admin
      .from("business_users")
      .update({
        security_pin_hash: null,
        security_pin_updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("[removeUserSecurityPin DB Error]:", updateErr);
      return { success: false, error: "No se pudo remover el PIN de seguridad." };
    }

    await recordAuditLog({
      businessId,
      userId: actorUserId || userId,
      action: "security_pin.removed",
      entity: "business_user",
      entityId: userId,
      details: { targetUserId: userId },
      authorizedBy: actorUserId || userId,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[removeUserSecurityPin Error]:", err);
    return { success: false, error: err.message || "Error al remover PIN." };
  }
}

/**
 * Asigna o actualiza el PIN de seguridad de un colaborador en el directorio de empleados.
 */
export async function assignEmployeeSecurityPin(
  businessId: string,
  employeeId: string,
  pin: string,
  actorUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidPinFormat(pin)) {
      return { success: false, error: "El PIN debe tener entre 4 y 6 dígitos numéricos." };
    }

    const hashedPin = hashPin(pin);
    const admin = await getSupabaseAdminClient();

    const { error: updateErr } = await admin
      .from("business_employees")
      .update({
        security_pin_hash: hashedPin,
        security_pin_updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("id", employeeId);

    if (updateErr) {
      console.error("[assignEmployeeSecurityPin DB Error]:", updateErr);
      return { success: false, error: "No se pudo guardar el PIN del colaborador." };
    }

    await recordAuditLog({
      businessId,
      userId: actorUserId || null,
      action: "security_pin.employee_assigned",
      entity: "business_employee",
      entityId: employeeId,
      details: { employeeId },
      authorizedBy: actorUserId || null,
      authorizedByEmployeeId: employeeId,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[assignEmployeeSecurityPin Error]:", err);
    return { success: false, error: err.message || "Error al asignar PIN al colaborador." };
  }
}

export interface AuthorizerInfo {
  id: string;
  fullName: string;
  role: string;
  employeeId?: string | null;
}

export interface VerifyPinAuthorizationInput {
  pin: string;
  requiredPermission: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: any;
  actorUserId?: string | null;
}

/**
 * Valida un PIN de autorización para operaciones sensibles en el comercio.
 * 1. Verifica contra `business_users` o `business_employees` que posean hash configurado.
 * 2. Si encuentra coincidencia, valida si el colaborador posee el permiso requerido (o es owner/admin).
 * 3. Si es válido y tiene permisos: registra en `audit_logs` quién autorizó y retorna éxito.
 * 4. Si el PIN es incorrecto o carece de permisos: rechaza la operación.
 */
export async function verifyPinAuthorization(
  businessId: string,
  input: VerifyPinAuthorizationInput
): Promise<{
  success: boolean;
  authorized?: boolean;
  authorizer?: AuthorizerInfo;
  auditLogId?: string;
  error?: string;
}> {
  try {
    const cleanPin = (input.pin || "").trim();
    if (!isValidPinFormat(cleanPin)) {
      return {
        success: false,
        authorized: false,
        error: "El PIN debe contener entre 4 y 6 dígitos numéricos.",
      };
    }

    const admin = await getSupabaseAdminClient();

    // 1. Consultar usuarios del negocio con PIN configurado
    const { data: businessUsers, error: buErr } = await admin
      .from("business_users")
      .select(`
        id,
        user_id,
        security_pin_hash,
        status,
        roles(code, name),
        users(id, full_name, email)
      `)
      .eq("business_id", businessId)
      .in("status", ["active", "invited"])
      .not("security_pin_hash", "is", null);

    if (buErr) {
      console.error("[verifyPinAuthorization BU Fetch Error]:", buErr);
    }

    let matchedUser: any = null;

    if (businessUsers && businessUsers.length > 0) {
      for (const bu of businessUsers) {
        if (bu.security_pin_hash && verifyPinHash(cleanPin, bu.security_pin_hash)) {
          matchedUser = bu;
          break;
        }
      }
    }

    // 2. Si no coincide en business_users, buscar en business_employees
    let matchedEmployee: any = null;
    if (!matchedUser) {
      const { data: employees, error: empErr } = await admin
        .from("business_employees")
        .select("id, user_id, first_name, last_name, job_title, security_pin_hash, status")
        .eq("business_id", businessId)
        .eq("status", "active")
        .not("security_pin_hash", "is", null);

      if (empErr) {
        console.error("[verifyPinAuthorization EMP Fetch Error]:", empErr);
      }

      if (employees && employees.length > 0) {
        for (const emp of employees) {
          if (emp.security_pin_hash && verifyPinHash(cleanPin, emp.security_pin_hash)) {
            matchedEmployee = emp;
            break;
          }
        }
      }
    }

    // Si no coincide con ningún PIN registrado
    if (!matchedUser && !matchedEmployee) {
      return {
        success: false,
        authorized: false,
        error: "El PIN de autorización ingresado es incorrecto.",
      };
    }

    // 3. Validar si el colaborador tiene el permiso requerido
    let authorizerUserId: string | null = null;
    let authorizerEmployeeId: string | null = null;
    let authorizerName = "Colaborador";
    let authorizerRole = "auxiliar";
    let isAuthorized = false;

    if (matchedUser) {
      authorizerUserId = matchedUser.user_id;
      authorizerName = matchedUser.users?.full_name || "Usuario del Negocio";
      authorizerRole = matchedUser.roles?.code || "auxiliar";

      // Owners y administradores siempre tienen permiso para autorizar cualquier operación sensible
      if (authorizerRole === "owner" || authorizerRole === "admin") {
        isAuthorized = true;
      } else {
        isAuthorized = await hasPermission(matchedUser.user_id, input.requiredPermission, {
          businessId,
        });
      }
    } else if (matchedEmployee) {
      authorizerEmployeeId = matchedEmployee.id;
      authorizerName = `${matchedEmployee.first_name} ${matchedEmployee.last_name}`.trim();
      authorizerRole = matchedEmployee.job_title || "Empleado";

      // Si el empleado tiene usuario vinculado, validar permisos de ese usuario
      if (matchedEmployee.user_id) {
        authorizerUserId = matchedEmployee.user_id;
        isAuthorized = await hasPermission(matchedEmployee.user_id, input.requiredPermission, {
          businessId,
        });
      } else {
        // Si es cargo de gerencia / supervisor registrado en personal
        const titleLower = (matchedEmployee.job_title || "").toLowerCase();
        if (
          titleLower.includes("administrador") ||
          titleLower.includes("gerente") ||
          titleLower.includes("supervisor") ||
          titleLower.includes("jefe")
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return {
        success: false,
        authorized: false,
        error: `El colaborador (${authorizerName}) no cuenta con permisos suficientes para autorizar esta operación.`,
      };
    }

    // 4. Registrar en audit_logs la autorización concedida
    const auditRes = await recordAuditLog({
      businessId,
      userId: input.actorUserId || authorizerUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: {
        ...(input.details || {}),
        authorizedBy: {
          name: authorizerName,
          role: authorizerRole,
          userId: authorizerUserId,
          employeeId: authorizerEmployeeId,
        },
      },
      authorizedBy: authorizerUserId,
      authorizedByEmployeeId: authorizerEmployeeId,
    });

    return {
      success: true,
      authorized: true,
      authorizer: {
        id: authorizerUserId || authorizerEmployeeId || "",
        fullName: authorizerName,
        role: authorizerRole,
        employeeId: authorizerEmployeeId,
      },
      auditLogId: auditRes.id,
    };
  } catch (err: any) {
    console.error("[verifyPinAuthorization Error]:", err);
    return {
      success: false,
      authorized: false,
      error: err.message || "Error al verificar PIN de autorización.",
    };
  }
}

/**
 * Registra un evento en la tabla `audit_logs`.
 */
export async function recordAuditLog(params: {
  businessId: string;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: any;
  authorizedBy?: string | null;
  authorizedByEmployeeId?: string | null;
  ipAddress?: string | null;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    const { data, error } = await admin
      .from("audit_logs")
      .insert({
        business_id: params.businessId,
        user_id: params.userId || null,
        action: params.action,
        entity: params.entity || null,
        entity_id: params.entityId || null,
        details: params.details || null,
        authorized_by: params.authorizedBy || null,
        authorized_by_employee_id: params.authorizedByEmployeeId || null,
        ip_address: params.ipAddress || null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[recordAuditLog Warning]:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.warn("[recordAuditLog Error]:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * [POS-005] Verifica si el negocio requiere PIN de autorización para anulaciones
 * según la configuración del negocio o si existen usuarios/colaboradores con PIN activo.
 */
export async function doesBusinessRequirePinForCancellation(
  businessId: string
): Promise<boolean> {
  try {
    const admin = await getSupabaseAdminClient();

    const { data: buList } = await admin
      .from("business_users")
      .select("id, security_pin_hash")
      .eq("business_id", businessId)
      .eq("status", "active");

    if (Array.isArray(buList) && buList.some((u: any) => Boolean(u.security_pin_hash))) {
      return true;
    }

    const { data: empList } = await admin
      .from("employees")
      .select("id, security_pin_hash")
      .eq("business_id", businessId)
      .eq("status", "active");

    if (Array.isArray(empList) && empList.some((e: any) => Boolean(e.security_pin_hash))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
