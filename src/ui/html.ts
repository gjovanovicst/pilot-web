/**
 * A very small, dependency-free HTML templating helper.
 *
 * The repository ships no component runtime (no React/Vite toolchain is
 * available, and the sandbox has no network to install one), so views are
 * plain functions returning escaped markup. `html` escapes every interpolation
 * so a value coming from user input or a constant can never inject markup;
 * `Html` values returned by other views pass through untouched.
 */

export type Html = { readonly __html: string };

/** Mark an already-safe markup fragment. Never use it on user input. */
export function raw(markup: string): Html {
  return { __html: markup };
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char] as string);
}

export function isHtml(value: unknown): value is Html {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Html).__html === 'string'
  );
}

function interpolate(value: unknown): string {
  if (isHtml(value)) return value.__html;
  if (Array.isArray(value)) return value.map(interpolate).join('');
  return escapeHtml(value);
}

/** Tagged template that returns escaped, composable markup. */
export function html(
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
): Html {
  let out = strings[0] ?? '';
  for (let index = 0; index < values.length; index += 1) {
    out += interpolate(values[index]) + (strings[index + 1] ?? '');
  }
  return raw(out);
}

/** Flatten a view to its markup string (used by tests and the renderer). */
export function toMarkup(node: Html | string): string {
  return isHtml(node) ? node.__html : node;
}

/** Text content of a markup string, with tags removed and whitespace collapsed. */
export function toText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
