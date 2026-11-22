import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { SignIn, SIGN_IN_EMPTY_STATE_ID, SIGN_IN_EMPTY_STATE_TITLE } from './SignIn.ts';
import { DEFAULT_EMPTY_STATE_ID, EmptyState } from '../components/EmptyState.ts';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';
import {
  accessibleDescription,
  accessibleName,
  attr,
  byId,
  controlsLabelled,
  definitionPairs,
  elementsOf,
  isElement,
  landmarks,
  pageText,
  parsePage,
  type PageElement,
} from '../../test/support/page.ts';

/* ------------------------------------------------------------------ *
 * T-1 — sign in with an empty state: the behaviour under review
 *
 * The required behaviour has two halves, and both are asserted here:
 *   1. an untouched form renders an empty state that *names* the demo
 *      email and the demo password (each value bound to its own term);
 *   2. the empty state is suppressed as soon as either credential is
 *      supplied, so it never hides a form the user is filling in.
 *
 * Review fix: the tests used to hand-roll an HTML parser over fixed markup
 * shapes — matching the exact `<section class="empty-state">`, the
 * `>Email</dt> <dd…` pair and each `<input … value="…">` by its internal id — so
 * adding a class, an attribute or a wrapper broke the suite although the page
 * behaved the same. Each page is now parsed once and read through its
 * semantics: the named landmark the empty state exposes, the control a label
 * names, and the value a definition list pairs with its term. None of those
 * depend on class names, ids or element order, so the assertions below fail
 * only when the behaviour changes.
 *
 * Review fix: the empty state used to be located as "the first region on the
 * page". A second named `<section>` would then have been read instead of the
 * empty state while every assertion still passed, so the lookup is anchored on
 * the id the page gives its own empty state and checked against the title.
 * ------------------------------------------------------------------ */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

/** Normalised text of a subtree, so indentation never affects a comparison. */
function textOf(node: PageElement): string {
  return pageText(node).replace(/\s+/g, ' ').trim();
}

/**
 * The sign-in empty state, located by the id the page gives it — never by
 * document order — and checked to be the landmark its title names.
 */
function emptyStateOf(markup: string): PageElement | null {
  const page = parsePage(markup);
  const anchor = byId(page, SIGN_IN_EMPTY_STATE_ID);
  if (!anchor) {
    return null;
  }
  assert.ok(
    landmarks(page).includes(anchor),
    'the empty state is the named landmark its title gives it',
  );
  assert.equal(
    accessibleName(page, anchor),
    SIGN_IN_EMPTY_STATE_TITLE,
    'the anchored element is the sign-in empty state, not another section',
  );
  return anchor;
}

/**
 * The value the empty state shows for a term, e.g. the email shown next to
 * "Email". Returns undefined when the pair is missing, so a credential that
 * floats somewhere else in the page does not count as "named".
 */
function credentialValue(emptyState: PageElement, term: string): string | undefined {
  return definitionPairs(emptyState).find(
    (entry) => entry.term.toLowerCase() === term.toLowerCase(),
  )?.value;
}

/** The control the page labels with `label`, e.g. the field named "Email". */
function inputLabelled(markup: string, label: string): PageElement {
  const matches = controlsLabelled(parsePage(markup), label);
  assert.equal(matches.length, 1, `the page renders exactly one "${label}" field`);
  return matches[0];
}

/** The value a rendered control carries; undefined when it carries none. */
function inputValue(markup: string, label: string): string | undefined {
  return attr(inputLabelled(markup, label), 'value');
}

/**
 * AC1, first half: on load — no state, no touched flag, no values — the page
 * renders the empty state and it names both demo credentials, each value paired
 * with the term that identifies it.
 */
function TestSignInEmptyStateNamesTheDemoCredentials() {
  const markup = SignIn(); // the page exactly as it renders on load
  const tree = parsePage(markup);
  const emptyState = emptyStateOf(markup);

  assert.ok(emptyState, 'an untouched form renders the empty state instead of a blank surface');
  assert.ok(accessibleDescription(tree, emptyState).length > 0, 'the empty state explains why it is empty');

  // The credentials come from the single source of truth, and they are real
  // values a user can type — not a placeholder.
  assert.match(DEMO_CREDENTIALS.email, /^[^\s@]+@[^\s@]+$/, 'the demo email is an email address');
  assert.ok(DEMO_CREDENTIALS.password.length >= 8, 'the demo password is a usable password');

  // Named: the demo email sits next to "Email", the demo password next to
  // "Password". A credential rendered without its term would fail here.
  assert.equal(
    credentialValue(emptyState, 'Email'),
    DEMO_CREDENTIALS.email,
    `the empty state names the demo email (${DEMO_CREDENTIALS.email})`,
  );
  assert.equal(
    credentialValue(emptyState, 'Password'),
    DEMO_CREDENTIALS.password,
    'the empty state names the demo password',
  );

  // Not merely present: each field is described by the hint, so a screen reader
  // user hears the demo credentials when they focus the field.
  const described = accessibleDescription(tree, inputLabelled(markup, 'Email'));
  assert.ok(
    described.includes(DEMO_CREDENTIALS.email),
    'the email field is described by the demo email',
  );
  assert.ok(
    described.includes(DEMO_CREDENTIALS.password),
    'the demo password reaches the field description too',
  );

  // The empty state is the only thing that names the account: the form itself
  // still starts blank, so the page never pretends the user typed anything.
  assert.ok(!inputValue(markup, 'Email'), 'the email input starts blank');
  assert.ok(!inputValue(markup, 'Password'), 'the password input starts blank');
}

