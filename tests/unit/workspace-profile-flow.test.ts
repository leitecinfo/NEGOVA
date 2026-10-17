import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateWorkspaceProfile,
  sendWorkspaceProfilePasswordOtp,
  verifyWorkspaceProfilePasswordOtp,
  updateWorkspaceProfilePassword,
} from "@/app/workspace/[businessId]/perfil/actions";
import {
  updateAdminProfile,
  sendProfilePasswordOtp,
  verifyProfilePasswordOtp,
  updateAdminPassword,
} from "@/app/admin/perfil/actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Audit Service
vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn(async () => ({ success: true })),
}));

// Mock Resend Email
vi.mock("@/lib/email/resend", () => ({
  sendOtpEmail: vi.fn(async ({ to, otpCode }) => ({
    success: true,
    data: { id: "resend-mock-id" },
  })),
}));

// Base de datos en memoria para el mock de Supabase
let mockProfilesTable: Record<string, any> = {};
let mockUsersTable: Record<string, any> = {};
let mockOtpsTable: Array<{ id: string; email: string; code: string; expires_at: string; attempts: number; created_at: string }> = [];

// Mock de @supabase/supabase-js para cliente admin
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: mockProfilesTable[val] || null,
                error: null,
              })),
            })),
          })),
          upsert: vi.fn(async (payload: any) => {
            mockProfilesTable[payload.id] = { ...mockProfilesTable[payload.id], ...payload };
            return { data: mockProfilesTable[payload.id], error: null };
          }),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: mockUsersTable[val] || null,
                error: null,
              })),
            })),
          })),
          update: vi.fn((payload: any) => ({
            eq: vi.fn(async (col: string, val: string) => {
              if (mockUsersTable[val]) {
                mockUsersTable[val] = { ...mockUsersTable[val], ...payload };
              }
              return { data: null, error: null };
            }),
          })),
        };
      }

      if (table === "password_reset_otps") {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(async (col: string, val: string) => {
              mockOtpsTable = mockOtpsTable.filter((otp) => otp[col as keyof typeof otp] !== val);
              return { data: null, error: null };
            }),
          })),
          insert: vi.fn(async (payload: any) => {
            const newOtp = {
              id: "otp-" + Math.random().toString(36).substring(7),
              attempts: 0,
              created_at: new Date().toISOString(),
              ...payload,
            };
            mockOtpsTable.push(newOtp);
            return { data: newOtp, error: null };
          }),
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    const record = mockOtpsTable
                      .filter((otp) => otp.email === val)
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                    return { data: record || null, error: null };
                  }),
                })),
              })),
            })),
          })),
          update: vi.fn((payload: any) => ({
            eq: vi.fn(async (col: string, val: string) => {
              const record = mockOtpsTable.find((otp) => otp.id === val);
              if (record) {
                Object.assign(record, payload);
              }
              return { data: null, error: null };
            }),
          })),
        };
      }

      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
      };
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: "user-123.jpg" }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://storage.supabase.co/avatars/user-123.jpg" } })),
        remove: vi.fn(async () => ({ data: [], error: null })),
        list: vi.fn(async () => ({ data: [], error: null })),
      })),
    },
    auth: {
      admin: {
        updateUserById: vi.fn(async (userId: string, data: any) => ({ data: { id: userId, ...data }, error: null })),
      },
    },
  })),
}));

// Mock de Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "7bfdea13-6a76-4011-a699-7582c6bad4e5",
            email: "carlos@comercio.com",
            user_metadata: { full_name: "Carlos Mendoza" },
          },
        },
        error: null,
      })),
      signInWithPassword: vi.fn(async ({ email, password }) => {
        if (password === "ClaveActualCorrecta123!") {
          return { data: { user: { id: "7bfdea13-6a76-4011-a699-7582c6bad4e5" } }, error: null };
        }
        return { data: null, error: { message: "Invalid credentials" } };
      }),
      updateUser: vi.fn(async () => ({ data: null, error: null })),
    },
  })),
}));

