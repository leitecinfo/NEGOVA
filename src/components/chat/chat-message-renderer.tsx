"use client";

import React from "react";

interface FormattedMessageContentProps {
  content: string;
  className?: string;
  isCurrentUser?: boolean;
}

/**
 * Parsea una línea de texto para renderizar negritas (**texto**), cursivas (*texto*),
 * enlaces [texto](url) y código en línea `código`.
 */
function parseInlineMarkdown(text: string, isCurrentUser: boolean = false): React.ReactNode[] {
  // Regex para capturar **bold**, *italic*, [link](url), `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Negrita **texto**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong
          key={index}
          className={
            isCurrentUser
              ? "font-bold text-white underline-offset-2"
              : "font-bold text-slate-900 dark:text-white"
          }
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Cursiva *texto*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Código en línea `código`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className={
            isCurrentUser
              ? "px-1 py-0.5 rounded bg-white/20 font-mono text-[11px]"
              : "px-1 py-0.5 rounded bg-slate-200/80 dark:bg-white/10 font-mono text-[11px] text-[#ED500A]"
          }
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Enlaces [texto](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const href = linkMatch[2];
      const isExternal = href.startsWith("http");

      return (
        <a
          key={index}
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className={
            isCurrentUser
              ? "underline text-white font-medium hover:opacity-80"
              : "text-[#ED500A] underline hover:text-[#F36320] font-medium"
          }
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Componente principal para renderizar el contenido formateado de un mensaje de chat.
 * Soporta saltos de línea, viñetas (* o -), listas numeradas y negritas/enlaces.
 */
export function FormattedChatMessage({
  content,
  className = "",
  isCurrentUser = false,
}: FormattedMessageContentProps) {
  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className={`space-y-1.5 text-xs leading-relaxed ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Viñetas: * item o - item o • item
        const isBullet =
          trimmed.startsWith("* ") ||
          trimmed.startsWith("- ") ||
          trimmed.startsWith("• ");

        if (isBullet) {
          const bulletText = trimmed.substring(2).trim();
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
              <span
                className={
                  isCurrentUser
                    ? "text-white/80 font-bold shrink-0 mt-0.5"
                    : "text-[#ED500A] font-bold shrink-0 mt-0.5"
                }
              >
                •
              </span>
              <span className="flex-1">
                {parseInlineMarkdown(bulletText, isCurrentUser)}
              </span>
            </div>
          );
        }

        // Línea normal
        return (
          <p key={idx} className="m-0">
            {parseInlineMarkdown(line, isCurrentUser)}
          </p>
        );
      })}
    </div>
  );
}