/**
 * AC1, second half: as soon as the user supplies a value — either credential,
 * or the touched flag — the empty state is gone, and what they typed survives.
 */
function TestSignInEmptyStateIsSuppressedOnceCredentialsAreSupplied() {
  const cases: Array<[string, Parameters<typeof SignIn>[0]]> = [
    ['the email was typed', { values: { email: DEMO_CREDENTIALS.email } }],
    ['the password was typed', { values: { password: DEMO_CREDENTIALS.password } }],
    [
      'both credentials were typed',
      { values: { email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password } },
    ],
    ['the form was touched', { touched: true }],
  ];

  for (const [why, state] of cases) {
    assert.equal(
      emptyStateOf(SignIn(state)),
      null,
      `the empty state is suppressed once ${why}`,
    );
  }

  // Suppression must not be achieved by throwing the form (or its values) away.
  const filled = SignIn({
    values: { email: 'someone@example.com', password: 'hunter2hunter2' },
  });
  assert.equal(inputValue(filled, 'Email'), 'someone@example.com');
  assert.equal(inputValue(filled, 'Password'), 'hunter2hunter2');
  assert.ok(!filled.includes(DEMO_CREDENTIALS.password), 'typed values replace the demo hint');

  // Once the hint is gone, nothing still describes the fields with it.
  const filledTree = parsePage(filled);
  assert.equal(
    accessibleDescription(filledTree, inputLabelled(filled, 'Email')),
    '',
    'the suppressed hint leaves no dangling description behind',
  );
}

/** Blank and whitespace-only values are not in use: the empty state stays. */
function TestSignInKeepsTheEmptyStateWhileTheFormIsBlank() {
  const withoutValues = emptyStateOf(SignIn({ values: {} }));
  const onLoad = emptyStateOf(SignIn());
  assert.ok(onLoad && withoutValues);
  assert.equal(textOf(withoutValues), textOf(onLoad), 'no values renders the same empty state');
  assert.ok(
    emptyStateOf(SignIn({ values: { email: ' ', password: '\t' } })) !== null,
    'whitespace-only values keep the empty state',
  );
}

/**
 * The empty state is a component, not a one-off: whatever it is given is
 * escaped, and it degrades cleanly when it has no extra content.
 */
function TestEmptyStateRendersAndEscapesItsContent() {
  const markup = EmptyState({
    title: 'Nothing here yet',
    description: 'Add the first item.',
  });
  const tree = parsePage(markup);
  const emptyState = byId(tree, DEFAULT_EMPTY_STATE_ID);

  assert.ok(emptyState, 'the component renders an empty state on its own');
  assert.ok(landmarks(tree).includes(emptyState), 'the empty state is a named landmark');
  assert.equal(
    tree.children.filter((child) => isElement(child)).length,
    1,
    'the empty state is the whole render, not a fragment of one',
  );
  assert.equal(
    accessibleName(tree, emptyState),
    'Nothing here yet',
    'the title names the empty state',
  );
  assert.equal(
    accessibleDescription(tree, emptyState),
    'Add the first item.',
    'the description explains the empty state',
  );
  assert.equal(
    textOf(emptyState),
    'Nothing here yet Add the first item.',
    'nothing else is rendered when there is no extra content',
  );

  const escaped = EmptyState({
    title: '<script>alert(1)</script>',
    description: 'a & b',
  });
  assert.ok(!escaped.includes('<script>'), 'the title is escaped');
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /a &amp; b/, 'the description is escaped');

  const escapedTree = parsePage(escaped);
  const escapedState = byId(escapedTree, DEFAULT_EMPTY_STATE_ID);
  assert.ok(escapedState);
  assert.deepEqual(
    elementsOf(escapedTree, 'script'),
    [],
    'the hostile title adds no element to the parsed page',
  );
  assert.equal(
    accessibleName(escapedTree, escapedState),
    '<script>alert(1)</script>',
    'the title reads back as the text that was given',
  );
  assert.equal(
    accessibleDescription(escapedTree, escapedState),
    'a & b',
    'the description reads back as the text that was given',
  );
}

/**
 * The demo credentials live in exactly one module, so the empty state cannot
 * drift from the docs or from any future fixture.
 */
function TestDemoCredentialsAreDeclaredOnce() {
  const literal = `'${DEMO_CREDENTIALS.email}'`;
  assert.ok(
    readSource('src/constants/demoCredentials.ts').includes(literal),
    'src/constants/demoCredentials.ts declares the demo email',
  );
  for (const path of ['src/pages/SignIn.ts', 'src/components/EmptyState.ts']) {
    assert.ok(
      !readSource(path).includes(literal),
      `${path} imports the demo credentials instead of hard-coding them`,
    );
  }
}

test('TestSignInEmptyStateNamesTheDemoCredentials', TestSignInEmptyStateNamesTheDemoCredentials);
test(
  'TestSignInEmptyStateIsSuppressedOnceCredentialsAreSupplied',
  TestSignInEmptyStateIsSuppressedOnceCredentialsAreSupplied,
);
test(
  'TestSignInKeepsTheEmptyStateWhileTheFormIsBlank',
  TestSignInKeepsTheEmptyStateWhileTheFormIsBlank,
);
test('TestEmptyStateRendersAndEscapesItsContent', TestEmptyStateRendersAndEscapesItsContent);
test('TestDemoCredentialsAreDeclaredOnce', TestDemoCredentialsAreDeclaredOnce);
