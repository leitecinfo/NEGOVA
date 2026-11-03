/**
 * Utilidad pura para renderizar y reemplazar variables en plantillas de notificación.
 * Es seguro para usarse en componentes cliente y servidor.
 */
export function renderTemplatePreview(
  template: string,
  variables: Record<string, string>
): string {
  if (!template) return "";
  let rendered = template;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    rendered = rendered.replace(regex, val);
  }
  return rendered;
}

