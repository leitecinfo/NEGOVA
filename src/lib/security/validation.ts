import { z } from "zod";

// Esquema de validación para inicio de sesión con correo y contraseña
export const passwordLoginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Ingrese un correo electrónico válido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida"),
});

// Esquema de complejidad para creación y cambio de contraseñas
export const passwordComplexitySchema = z.object({
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial (@, $, !, %, etc.)"),
});

// Esquema de validación para solicitar código OTP por teléfono (anti-abuso de trials)
export const phoneOtpSchema = z.object({
  phone: z
    .string()
    .min(1, "El número de celular es requerido")
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Debe incluir el código de país en formato internacional (Ej: +573001234567)"
    ),
});

// Esquema para la verificación del código OTP de 6 dígitos
export const verifyOtpSchema = z.object({
  phone: z.string().min(1, "Teléfono requerido"),
  token: z
    .string()
    .length(6, "El código de verificación debe ser de 6 dígitos")
    .regex(/^\d+$/, "El código solo debe contener números"),
});
