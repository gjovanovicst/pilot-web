/**
 * The single source of truth for the Pilot Web demo account.
 *
 * The sign-in empty state (T-1), the "use demo credentials" action and any
 * documentation must read these values from here so they cannot drift apart.
 *
 * ASSUMPTION: no demo account was defined anywhere in the repository
 * (README.md and docs/tasks.md only), so the values below are the agreed
 * pilot demo account. Change them here and every surface follows.
 */

export type DemoCredentials = {
  readonly email: string;
  readonly password: string;
};

export const DEMO_CREDENTIALS: DemoCredentials = Object.freeze({
  email: 'demo@pilot.example',
  password: 'pilot-demo',
});

/** Short copy reused wherever the demo account has to be named in a sentence. */
export const DEMO_CREDENTIALS_HINT: string =
  `Use the demo account ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`;
