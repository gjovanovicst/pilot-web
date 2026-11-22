import { escapeHtml } from '../lib/html.ts';

/**
 * The approved empty-state pattern: a title, a description and optional extra
 * content. Lists and pages render it instead of a blank screen.
 *
 * The title and the description are wired to the section through
 * `aria-labelledby` / `aria-describedby`, so the component exposes a named
 * region landmark to assistive technology, and the section also carries the id
 * itself: a page that renders more than one named section can then anchor on
 * *its* empty state by id instead of on whichever region comes first in
 * document order.
 *
 * Markup only: all styling lives in src/styles/app.css and comes from the
 * design-system v1 tokens, so this component never carries raw values.
 */
export type EmptyStateProps = {
  title: string;
  description: string;
  /** Pre-rendered, already-escaped HTML shown below the description. */
  children?: string;
  /**
   * Id of the empty state. It is rendered on the section, and the title and
   * description are named `<id>-title` / `<id>-description`. Give every empty
   * state on the same page its own value so ids and references stay unique.
   */
  id?: string;
};

/** The id base a lone empty state uses. */
export const DEFAULT_EMPTY_STATE_ID = 'empty-state';

export function EmptyState({
  title,
  description,
  children,
  id = DEFAULT_EMPTY_STATE_ID,
}: EmptyStateProps): string {
  const emptyStateId = escapeHtml(id);
  const titleId = escapeHtml(`${id}-title`);
  const descriptionId = escapeHtml(`${id}-description`);

  const lines: string[] = [
    '<section',
    `  id="${emptyStateId}"`,
    '  class="empty-state"',
    `  aria-labelledby="${titleId}"`,
    `  aria-describedby="${descriptionId}"`,
    '>',
    `  <h2 class="empty-state__title" id="${titleId}">${escapeHtml(title)}</h2>`,
    `  <p class="empty-state__description" id="${descriptionId}">${escapeHtml(description)}</p>`,
  ];

  if (children) {
    lines.push(`  <div class="empty-state__extra">${children}</div>`);
  }

  lines.push('</section>');
  return lines.join('\n');
}
