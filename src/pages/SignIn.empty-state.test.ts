import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { SignIn } from './SignIn.ts';
import { EmptyState } from '../components/EmptyState.ts';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';

/* ------------------------------------------------------------------ *
 * T-1 — sign in with an empty state: the behaviour under review
 *
 * The required behaviour has two halves, and both are asserted here:
 *   1. an untouched form renders an empty state that *names* the demo
 *      email and the demo password (each value bound to its own label);
 *   2. the empty state is suppressed as soon as either credential is
 *      supplied, so it never hides a form the user is filling in.
 *
 * The tests read the rendered markup only — never the source layout — so a
 * reformatted or extended page keeps them green.
 * ------------------------------------------------------------------ */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

/** The rendered `<section class="empty-state">…</section>`, or null. */
function emptyStateMarkup(html: string): string | null {
  const start = html.indexOf('<section class="empty-state">');
  if (start === -1) {
    return null;
  }
  const end = html.indexOf('</section>', start);
  return end === -1 ? null : html.slice(start, end + '</section>'.length);
}

/**
 * The value a rendered definition list pairs with a term, e.g. the email shown
 * next to "Email". Returns undefined when the pair is missing, so a credential
 * that floats somewhere else in the markup does not count as "named".
 */
function credentialValue(markup: string, term: string): string | undefined {
  const pattern = new RegExp(
    `>${term}<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
    'i',
  );
  return markup.match(pattern)?.[1]?.trim();
}

/** Every `value="…"` a rendered input carries, by input id. */
function inputValue(html: string, id: string): string | undefined {
  const input = [...html.matchAll(/<input\b([^>]*)>/g)]
    .map((match) => match[1])
    .filter((attributes) => new RegExp(`\\bid="${id}"`).test(attributes));
  assert.equal(input.length, 1, `the page renders exactly one "${id}" input`);
  return input[0].match(/\bvalue="([^"]*)"/)?.[1];
}

/**
 * AC1, first half: on load — no state, no touched flag, no values — the page
 * renders the empty state and it names both demo credentials, each value
 * paired with the label that identifies it.
 */
function TestSignInEmptyStateNamesTheDemoCredentials() {
  const html = SignIn(); // the page exactly as it renders on load
  const emptyState = emptyStateMarkup(html);

  assert.ok(emptyState, 'an untouched form renders the empty state instead of a blank surface');
  assert.match(emptyState, /class="empty-state__title"/, 'the empty state has a title');
  assert.match(
    emptyState,
    /class="empty-state__description"/,
    'the empty state explains why it is empty',
  );

  // The credentials come from the single source of truth, and they are real
  // values a user can type — not a placeholder.
  assert.match(DEMO_CREDENTIALS.email, /^[^\s@]+@[^\s@]+$/, 'the demo email is an email address');
  assert.ok(DEMO_CREDENTIALS.password.length >= 8, 'the demo password is a usable password');

  // Named: the demo email sits next to "Email", the demo password next to
  // "Password". A credential rendered without its label would fail here.
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

  // The empty state is the only thing that names the account: the form itself
  // still starts blank, so the page never pretends the user typed anything.
  assert.ok(!inputValue(html, 'sign-in-email'), 'the email input starts blank');
  assert.ok(!inputValue(html, 'sign-in-password'), 'the password input starts blank');
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
      emptyStateMarkup(SignIn(state)),
      null,
      `the empty state is suppressed once ${why}`,
    );
  }

  // Suppression must not be achieved by throwing the form (or its values) away.
  const filled = SignIn({
    values: { email: 'someone@example.com', password: 'hunter2hunter2' },
  });
  assert.equal(inputValue(filled, 'sign-in-email'), 'someone@example.com');
  assert.equal(inputValue(filled, 'sign-in-password'), 'hunter2hunter2');
  assert.ok(!filled.includes(DEMO_CREDENTIALS.password), 'typed values replace the demo hint');
}

/** Blank and whitespace-only values are not in use: the empty state stays. */
function TestSignInKeepsTheEmptyStateWhileTheFormIsBlank() {
  assert.equal(
    emptyStateMarkup(SignIn({ values: {} })),
    emptyStateMarkup(SignIn()),
    'no values renders the same empty state as the load state',
  );
  assert.ok(
    emptyStateMarkup(SignIn({ values: { email: ' ', password: '\t' } })) !== null,
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
  assert.match(markup, /^<section class="empty-state">/);
  assert.match(markup, /<h2 class="empty-state__title">Nothing here yet<\/h2>/);
  assert.match(markup, /<p class="empty-state__description">Add the first item\.<\/p>/);
  assert.ok(!markup.includes('empty-state__extra'), 'no extra block without children');

  const escaped = EmptyState({
    title: '<script>alert(1)</script>',
    description: 'a & b',
  });
  assert.ok(!escaped.includes('<script>'), 'the title is escaped');
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /a &amp; b/, 'the description is escaped');
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
