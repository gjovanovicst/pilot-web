# pilot-web

Pilot stack: a pilot-web app. The weekly pilot tasks live in docs/tasks.md.

## Sign in with an empty state (T-1)

The sign-in page starts empty; instead of a blank surface it renders the
approved empty-state pattern naming the demo credentials, and every colour
comes from the design-system v1 tokens.

| File | Purpose |
| --- | --- |
| `src/styles/tokens.css` | The only file with raw values: design-system v1 tokens. |
| `src/styles/app.css` | Sign-in and empty-state styles, tokens only. |
| `src/constants/demoCredentials.ts` | Single source of truth for the demo account. |
| `src/components/EmptyState.ts` | The approved empty-state pattern (title, description, optional content). |
| `src/pages/SignIn.ts` | The sign-in page: empty state while the form is untouched. |
| `src/pages/SignIn.test.ts` | The acceptance tests for T-1. |

## Running the tests

```sh
pnpm test      # or: npm test
```

The suite runs on Node's built-in test runner (`node --test`), so it needs no
third-party packages.

## Notes for the next implementer

- The demo credentials live in `src/constants/demoCredentials.ts`. They are the
  seeded demo account for the pilot; if the real values differ, change them in
  that one file and every surface follows.
- The repository had no app scaffold and no package registry access, so the
  components are dependency-free markup functions rather than React/JSX ones,
  and the tests are plain Node tests. When the real pilot-web app (with its
  approved component library) is wired up, `EmptyState` and `SignIn` should be
  ported to it without changing the rendered structure or the tokens used.
- `SidePanel`, `ConfirmDialog` and `PromptDialog` are not in this repository, so
  they were not re-implemented. The sign-in page is a route-level surface, not a
  form opened from a list, so the drawer pattern does not apply to it.
