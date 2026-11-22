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
| `.prettierrc.json` | Markup formatting: 100-column lines, one attribute per line. |

## Running the tests

```sh
pnpm test      # or: npm test
```

The suite runs on Node's built-in test runner (`node --test`), so it needs no
third-party packages.

## Formatting

`.prettierrc.json` pins the markup conventions: `printWidth: 100` stops a source
line from becoming a ribbon that scrolls sideways in a diff viewer, and
`singleAttributePerLine` keeps a wide element's attributes one per line. Those
are formatting rules, so they live in the formatter and not in the test suite —
a third field, a hidden CSRF input or a long but valid line must never fail a
behavioural test.

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
- Vertical rhythm: design system v1 pins a single spacing step (`--space-4`), so
  `app.css` uses two levels instead of one flat gap — `0` inside a group (a
  heading and its description, a label and its input, a term and its value) and
  `var(--space-4)` between groups. Adding a second spacing token is out of scope
  for the pinned token set, so keep new surfaces on the same two levels.
- The page shell sizes itself with `min-height: 100dvh` (preceded by a `100vh`
  fallback) so mobile browser chrome cannot make it overflow. The focus ring is
  declared only for the controls the surface actually renders — the sign-in page
  has no links, so an `a:focus-visible` rule would be dead CSS.
- Markup stays readable in a diff: short elements sit on one source line, wide
  elements (the email and password inputs) wrap with one complete attribute per
  line via the `openTag`/`indent` helpers in `src/pages/SignIn.ts`, and an
  interpolated value stays inline with the attribute it belongs to —
  `value="${escapeHtml(...)}"` — never concatenated from `+` pieces. These are
  style conventions, enforced by Prettier (see above); the tests assert the
  rendered structure and the escaping, so they stay green when a legitimate
  change adds a field or reflows the markup.
