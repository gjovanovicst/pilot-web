# pilot-web
Pilot stack: a pilot-web app. The weekly pilot tasks live in docs/tasks.md.

## Running the tests

```sh
npm test          # node --test (Node >= 22.18, TypeScript via built-in type stripping)
```

The suite covers the weekly tasks, including T-1: on load the sign-in page shows
an empty state that names the demo credentials.

## Layout

| Path | Purpose |
| --- | --- |
| `src/styles/tokens.css` | Design system v1 tokens — the only file allowed to hold raw colour/length values |
| `src/styles/app.css` | Sign-in and empty-state styles, tokens only (`var(--…)`) |
| `src/constants/demoCredentials.ts` | Single source of truth for the demo account |
| `src/components/EmptyState.ts` | Approved-pattern empty state (title, description, credentials, one action) |
| `src/pages/SignIn.ts` | Sign-in page: pure state machine + view |
| `src/pages/SignIn.test.ts` | T-1 acceptance tests |
| `src/ui/html.ts` | Escaping tagged-template helper used by the views |

## Notes

- The repo had no runnable app scaffold, and this environment has no network and
  no cached packages, so React/Vite/Vitest cannot be installed. Views are plain
  TypeScript functions returning escaped markup and the tests use Node's
  built-in runner. There is no component library here: only design tokens.
- There is no browser dev server; render a static page for a manual look with
  `npm run render:signin > signin.html`.
- The demo credentials (`demo@pilot.example` / `pilot-demo`) were not defined
  anywhere in the repo and are an agreed UI assumption — change them in
  `src/constants/demoCredentials.ts` and every surface follows.
