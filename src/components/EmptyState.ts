/**
 * Approved-pattern empty state: a title, a description, an optional block of
 * named credentials and at most one action. Styling comes exclusively from
 * `src/styles/app.css`, which in turn uses only design system v1 tokens
 * (no inline colour or spacing values are emitted here).
 */

import type { Html } from '../ui/html.ts';
import { html } from '../ui/html.ts';

export type EmptyStateCredentials = {
  readonly email: string;
  readonly password: string;
};

export type EmptyStateAction = {
  /** Visible button label. */
  readonly label: string;
  /** Value for the `data-action` attribute the client runtime dispatches on. */
  readonly action: string;
  /** Accessible name, when the visible label is not descriptive on its own. */
  readonly ariaLabel?: string;
};

export type EmptyStateProps = {
  /** Visible heading; also used to label the group for assistive technology. */
  readonly title: string;
  /** Supporting copy that explains what the user should do next. */
  readonly description: string;
  /** Credentials the empty state must name, e.g. the demo account. */
  readonly credentials?: EmptyStateCredentials;
  /** Optional single action rendered after the copy. */
  readonly action?: EmptyStateAction;
  /** DOM id of the heading; must be unique on the page. */
  readonly id: string;
};

export function EmptyState({
  title,
  description,
  credentials,
  action,
  id,
}: EmptyStateProps): Html {
  const credentialsBlock = credentials
    ? html`<dl class="empty-state__credentials">
          <dt class="empty-state__label">Demo email</dt>
          <dd class="empty-state__value">${credentials.email}</dd>
          <dt class="empty-state__label">Demo password</dt>
          <dd class="empty-state__value">${credentials.password}</dd>
        </dl>`
    : null;

  const actionBlock = action
    ? html`<button
          class="button button--secondary"
          type="button"
          data-action="${action.action}"
          ${action.ariaLabel ? html`aria-label="${action.ariaLabel}"` : null}
        >
          ${action.label}
        </button>`
    : null;

  return html`<section class="empty-state" role="group" aria-labelledby="${id}">
      <h2 class="empty-state__title" id="${id}">${title}</h2>
      <p class="empty-state__description">${description}</p>
      ${credentialsBlock} ${actionBlock}
    </section>`;
}
