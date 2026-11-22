import { EmptyState } from '../components/EmptyState.ts';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';
import { escapeHtml } from '../lib/html.ts';

export const SIGN_IN_EMPTY_STATE_TITLE = 'Sign in with the demo account';
export const SIGN_IN_EMPTY_STATE_DESCRIPTION =
  'The form starts empty. Use the demo credentials below to explore the pilot.';

export type SignInValues = {
  email: string;
  password: string;
};

export type SignInState = {
  values?: Partial<SignInValues>;
  /** True once the user has interacted with the form. */
  touched?: boolean;
  error?: string | null;
};

/** The page shows the empty state while the form is untouched and still blank. */
export function isUntouched(state: SignInState = {}): boolean {
  if (state.touched === true) {
    return false;
  }
  const values = state.values ?? {};
  return (values.email ?? '').trim() === '' && (values.password ?? '').trim() === '';
}

function renderDemoCredentials(): string {
  return [
    '<dl class="credentials">',
    '  <dt class="credentials__term">Email</dt>',
    '  <dd class="credentials__value">' + escapeHtml(DEMO_CREDENTIALS.email) + '</dd>',
    '  <dt class="credentials__term">Password</dt>',
    '  <dd class="credentials__value">' + escapeHtml(DEMO_CREDENTIALS.password) + '</dd>',
    '</dl>',
  ].join('\n');
}

function indentBlock(block: string, padding: string): string[] {
  return block
    .split('\n')
    .map((line) => (line === '' ? '' : padding + line));
}

/**
 * The sign-in page. On load the form is untouched, so the empty state names the
 * demo credentials; the user always knows which account to use.
 */
export function SignIn(state: SignInState = {}): string {
  const values = state.values ?? {};
  const lines: string[] = [
    '<div class="page">',
    '  <main class="sign-in">',
    '    <h1 class="sign-in__heading">Sign in</h1>',
  ];

  if (isUntouched(state)) {
    const emptyState = EmptyState({
      title: SIGN_IN_EMPTY_STATE_TITLE,
      description: SIGN_IN_EMPTY_STATE_DESCRIPTION,
      children: renderDemoCredentials(),
    });
    lines.push(...indentBlock(emptyState, '    '));
  }

  if (state.error) {
    lines.push('    <p class="sign-in__error" role="alert">' + escapeHtml(state.error) + '</p>');
  }

  lines.push(
    '    <form class="sign-in__form" id="sign-in-form" method="post" action="/sign-in" novalidate>',
    '      <div class="field">',
    '        <label class="field__label" for="sign-in-email">Email</label>',
    '        <input class="field__input" id="sign-in-email" name="email" type="email" autocomplete="username" required value="' +
      escapeHtml(values.email ?? '') +
      '">',
    '      </div>',
    '      <div class="field">',
    '        <label class="field__label" for="sign-in-password">Password</label>',
    '        <input class="field__input" id="sign-in-password" name="password" type="password" autocomplete="current-password" required value="' +
      escapeHtml(values.password ?? '') +
      '">',
    '      </div>',
    '      <button class="button button--primary" type="submit">Sign in</button>',
    '    </form>',
    '  </main>',
    '</div>',
  );

  return lines.join('\n');
}
