import { DEMO_ACCOUNT } from '../config/demoAccount.ts';
import type { DemoAccount } from '../config/demoAccount.ts';

/**
 * The sign-in page.
 *
 * Rendering is a pure function of data so that "what the user sees on load"
 * can be asserted without a browser or a DOM implementation. `src/main.ts`
 * mounts the returned markup and wires the interactive behaviour.
 *
 * Every colour, radius, spacing and font value lives in the stylesheet and
 * comes from `src/styles/tokens.css`; nothing here emits a raw value.
 */

export const PAGE_ID = 'sign-in';
export const EMPTY_STATE_ID = 'sign-in-demo';
export const EMPTY_STATE_TITLE_ID = 'sign-in-demo-title';
export const EMPTY_STATE_DESCRIPTION_ID = 'sign-in-demo-description';
export const DEMO_EMAIL_ID = 'sign-in-demo-email';
export const DEMO_PASSWORD_ID = 'sign-in-demo-password';
export const EMAIL_INPUT_ID = 'sign-in-email';
export const PASSWORD_INPUT_ID = 'sign-in-password';

export const EMPTY_STATE_TITLE = 'Sign in with the demo account';
export const EMPTY_STATE_DESCRIPTION =
  'This pilot workspace starts empty. Use the demo credentials below to sign in.';
export const DEMO_EMAIL_LABEL = 'Demo email';
export const DEMO_PASSWORD_LABEL = 'Demo password';

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character: string) => HTML_ESCAPES[character] ?? character);
}

function renderCredentialRow(id: string, label: string, value: string): string {
  return [
    '        <div class="sign-in__credential">',
    `          <dt class="sign-in__credential-label">${escapeHtml(label)}</dt>`,
    `          <dd class="sign-in__credential-value"><code id="${id}">${escapeHtml(value)}</code></dd>`,
    '        </div>',
  ].join('\n');
}

/**
 * The empty state: shown on load and for as long as the form is untouched.
 * It names the demo credentials so a first-time user knows which account to
 * use instead of facing an empty form.
 */
export function renderEmptyState(account: DemoAccount = DEMO_ACCOUNT): string {
  return [
    `      <section class="sign-in__empty" id="${EMPTY_STATE_ID}" role="status" aria-labelledby="${EMPTY_STATE_TITLE_ID}" aria-describedby="${EMPTY_STATE_DESCRIPTION_ID}">`,
    `        <h2 class="sign-in__empty-title" id="${EMPTY_STATE_TITLE_ID}">${escapeHtml(EMPTY_STATE_TITLE)}</h2>`,
    `        <p class="sign-in__empty-text" id="${EMPTY_STATE_DESCRIPTION_ID}">${escapeHtml(EMPTY_STATE_DESCRIPTION)}</p>`,
    '        <dl class="sign-in__credentials">',
    renderCredentialRow(DEMO_EMAIL_ID, DEMO_EMAIL_LABEL, account.email),
    renderCredentialRow(DEMO_PASSWORD_ID, DEMO_PASSWORD_LABEL, account.password),
    '        </dl>',
    '      </section>',
  ].join('\n');
}

export function renderSignInForm(): string {
  return [
    '      <form class="sign-in__form" novalidate>',
    '        <div class="sign-in__field">',
    `          <label class="sign-in__label" for="${EMAIL_INPUT_ID}">Email</label>`,
    `          <input class="sign-in__input" id="${EMAIL_INPUT_ID}" name="email" type="email" autocomplete="username" />`,
    '        </div>',
    '        <div class="sign-in__field">',
    `          <label class="sign-in__label" for="${PASSWORD_INPUT_ID}">Password</label>`,
    `          <input class="sign-in__input" id="${PASSWORD_INPUT_ID}" name="password" type="password" autocomplete="current-password" />`,
    '        </div>',
    '        <button class="sign-in__submit" type="submit">Sign in</button>',
    '      </form>',
  ].join('\n');
}

export interface SignInPageOptions {
  /** Defaults to the shared demo account from `src/config/demoAccount.ts`. */
  readonly account?: DemoAccount;
}

/** The complete sign-in page, exactly as it appears on load. */
export function renderSignInPage(options: SignInPageOptions = {}): string {
  const account = options.account ?? DEMO_ACCOUNT;
  return [
    `<div class="sign-in" id="${PAGE_ID}">`,
    '    <main class="sign-in__card" aria-labelledby="sign-in-title">',
    '      <header class="sign-in__header">',
    '        <h1 class="sign-in__title" id="sign-in-title">Sign in</h1>',
    '        <p class="sign-in__subtitle">Sign in to the pilot workspace.</p>',
    '      </header>',
    renderEmptyState(account),
    renderSignInForm(),
    '    </main>',
    '</div>',
  ].join('\n');
}
