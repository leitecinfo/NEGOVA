"use client";

import React, { useState } from "react";
import Avvvatars from "avvvatars-react";

export interface UserAvatarProps {
  /** URL de la imagen del avatar en Supabase Storage o externo */
  src?: string | null;
  /** Identificador único para generar la paleta y avatar determinístico (ej: correo electrónico o ID) */
  value?: string;
  /** Nombre completo para calcular iniciales o texto alternativo */
  name?: string;
  /** Tamaño en píxeles (ancho y alto). Por defecto: 32 */
  size?: number;
  /** Radio de curvatura en píxeles. Por defecto: 9 (squircle moderno) */
  radius?: number;
  /** Estilo del placeholder de Avvvatars: "character" (iniciales) o "shape" (formas geométricas). Por defecto: "character" */
  style?: "character" | "shape";
  /** Clases CSS adicionales para el contenedor */
  className?: string;
}

/**
 * Componente universal de Avatar:
 * - Si el usuario tiene imagen `src` válida, muestra la foto de perfil real.
 * - Si no tiene imagen (o si la URL falla al cargar), utiliza la librería `Avvvatars`
 *   con 40 combinaciones de colores vibrantes y elegantes adaptadas a la identidad del usuario.
 */
export function UserAvatar({
  src,
  value,
  name,
  size = 32,
  radius = 9,
  style = "shape",
  className = "",
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Semilla única para Avvvatars (prioriza email, luego nombre, luego valor de respaldo)
  const avatarValue = value || name || "negova-user";

  // Calcular iniciales legibles si se proporciona nombre
  const initials = React.useMemo(() => {
    if (!name) return undefined;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const hasImage = Boolean(src && !imageError);

  if (hasImage && src) {
    return (
      <div
        className={`relative overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
      >
        <img
          src={src}
          alt={name || "Avatar de usuario"}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden shadow-xs ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
      }}
    >
      <Avvvatars
        value={avatarValue}
        displayValue={style === "character" ? initials : undefined}
        style={style}
        size={size}
        radius={radius}
        shadow={false}
      />
    </div>
  );
}
