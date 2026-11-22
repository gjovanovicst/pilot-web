import { escapeHtml } from '../lib/html.ts';

/**
 * The approved empty-state pattern: a title, a description and optional extra
 * content. Lists and pages render it instead of a blank screen.
 *
 * Markup only: all styling lives in src/styles/app.css and comes from the
 * design-system v1 tokens, so this component never carries raw values.
 */
export type EmptyStateProps = {
  title: string;
  description: string;
  /** Pre-rendered, already-escaped HTML shown below the description. */
  children?: string;
};

export function EmptyState({ title, description, children }: EmptyStateProps): string {
  const lines: string[] = [
    '<section class="empty-state">',
    `  <h2 class="empty-state__title">${escapeHtml(title)}</h2>`,
    `  <p class="empty-state__description">${escapeHtml(description)}</p>`,
  ];

  if (children) {
    lines.push(`  <div class="empty-state__extra">${children}</div>`);
  }

  lines.push('</section>');
  return lines.join('\n');
}
