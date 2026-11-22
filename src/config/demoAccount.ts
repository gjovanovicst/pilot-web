/**
 * Single source of truth for the demo account shown on the sign-in page.
 *
 * The sign-in empty state renders exactly what this module exports, so the
 * values shown to the user can never drift away from the app seed.
 *
 * OWNER ACTION: these values are the pilot environment's demo seed. Confirm
 * them against the real seed of the deployed environment; if they differ,
 * change them here only — no page or test holds a second copy.
 */
export interface DemoAccount {
  readonly email: string;
  readonly password: string;
}

export const DEMO_ACCOUNT: DemoAccount = Object.freeze({
  email: 'demo@pilot.example',
  password: 'pilot-demo-1234',
});
