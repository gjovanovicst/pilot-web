/**
 * Pilot Web — sign-in page (T-1: "sign in with an empty state").
 *
 * The page opens with the form untouched, so it renders the empty state that
 * names the demo credentials instead of a blank panel. The state machine below
 * is pure so the empty/ready states are unit-testable without a DOM; the
 * view is a plain function that composes the approved EmptyState pattern and
 * emits markup styled only by design system v1 tokens.
 */

import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';
import { EmptyState } from '../components/EmptyState.ts';
import type { Html } from '../ui/html.ts';
import { html } from '../ui/html.ts';

export type SignInField = 'email' | 'password';

export type SignInFormState = {
  readonly email: string;
  readonly password: string;
  /** False until the user interacts with the form — the empty state shows until then. */
  readonly touched: boolean;
};

export const initialSignInState: SignInFormState = Object.freeze({
  email: '',
  password: '',
  touched: false,
});

export type SignInAction =
  | { readonly type: 'field-changed'; readonly field: SignInField; readonly value: string }
  | { readonly type: 'demo-credentials-requested' }
  | { readonly type: 'reset' };

export function signInReducer(
  state: SignInFormState,
  action: SignInAction,
): SignInFormState {
  switch (action.type) {
    case 'field-changed':
      return action.field === 'email'
        ? { ...state, email: action.value, touched: true }
        : { ...state, password: action.value, touched: true };
    case 'demo-credentials-requested':
      return {
        ...state,
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
        touched: true,
      };
    case 'reset':
      return initialSignInState;
    default:
      return state;
  }
}

/** The empty state is the untouched state: never a blank screen. */
export function shouldShowEmptyState(state: SignInFormState): boolean {
  return state.touched === false;
}

export const EMPTY_STATE_HEADING_ID = 'signin-empty-state-title';

export function renderSignIn(state: SignInFormState = initialSignInState): Html {
  const emptyState = shouldShowEmptyState(state)
    ? EmptyState({
        id: EMPTY_STATE_HEADING_ID,
        title: 'No sign-in details yet',
        description:
          'The form below is empty. Sign in with the demo account to explore Pilot Web.',
        credentials: DEMO_CREDENTIALS,
        action: {
          label: 'Use demo credentials',
          action: 'fill-demo-credentials',
          ariaLabel: 'Fill the sign-in form with the demo credentials',
        },
      })
    : null;

  return html`<main class="signin">
    <div class="signin__panel">
      <h1 class="signin__title">Sign in</h1>
      <p class="signin__subtitle">Pilot Web</p>
      ${emptyState}
      <form class="signin__form" method="post" action="/sign-in" novalidate>
        <div class="signin__field">
          <label class="signin__label" for="signin-email">Email</label>
          <input
            class="signin__input"
            id="signin-email"
            name="email"
            type="email"
            inputmode="email"
            autocomplete="username"
            required
            value="${state.email}"
          />
        </div>
        <div class="signin__field">
          <label class="signin__label" for="signin-password">Password</label>
          <input
            class="signin__input"
            id="signin-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            value="${state.password}"
          />
        </div>
        <div class="signin__footer">
          <button class="button button--primary" type="submit">Sign in</button>
        </div>
      </form>
    </div>
  </main>`;
}
