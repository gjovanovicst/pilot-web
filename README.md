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
| `src/components/EmptyState.ts` | The approved empty-state pattern (title, description, optional content), exposed as a named region whose section carries the caller's id. |
| `src/pages/SignIn.ts` | The sign-in page: empty state while the form is untouched. |
| `src/pages/SignIn.test.ts` | Tokens, layout, accessibility and escaping tests for the surface. |
| `src/pages/SignIn.empty-state.test.ts` | The behaviour under review: the empty state names both demo credentials on load, and is suppressed as soon as a credential is supplied. |
| `src/pages/SignIn.rendering.test.ts` | Rendering integrity: unique ids and resolvable `aria-labelledby` / `aria-describedby` references in every state. |
| `test/support/page.ts` | Test-only reader for rendered markup (see below), not part of the app. |
| `test/support/page.test.ts` | Pins the reader's own behaviour: parsing edge cases and the queries the page tests rely on. |
| `.prettierrc.json` | Markup formatting: 100-column lines, one attribute per line. |

## Running the tests

```sh
pnpm test      # or: npm test
```

The suite runs on Node's built-in test runner (`node --test`), so it needs no
third-party packages. `npm test` globs `src/**/*.test.ts` and
`test/**/*.test.ts`, so a new page test next to the page — or a new test for the
support module — is picked up without touching `package.json`.

## Reading the page in a test

The page and the empty state are plain markup functions, so a test has to read
the rendered markup back. The supported way to do that is jsdom plus
`@testing-library/dom` (`getByRole`, `getByLabelText`, …). Neither can be
installed here: this sandbox has no package registry access, and `npm install`
fails with `EAI_AGAIN`.

`test/support/page.ts` is the deliberately small stopgap that stands in for those
two packages. It lives under `test/`, no source file under `src/` may import it,
and it is not part of the shipped app. It parses the markup into a tree
(`parsePage`) and answers only the questions the page tests ask:

- `landmarks(page)` — the landmarks the page exposes. `section` and `form` only
  count once they carry a name (`aria-labelledby` / `aria-label`), which is the
  rule the empty state relies on; an unnamed section is not a landmark.
- `accessibleName` / `accessibleDescription` — what a screen reader announces,
  including the `aria-describedby` link from each field to the demo credentials.
- `controlsLabelled(page, 'Email')` — the control a label names, resolved
  through `label[for]` (or a wrapping label), never through an internal input id.
- `definitionPairs(page)` — the `dt`/`dd` pairs, so a credential counts as named
  only when its value is paired with its term. Pairing is scoped to the `dl`
  that owns the `dt`: two adjacent or nested lists never pair across each other,
  while wrapping a pair in a group element changes nothing.

A test that reads the page this way keeps passing when a class is renamed, an
attribute is added, the attributes reflowed or a wrapper introduced, and still
fails when the behaviour itself goes away.

Because a hand-maintained parser and a partial role map drift from the
specifications, this module must not grow into a general DOM/ARIA
implementation: when dependencies can be installed, delete `test/support/page.ts`
and its test, and rewrite the page tests against `@testing-library/dom`. The
coverage it has today is pinned in `test/support/page.test.ts` — decorated and
wrapped markup, void elements, comments and doctypes, bare and unquoted
attributes, wrapping labels, the landmark and heading queries, definition lists
scoped per `dl`, and out-of-range character references (`&#x110000;`, surrogate
halves) that must never throw.

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
  that one file and every surface follows. Test fixtures build their credentials
  from that constant instead of repeating the literals.
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
- The empty state is located by the id the page gives it
  (`SIGN_IN_EMPTY_STATE_ID`, rendered on the `<section>`), never by document
  order, so a second named section on the surface cannot make a test assert
  against the wrong element. The lookup also checks that the anchored section is
  the landmark its title names.
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
