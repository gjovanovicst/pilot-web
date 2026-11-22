import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DEMO_ACCOUNT } from '../config/demoAccount.ts';
import {
  DEMO_EMAIL_ID,
  DEMO_PASSWORD_ID,
  DEMO_EMAIL_LABEL,
  DEMO_PASSWORD_LABEL,
  EMAIL_INPUT_ID,
  EMPTY_STATE_ID,
  EMPTY_STATE_TITLE,
  PASSWORD_INPUT_ID,
  renderSignInPage,
} from './SignIn.ts';

const signInCss = readFileSync(new URL('./SignIn.css', import.meta.url), 'utf8');

/** The markup of the empty state alone, so assertions cannot pass by accident. */
function emptyStateMarkup(html: string): string {
  const statusIndex = html.indexOf('role="status"');
  assert.ok(statusIndex >= 0, 'the page renders the empty state with role="status"');

  const start = html.lastIndexOf('<section', statusIndex);
  const end = html.indexOf('</section>', statusIndex);
  assert.ok(start >= 0 && end > statusIndex, 'the empty state is a complete <section>');

  return html.slice(start, end + '</section>'.length);
}

test('signInPageShowsDemoCredentialsInTheEmptyState', () => {
  const html = renderSignInPage();
  const emptyState = emptyStateMarkup(html);

  // The empty state names the demo credentials...
  assert.ok(
    emptyState.includes(DEMO_ACCOUNT.email),
    `the empty state shows the demo email (${DEMO_ACCOUNT.email})`,
  );
  assert.ok(
    emptyState.includes(DEMO_ACCOUNT.password),
    `the empty state shows the demo password (${DEMO_ACCOUNT.password})`,
  );

  // ...with a heading that says which account they belong to...
  assert.ok(emptyState.includes(EMPTY_STATE_TITLE), 'the empty state has a heading');
  assert.match(emptyState, /demo/i, 'the empty state names the demo account');

  // ...each value labelled, inside a description list.
  assert.match(emptyState, /<dl class="sign-in__credentials">/);
  assert.match(
    emptyState,
    new RegExp(`<dt[^>]*>${DEMO_EMAIL_LABEL}</dt>\\s*<dd[^>]*>\\s*<code id="${DEMO_EMAIL_ID}">`),
    'the demo email is labelled and followed by its value',
  );
  assert.match(
    emptyState,
    new RegExp(`<dt[^>]*>${DEMO_PASSWORD_LABEL}</dt>\\s*<dd[^>]*>\\s*<code id="${DEMO_PASSWORD_ID}">`),
    'the demo password is labelled and followed by its value',
  );

  // The empty state is part of what loads: it is not hidden and it precedes the form.
  assert.ok(!/<section[^>]*\shidden/.test(emptyState), 'the empty state is visible on load');
  assert.ok(
    html.indexOf(`id="${EMPTY_STATE_ID}"`) < html.indexOf('<form'),
    'the empty state renders before the form',
  );
});

test('signInPageRendersTheCredentialsFromTheSharedDemoAccount', () => {
  // Proves the page reads the shared config instead of carrying its own copy.
  const replacement = { email: 'someone.else@example.test', password: 'another-secret' };
  const emptyState = emptyStateMarkup(renderSignInPage({ account: replacement }));

  assert.ok(emptyState.includes(replacement.email));
  assert.ok(emptyState.includes(replacement.password));
  assert.ok(!emptyState.includes(DEMO_ACCOUNT.password), 'no hard-coded fallback copy of the seed');
});

test('signInPageEmptyStateUsesTokensNotRawColours', () => {
  const html = renderSignInPage();

  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(html), 'no raw hex colour in the rendered page');
  assert.ok(!/\b(?:rgb|rgba|hsl|hsla)\(/.test(html), 'no raw colour function in the rendered page');
  assert.ok(!/\sstyle="/.test(html), 'no inline styles in the rendered page');

  // Every class used by the page is defined in the token-driven stylesheet.
  const classNames = [...new Set(html.match(/class="([^"]+)"/g) ?? [])].flatMap((attribute) =>
    attribute.replace(/^class="|"$/g, '').split(/\s+/),
  );
  assert.ok(classNames.length > 0, 'the page uses class names');

  for (const className of classNames) {
    assert.ok(
      signInCss.includes(`.${className}`),
      `class .${className} is styled by src/pages/SignIn.css`,
    );
  }
});

test('everySignInInputHasALabel', () => {
  const html = renderSignInPage();
  const inputIds = [...html.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(inputIds, [EMAIL_INPUT_ID, PASSWORD_INPUT_ID], 'both inputs are identifiable');

  for (const id of inputIds) {
    assert.match(
      html,
      new RegExp(`<label class="sign-in__label" for="${id}">[^<]+</label>`),
      `input #${id} has a <label for>`,
    );
  }
});

test('everySignInControlShowsAVisibleFocusRingFromTokens', () => {
  assert.match(
    signInCss,
    /\.sign-in__input:focus-visible,\s*\n\.sign-in__submit:focus-visible \{/,
    'text inputs and the submit button share a focus-visible rule',
  );
  assert.match(signInCss, /outline: 2px solid var\(--color-brand\)/, 'the focus ring uses a token');
  assert.match(signInCss, /outline-offset: 2px/);
});

test('theCredentialBlockWrapsInsteadOfScrollingSidewaysAt375px', () => {
  assert.match(signInCss, /overflow-wrap: anywhere/, 'long credential values wrap');
  assert.match(signInCss, /flex-wrap: wrap/, 'the credential block wraps');
  assert.match(signInCss, /\.sign-in__card \{[^}]*max-width: 32rem/, 'the card is capped to the viewport');
  assert.match(signInCss, /\.sign-in \{[^}]*padding: var\(--space-4\)/, 'mobile-first gutters use a token');
});
