import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Mock de next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["x-real-ip", "127.0.0.1"]])),
  cookies: vi.fn(async () => ({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  })),
}));

// Mock de Resend para no enviar correos reales durante tests
vi.mock("../../src/lib/email/resend", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock de @/lib/supabase/server para aislar las llamadas de auth en tests y evitar cerrar la sesión activa del usuario real en el navegador
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: vi.fn(async ({ email, password }: any) => {
        if (password !== "Leinerhc_20@") {
          return { data: { user: null }, error: { message: "Credenciales incorrectas" } };
        }
        return {
          data: {
            user: {
              id: "e53b803b-8f08-48b7-b833-365908946531",
              email,
              app_metadata: { role: "owner" },
              user_metadata: { role: "owner" },
            },
            session: { access_token: "mock-test-token" },
          },
          error: null,
        };
      }),
      signOut: vi.fn(async () => ({ error: null })),
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "e53b803b-8f08-48b7-b833-365908946531",
            email: "alexandersmithh2002@gmail.com",
          },
        },
        error: null,
      })),
    },
  })),
}));

describe("NEGOVA — Flujo de Autenticación MFA para OWNER", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. loginWithPassword detecta al OWNER y responde con requiresMfa: true", async () => {
    // Importar dinámicamente las acciones
    const { loginWithPassword } = await import("../../src/app/(auth)/actions");

    const formData = new FormData();
    formData.append("email", "alexandersmithh2002@gmail.com");
    formData.append("password", "Leinerhc_20@");

    const res = await loginWithPassword(formData);

    // Debe exigir MFA para el Owner
    expect(res.success).toBe(true);
    expect(res.requiresMfa).toBe(true);
    expect(res.mfaEmail).toBe("alexandersmithh2002@gmail.com");
  });

  it("2. verifyLoginMfaOtp rechaza un código OTP incorrecto", async () => {
    const { verifyLoginMfaOtp } = await import("../../src/app/(auth)/actions");

    const formData = new FormData();
    formData.append("email", "alexandersmithh2002@gmail.com");
    formData.append("otpCode", "000000"); // Código incorrecto
    formData.append("password", "Leinerhc_20@");

    const res = await verifyLoginMfaOtp(formData);

    expect(res.success).toBe(false);
    expect(res.error).toContain("incorrecto");
  });

  it("3. verifyLoginMfaOtp valida el código correcto y entrega la redirección al workspace", async () => {
    const { verifyLoginMfaOtp } = await import("../../src/app/(auth)/actions");
    const { createClient } = await import("@supabase/supabase-js");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Obtener el OTP generado para este usuario
    const { data: otpRow } = await supabaseAdmin
      .from("password_reset_otps")
      .select("code")
      .eq("email", "alexandersmithh2002@gmail.com")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(otpRow).toBeDefined();
    expect(otpRow?.code).toHaveLength(6);

    const formData = new FormData();
    formData.append("email", "alexandersmithh2002@gmail.com");
    formData.append("otpCode", otpRow!.code);
    formData.append("password", "Leinerhc_20@");

    const res = await verifyLoginMfaOtp(formData);

    expect(res.success).toBe(true);
    expect(res.redirectUrl).toContain("/workspace/");
  });

  it("4. verifyLoginMfaOtp no permite reutilizar un código ya consumido", async () => {
    const { verifyLoginMfaOtp } = await import("../../src/app/(auth)/actions");

    const formData = new FormData();
    formData.append("email", "alexandersmithh2002@gmail.com");
    formData.append("otpCode", "123456");
    formData.append("password", "Leinerhc_20@");

    const res = await verifyLoginMfaOtp(formData);

    expect(res.success).toBe(false);
  });

  afterAll(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await supabaseAdmin
      .from("platform_settings")
      .delete()
      .ilike("key", "%security:lockout%");
  });
});
