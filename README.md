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
| `src/components/EmptyState.ts` | The approved empty-state pattern (title, description, optional content), exposed as a named region. |
| `src/pages/SignIn.ts` | The sign-in page: empty state while the form is untouched. |
| `src/lib/dom.ts` | Dependency-free HTML parser plus the accessibility queries the tests read the page with. |
| `src/lib/dom.test.ts` | Proves the queries survive decorated, wrapped and reflowed markup. |
| `src/pages/SignIn.test.ts` | Tokens, layout, accessibility and escaping tests for the surface. |
| `src/pages/SignIn.empty-state.test.ts` | The behaviour under review: the empty state names both demo credentials on load, and is suppressed as soon as a credential is supplied. |
| `src/pages/SignIn.rendering.test.ts` | Rendering integrity: unique ids and resolvable `aria-labelledby` / `aria-describedby` references in every state. |
| `.prettierrc.json` | Markup formatting: 100-column lines, one attribute per line. |

## Running the tests

```sh
pnpm test      # or: npm test
```

The suite runs on Node's built-in test runner (`node --test`), so it needs no
third-party packages. `npm test` globs `src/**/*.test.ts`, so a new test file
next to the page is picked up without touching `package.json`.

## Reading the page in a test

The page and the empty state are plain markup functions, so a test has to read
the rendered markup back. `src/lib/dom.ts` parses it into a tree once and answers
the questions the tests actually ask:

- `queryByRole(tree, 'region')` — the empty state. It is a `<section>` named by
  its title (`aria-labelledby`), which is a region landmark to assistive
  technology; no class name or position in the page is involved.
- `getAllByLabelText(tree, 'Email')` — the control the page labels "Email",
  resolved through `label[for]` (or a wrapping label), never through an internal
  input id.
- `descriptionEntries(emptyState)` — the `dt`/`dd` pairs, so a credential counts
  as named only when its value is paired with its term. Pairing follows the
  definition-list semantics, not sibling position, so wrapping each pair in a
  group element changes nothing.
- `accessibleName` / `accessibleDescription` — what a screen reader announces,
  including the `aria-describedby` link from each field to the demo credentials.

A test that reads the page this way keeps passing when a class is renamed, an
attribute is added, the attributes are reflowed or a wrapper is introduced, and
still fails when the behaviour itself goes away. `src/lib/dom.test.ts` pins that
property.

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
  ported to it without changing the rendered structure, the accessibility wiring
  or the tokens used.
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
- The empty-state behaviour is asserted in `src/pages/SignIn.empty-state.test.ts`
  through the parsed page: the demo email is the value the empty state pairs with
  the `Email` term and the demo password the value it pairs with `Password`, so a
  credential that is merely present somewhere on the page does not count as
  named. The suppression cases cover email-only, password-only, both, and the
  touched flag.
- While the empty state renders, both fields carry
  `aria-describedby="sign-in-demo-credentials"`, so a screen-reader user hears
  the demo credentials on focus instead of only sighted users seeing them. The
  attribute is dropped together with the hint, so the page never points at an id
  that is not there — `src/pages/SignIn.rendering.test.ts` checks that.
- Markup stays readable in a diff: short elements sit on one source line, wide
  elements (the email and password inputs) wrap with one complete attribute per
  line via the `openTag`/`indent` helpers in `src/pages/SignIn.ts`, and an
  interpolated value stays inline with the attribute it belongs to —
  `value="${escapeHtml(...)}"` — never concatenated from `+` pieces. These are
  style conventions, enforced by Prettier (see above); the tests read the parsed
  page, so they stay green when a legitimate change adds a field or reflows the
  markup.