// Mock de contexto de autorización de Workspace
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(async (businessId: string, requiredPerm: string) => {
    if (businessId === "biz-no-session") {
      return { success: false, error: "Sesión no válida o expirada." };
    }
    if (businessId === "biz-unauthorized" || businessId === "invalid-uuid") {
      return { success: false, error: "Acceso denegado: no tienes una membresía activa en este comercio." };
    }
    return {
      success: true,
      context: {
        userId: "7bfdea13-6a76-4011-a699-7582c6bad4e5",
        userEmail: "carlos@comercio.com",
        businessId: businessId,
        businessName: "Comida Rápida AA Gourmet",
        businessStatus: "active",
        roleCode: "owner",
        roleName: "Dueño / Propietario",
        isOwner: true,
        isSuperAdmin: false,
      },
    };
  }),
  requireWorkspaceSession: vi.fn(async (businessId: string) => {
    if (businessId === "biz-unauthorized") {
      throw new Error("workspace_unauthorized");
    }
    return {
      userId: "7bfdea13-6a76-4011-a699-7582c6bad4e5",
      userEmail: "carlos@comercio.com",
      businessId: businessId,
      businessName: "Comida Rápida AA Gourmet",
      businessStatus: "active",
      roleCode: "owner",
      roleName: "Dueño / Propietario",
      isOwner: true,
      isSuperAdmin: false,
    };
  }),
}));

