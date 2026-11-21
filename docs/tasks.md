# pilot-web — the weekly tasks

The three ready tasks the pilot picks from each week.

## T-1 — Sign in with an empty state

The sign-in page shows an empty state when the form is untouched.

- Given the sign-in page, when it loads, then the empty state explains the
  demo credentials.

## T-2 — Handle a failed request

A failed API call shows a retryable error, not a blank screen.

- Given a network failure, when the page fetches, then it renders the error
  with a Retry button.

## T-3 — Add the accessible focus ring

Every interactive element shows a visible focus ring.

- Given a keyboard user, when they tab through the page, then each control has
  a visible focus ring.
