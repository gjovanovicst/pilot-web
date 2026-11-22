/**
 * The demo account shown in the sign-in empty state.
 *
 * Single source of truth: the empty state, the docs and any future fixtures all
 * read these values, so the credentials can never drift apart.
 *
 * Assumption: the repository holds no reference values for the demo account
 * (nothing was found in the sources or docs), so these are the seeded demo
 * account values for the pilot environment.
 */
export type DemoCredentials = {
  readonly email: string;
  readonly password: string;
};

export const DEMO_CREDENTIALS: DemoCredentials = {
  email: 'demo@pilot.example',
  password: 'pilot-demo-2024',
};