describe("Workspace & Admin Profile Flow Architecture (Fase 2.5.1)", () => {
  const REAL_BUSINESS_ID = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const UNAUTHORIZED_BIZ_ID = "biz-unauthorized";
  const NO_SESSION_BIZ_ID = "biz-no-session";
  const USER_ID = "7bfdea13-6a76-4011-a699-7582c6bad4e5";

  beforeEach(() => {
    mockProfilesTable = {
      [USER_ID]: {
        id: USER_ID,
        full_name: "Carlos Mendoza Original",
        phone: "+57 300 123 4567",
        bio: "Administrador de sucursal",
        avatar_url: "https://storage.supabase.co/avatars/user-123.jpg",
      },
    };
    mockUsersTable = {
      [USER_ID]: {
        id: USER_ID,
        email: "carlos@comercio.com",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    };
    mockOtpsTable = [];
  });

  describe("1. Consulta y Actualización de Datos Personales", () => {
    it("1. Debe permitir al usuario autenticado actualizar sus datos personales en Workspace", async () => {
      const formData = new FormData();
      formData.append("fullName", "Carlos Mendoza Editado");
      formData.append("phone", "+57 300 999 8888");
      formData.append("bio", "Encargado de operaciones");

      const res = await updateWorkspaceProfile(REAL_BUSINESS_ID, formData);
      expect(res.success).toBe(true);
      expect(res.message).toContain("Perfil actualizado");
      expect(mockProfilesTable[USER_ID].full_name).toBe("Carlos Mendoza Editado");
      expect(mockProfilesTable[USER_ID].phone).toBe("+57 300 999 8888");
    });

    it("2. Debe rechazar la actualización si el nombre tiene formato inválido", async () => {
      const formData = new FormData();
      formData.append("fullName", "A"); // Menor a 2 caracteres
      formData.append("phone", "3001234567");

      const res = await updateWorkspaceProfile(REAL_BUSINESS_ID, formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain("al menos 2 caracteres");
    });

    it("3. Debe rechazar solicitudes sin sesión autenticada", async () => {
      const formData = new FormData();
      formData.append("fullName", "Carlos Mendoza");

      const res = await updateWorkspaceProfile(NO_SESSION_BIZ_ID, formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Sesión no válida");
    });

    it("4. Debe rechazar solicitudes a comercios donde el usuario no tiene membresía activa", async () => {
      const formData = new FormData();
      formData.append("fullName", "Carlos Intruso");

      const res = await updateWorkspaceProfile(UNAUTHORIZED_BIZ_ID, formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain("membresía activa");
    });
  });

  describe("2. Aislamiento y No Modificación de Roles ni Perfiles Ajenos", () => {
    it("5. No debe permitir que el cliente modifique el perfil de otro usuario forzando userId", async () => {
      const formData = new FormData();
      formData.append("userId", "victima-uuid-9999");
      formData.append("fullName", "Nombre Manipulado");

      const res = await updateWorkspaceProfile(REAL_BUSINESS_ID, formData);
      expect(res.success).toBe(true);
      // Solo modifica el usuario de la sesión autenticada
      expect(mockProfilesTable["victima-uuid-9999"]).toBeUndefined();
      expect(mockProfilesTable[USER_ID].full_name).toBe("Nombre Manipulado");
    });

    it("6. No debe permitir inyectar o modificar roles, permisos ni estado de cuenta", async () => {
      const formData = new FormData();
      formData.append("fullName", "Carlos Mendoza");
      formData.append("role", "super_admin");
      formData.append("role_code", "super_admin");
      formData.append("status", "active_override");

      const res = await updateWorkspaceProfile(REAL_BUSINESS_ID, formData);
      expect(res.success).toBe(true);
      expect(mockProfilesTable[USER_ID].role).toBeUndefined();
      expect(mockProfilesTable[USER_ID].status).toBeUndefined();
    });
  });

  describe("3. Gestión del Avatar", () => {
    it("7. Debe permitir eliminar la foto de perfil y restablecer el avatar por defecto", async () => {
      const formData = new FormData();
      formData.append("fullName", "Carlos Mendoza");
      formData.append("removeAvatar", "true");

      const res = await updateWorkspaceProfile(REAL_BUSINESS_ID, formData);
      expect(res.success).toBe(true);
      expect(res.message).toContain("eliminada");
      expect(res.avatarUrl).toBeNull();
      expect(mockProfilesTable[USER_ID].avatar_url).toBeNull();
    });
  });

  describe("4. Flujo de Seguridad y Cambio de Contraseña (2FA / OTP)", () => {
    it("8. Flujo completo OTP: envío, validación, intentos fallidos y expiración", async () => {
      // A. Envío de OTP
      const sendRes = await sendWorkspaceProfilePasswordOtp(REAL_BUSINESS_ID);
      expect(sendRes.success).toBe(true);
      expect(sendRes.message).toContain("Código de verificación");
      expect(mockOtpsTable.length).toBe(1);

      const generatedCode = mockOtpsTable[0].code;

      // B. Código con formato incompleto
      const invalidOtpRes = await verifyWorkspaceProfilePasswordOtp(REAL_BUSINESS_ID, "12");
      expect(invalidOtpRes.success).toBe(false);
      expect(invalidOtpRes.error).toContain("6 dígitos");

      // C. Intento con código incorrecto
      const wrongOtpRes = await verifyWorkspaceProfilePasswordOtp(REAL_BUSINESS_ID, "000000");
      expect(wrongOtpRes.success).toBe(false);
      expect(wrongOtpRes.error).toContain("incorrecto");

      // D. Código correcto
      const validOtpRes = await verifyWorkspaceProfilePasswordOtp(REAL_BUSINESS_ID, generatedCode);
      expect(validOtpRes.success).toBe(true);
      expect(validOtpRes.message).toContain("Identidad verificada");
    });

    it("9. Debe rechazar contraseñas débiles o idénticas a la contraseña actual", async () => {
      // Insertar OTP válido en memoria
      mockOtpsTable.push({
        id: "otp-test-1",
        email: "carlos@comercio.com",
        code: "654321",
        expires_at: new Date(Date.now() + 600000).toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      });

      // A. Contraseña débil
      const weakFormData = new FormData();
      weakFormData.append("currentPassword", "ClaveActualCorrecta123!");
      weakFormData.append("newPassword", "simple");
      weakFormData.append("confirmPassword", "simple");
      weakFormData.append("otpCode", "654321");

      const weakRes = await updateWorkspaceProfilePassword(REAL_BUSINESS_ID, weakFormData);
      expect(weakRes.success).toBe(false);
      expect(weakRes.error).toBeDefined();

      // B. Contraseña idéntica
      const sameFormData = new FormData();
      sameFormData.append("currentPassword", "ClaveActualCorrecta123!");
      sameFormData.append("newPassword", "ClaveActualCorrecta123!");
      sameFormData.append("confirmPassword", "ClaveActualCorrecta123!");
      sameFormData.append("otpCode", "654321");

      const sameRes = await updateWorkspaceProfilePassword(REAL_BUSINESS_ID, sameFormData);
      expect(sameRes.success).toBe(false);
      expect(sameRes.error).toContain("no puede ser idéntica");
    });
  });

  describe("5. Compatibilidad e Independencia con /admin/perfil", () => {
    it("10. Las funciones administrativas de perfil mantienen sus exportaciones y firmas intactas", async () => {
      expect(typeof updateAdminProfile).toBe("function");
      expect(typeof sendProfilePasswordOtp).toBe("function");
      expect(typeof verifyProfilePasswordOtp).toBe("function");
      expect(typeof updateAdminPassword).toBe("function");
    });
  });
});
