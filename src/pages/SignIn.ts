import { EmptyState } from '../components/EmptyState.ts';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';
import { escapeHtml } from '../lib/html.ts';

export const SIGN_IN_EMPTY_STATE_TITLE = 'Sign in with the demo account';
export const SIGN_IN_EMPTY_STATE_DESCRIPTION =
  'The form starts empty. Use the demo credentials below to explore the pilot.';

/** Id base of the empty state's title and description. */
export const SIGN_IN_EMPTY_STATE_ID = 'sign-in-empty-state';

/**
 * Id of the demo-credentials hint. While it renders, both fields are described
 * by it, so the credentials reach a screen-reader user instead of only sighted
 * ones.
 */
export const DEMO_CREDENTIALS_HINT_ID = 'sign-in-demo-credentials';

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

/* ------------------------------------------------------------------ *
 * markup helpers
 *
 * Elements are built from whole lines: an open tag, then one attribute per
 * line, then the closing `>`. A wide element — the email and password inputs
 * carry eight attributes each — therefore never becomes a 200-character ribbon
 * that scrolls sideways in a diff viewer, while an interpolated value still
 * stays inline with the attribute it belongs to, `value="${escapeHtml(...)}"`,
 * so the escaping and any attribute breakout are read exactly where they
 * happen instead of being reassembled from `+` pieces.
 * ------------------------------------------------------------------ */

/** Indents each line by `depth` two-space steps; blank lines stay blank. */
function indent(lines: string[], depth = 1): string[] {
  const padding = '  '.repeat(depth);
  return lines.map((line) => (line === '' ? '' : padding + line));
}

/** An open tag whose attributes are wrapped one per line, closing on `>`. */
function openTag(tag: string, attributes: string[]): string[] {
  return [`<${tag}`, ...indent(attributes), '>'];
}

type FieldOptions = {
  id: string;
  label: string;
  name: string;
  type: 'email' | 'password';
  autocomplete: string;
  /** The raw value: escaped in place on the `value` attribute line. */
  value: string;
  /** Id of the hint that describes the field, when the hint is on the page. */
  describedBy?: string;
};

/** A label with its input; the input's attributes wrap one per line. */
function renderField({
  id,
  label,
  name,
  type,
  autocomplete,
  value,
  describedBy,
}: FieldOptions): string[] {
  const attributes = [
    'class="field__input"',
    `id="${id}"`,
    `name="${name}"`,
    `type="${type}"`,
    `autocomplete="${autocomplete}"`,
  ];
  if (describedBy) {
    attributes.push(`aria-describedby="${describedBy}"`);
  }
  attributes.push('required', `value="${escapeHtml(value)}"`);

  return [
    '<div class="field">',
    ...indent([
      `<label class="field__label" for="${id}">${label}</label>`,
      ...openTag('input', attributes),
    ]),
    '</div>',
  ];
}

/** The sign-in form: one labelled field per credential, then the action. */
function renderForm(values: Partial<SignInValues>, describedBy?: string): string[] {
  return [
    ...openTag('form', [
      'class="sign-in__form"',
      'id="sign-in-form"',
      'method="post"',
      'action="/sign-in"',
      'novalidate',
    ]),
    ...indent(
      renderField({
        id: 'sign-in-email',
        label: 'Email',
        name: 'email',
        type: 'email',
        autocomplete: 'username',
        value: values.email ?? '',
        describedBy,
      }),
    ),
    ...indent(
      renderField({
        id: 'sign-in-password',
        label: 'Password',
        name: 'password',
        type: 'password',
        autocomplete: 'current-password',
        value: values.password ?? '',
        describedBy,
      }),
    ),
    '  <button class="button button--primary" type="submit">Sign in</button>',
    '</form>',
  ];
}

/**
 * The credential list is compact: every element is short enough to sit on one
 * source line, with the escaped value interpolated in place. The `dt`/`dd`
 * pairs are what names each credential: a value on its own would not tell the
 * user which credential it is.
 */
function renderDemoCredentials(): string {
  return [
    `<dl class="credentials" id="${DEMO_CREDENTIALS_HINT_ID}">`,
    '  <dt class="credentials__term">Email</dt>',
    `  <dd class="credentials__value">${escapeHtml(DEMO_CREDENTIALS.email)}</dd>`,
    '  <dt class="credentials__term">Password</dt>',
    `  <dd class="credentials__value">${escapeHtml(DEMO_CREDENTIALS.password)}</dd>`,
    '</dl>',
  ].join('\n');
}

/**
 * The sign-in page. On load the form is untouched, so the empty state names the
 * demo credentials; the user always knows which account to use.
 */
export function SignIn(state: SignInState = {}): string {
  const values = state.values ?? {};
  const showsHint = isUntouched(state);

  const lines: string[] = [
    '<div class="page">',
    '  <main class="sign-in">',
    '    <h1 class="sign-in__heading">Sign in</h1>',
  ];

  if (showsHint) {
    const emptyState = EmptyState({
      id: SIGN_IN_EMPTY_STATE_ID,
      title: SIGN_IN_EMPTY_STATE_TITLE,
      description: SIGN_IN_EMPTY_STATE_DESCRIPTION,
      children: renderDemoCredentials(),
    });
    lines.push(...indent(emptyState.split('\n'), 2));
  }

  if (state.error) {
    const message = escapeHtml(state.error);
    lines.push(`    <p class="sign-in__error" role="alert">${message}</p>`);
  }

  lines.push(...indent(renderForm(values, showsHint ? DEMO_CREDENTIALS_HINT_ID : undefined), 2));
  lines.push('  </main>');
  lines.push('</div>');

  return lines.join('\n');
}
