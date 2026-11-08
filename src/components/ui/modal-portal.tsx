"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ModalPortalProps {
  children: React.ReactNode;
  /**
   * Si es true, bloquea el scroll de document.body mientras el portal esté montado.
   * Restaura el overflow original al desmontarse.
   */
  lockScroll?: boolean;
}

export function ModalPortal({ children, lockScroll = false }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !lockScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, lockScroll]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}

// Aliases para retrocompatibilidad
export const AdminModalPortal = ModalPortal;
export type AdminModalPortalProps = ModalPortalProps;
