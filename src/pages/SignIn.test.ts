/**
 * T-1 — sign in with an empty state.
 *
 * AC1: given the sign-in page, when it loads, then the empty state names the
 * demo credentials and the colours come from tokens.
 *
 * The suite is deliberately woven from three kinds of check so AC1 cannot be
 * satisfied cosmetically:
 *   1. behaviour  — the page as rendered on load (empty state present, names
 *                   the demo credentials, nothing blank),
 *   2. provenance — the credentials come from the single source of truth and
 *                   every colour/space value comes from design system v1,
 *   3. a11y       — WCAG AA contrast of the token pairs actually used, labels,
 *                   accessible names and a token-based focus ring.
 *
 * NOTE: `.tsx`/React cannot run here (no component runtime is installed and
 * the sandbox is offline), so this file is `.test.ts` and drives the plain
 * view functions with Node's built-in test runner (`npm test`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';
import { EmptyState } from '../components/EmptyState.ts';
import { toMarkup, toText } from '../ui/html.ts';
import {
  EMPTY_STATE_HEADING_ID,
  initialSignInState,
  renderSignIn,
  shouldShowEmptyState,
  signInReducer,
} from './SignIn.ts';

/* ------------------------------------------------------------------ */
/* repo helpers                                                        */
/* ------------------------------------------------------------------ */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function listSourceFiles(extension: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const absolute = path.join(directory, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
      } else if (absolute.endsWith(extension)) {
        found.push(path.relative(REPO_ROOT, absolute));
      }
    }
  };
  walk(path.join(REPO_ROOT, 'src'));
  return found.sort();
}

/** Test files legitimately hold expected literals, so hygiene scans skip them. */
const isTestFile = (file: string): boolean => /\.test\.[cm]?tsx?$/.test(file);

const TOKENS_FILE = 'src/styles/tokens.css';
const APP_CSS_FILE = 'src/styles/app.css';
const CREDENTIALS_FILE = 'src/constants/demoCredentials.ts';

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

type CssDeclaration = { selector: string; property: string; value: string };

function cssDeclarations(css: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let rule: RegExpExecArray | null;
  while ((rule = rulePattern.exec(stripCssComments(css))) !== null) {
    const selectors = (rule[1] ?? '').trim();
    const body = rule[2] ?? '';
    const declarationPattern = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
    let declaration: RegExpExecArray | null;
    while ((declaration = declarationPattern.exec(body)) !== null) {
      declarations.push({
        selector: selectors,
        property: (declaration[1] ?? '').trim().toLowerCase(),
        value: (declaration[2] ?? '').trim(),
      });
    }
  }
  return declarations;
}

function ruleBody(css: string, selector: string): string {
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let rule: RegExpExecArray | null;
  while ((rule = rulePattern.exec(stripCssComments(css))) !== null) {
    const selectors = (rule[1] ?? '').split(',').map((entry) => entry.trim());
    if (selectors.includes(selector)) return (rule[2] ?? '').trim();
  }
  throw new Error(`Selector ${selector} not found in ${APP_CSS_FILE}`);
}

/* ------------------------------------------------------------------ */
/* colour maths (WCAG AA)                                              */
/* ------------------------------------------------------------------ */

function parseHexColor(value: string): [number, number, number] {
  const hex = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`Not a 6-digit hex colour: ${value}`);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(
    relativeLuminance(parseHexColor(foreground)),
    relativeLuminance(parseHexColor(background)),
  );
  const darker = Math.min(
    relativeLuminance(parseHexColor(foreground)),
    relativeLuminance(parseHexColor(background)),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/* ------------------------------------------------------------------ */
/* design system v1 tokens                                             */
/* ------------------------------------------------------------------ */

const DESIGN_SYSTEM_V1_TOKENS: Readonly<Record<string, string>> = {
  '--color-brand': '#4f5eea',
  '--color-bg-canvas': '#fbfbfd',
  '--color-bg-surface': '#ffffff',
  '--color-text-primary': '#101223',
  '--color-text-secondary': '#5b5f7b',
  '--color-danger': '#d92d20',
  '--radius-md': '6px',
  '--space-4': '16px',
  '--font-sans': 'Inter, system-ui, sans-serif',
};

function declaredTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stripCssComments(css))) !== null) {
    tokens.set((match[1] ?? '').trim(), (match[2] ?? '').trim().replace(/\s+/g, ' '));
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/* AC1 — the empty state on load                                       */
/* ------------------------------------------------------------------ */

describe('T-1 sign-in empty state (AC1)', () => {
  it('renders the empty state on load instead of a blank panel', () => {
    const markup = toMarkup(renderSignIn());

    assert.equal(shouldShowEmptyState(initialSignInState), true);
    assert.match(markup, /<section class="empty-state"/);
    assert.match(markup, new RegExp(`aria-labelledby="${EMPTY_STATE_HEADING_ID}"`));
    assert.match(markup, new RegExp(`<h2[^>]*id="${EMPTY_STATE_HEADING_ID}"`));

    const emptyState = markup.slice(
      markup.indexOf('<section class="empty-state"'),
      markup.indexOf('</section>'),
    );
    const text = toText(emptyState);
    assert.ok(text.length > 0, 'the empty state must not be blank');
    assert.match(text, /sign in with the demo account/i);
  });

  it('names the demo email and password in the empty state', () => {
    const markup = toMarkup(renderSignIn());
    const emptyState = markup.slice(
      markup.indexOf('<section class="empty-state"'),
      markup.indexOf('</section>'),
    );
    const text = toText(emptyState);

    assert.match(text, /demo email/i);
    assert.match(text, /demo password/i);
    assert.ok(
      text.includes(DEMO_CREDENTIALS.email),
      `empty state must name the demo email (${DEMO_CREDENTIALS.email}); got: ${text}`,
    );
    assert.ok(
      text.includes(DEMO_CREDENTIALS.password),
      `empty state must name the demo password (${DEMO_CREDENTIALS.password}); got: ${text}`,
    );
  });

  it('names the credentials from the single source of truth, not from literals', () => {
    const typescriptSources = listSourceFiles('.ts').filter(
      (file) => !isTestFile(file) && file !== CREDENTIALS_FILE,
    );
    assert.ok(typescriptSources.includes('src/pages/SignIn.ts'));

    for (const file of typescriptSources) {
      const contents = readRepoFile(file);
      assert.equal(
        contents.includes(DEMO_CREDENTIALS.email),
        false,
        `${file} must import the demo email from ${CREDENTIALS_FILE} instead of hard-coding it`,
      );
      assert.equal(
        contents.includes(DEMO_CREDENTIALS.password),
        false,
        `${file} must import the demo password from ${CREDENTIALS_FILE} instead of hard-coding it`,
      );
    }
  });

  it('hides the empty state as soon as the form is touched', () => {
    const touched = signInReducer(initialSignInState, {
      type: 'field-changed',
      field: 'email',
      value: 'someone@example.com',
    });

    assert.equal(shouldShowEmptyState(touched), false);
    assert.equal(toMarkup(renderSignIn(touched)).includes('class="empty-state"'), false);
  });

  it('fills the form from the empty-state action and reveals the ready state', () => {
    const filled = signInReducer(initialSignInState, { type: 'demo-credentials-requested' });

    assert.equal(filled.email, DEMO_CREDENTIALS.email);
    assert.equal(filled.password, DEMO_CREDENTIALS.password);
    assert.equal(shouldShowEmptyState(filled), false);

    const markup = toMarkup(renderSignIn(filled));
    assert.match(markup, /id="signin-email"[^>]*value="demo@pilot\.example"|value="demo@pilot\.example"/);
    assert.match(markup, /value="pilot-demo"/);
    assert.equal(signInReducer(filled, { type: 'reset' }).touched, false);
  });

  it('escapes interpolated credential values (empty state cannot inject markup)', () => {
    const markup = toMarkup(
      EmptyState({
        id: 'x',
        title: 'No sign-in details yet',
        description: 'Use the demo account.',
        credentials: { email: '<script>alert(1)</script>', password: '" onfocus="evil' },
      }),
    );

    assert.equal(markup.includes('<script>'), false);
    assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(markup, /&quot; onfocus=&quot;evil/);
  });
});

/* ------------------------------------------------------------------ */
/* AC1 — "the colours come from tokens"                                */
/* ------------------------------------------------------------------ */

describe('T-1 design tokens (AC1)', () => {
  it('tokens.css declares exactly the design system v1 token set', () => {
    const tokens = declaredTokens(readRepoFile(TOKENS_FILE));
    const expectedNames = Object.keys(DESIGN_SYSTEM_V1_TOKENS).sort();

    assert.deepEqual([...tokens.keys()].sort(), expectedNames);
    for (const [name, expectedValue] of Object.entries(DESIGN_SYSTEM_V1_TOKENS)) {
      assert.equal(tokens.get(name), expectedValue, `${name} drifted from design system v1`);
    }
  });

  it('no raw colour appears anywhere outside tokens.css', () => {
    const files = [...listSourceFiles('.css'), ...listSourceFiles('.ts')].filter(
      (file) => file !== TOKENS_FILE && !isTestFile(file),
    );
    assert.ok(files.includes(APP_CSS_FILE));

    for (const file of files) {
      const contents = stripCssComments(readRepoFile(file));
      assert.equal(
        /#[0-9a-f]{3,8}\b/i.test(contents),
        false,
        `${file} contains a raw hex colour; use a var(--color-*) token`,
      );
      assert.equal(
        /\b(rgba?|hsla?)\(/i.test(contents),
        false,
        `${file} contains a raw colour function; use a var(--color-*) token`,
      );
    }
  });

  it('app.css styles the sign-in and empty state with tokens only', () => {
    const declarations = cssDeclarations(readRepoFile(APP_CSS_FILE));
    assert.ok(declarations.length > 0);

    const colourProperties = new Set([
      'color',
      'background',
      'background-color',
      'border',
      'border-color',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left',
      'outline',
      'outline-color',
      'fill',
      'stroke',
      'box-shadow',
    ]);
    const spacingProperties = new Set([
      'gap',
      'row-gap',
      'column-gap',
      'margin',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'margin-block',
      'margin-inline',
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'padding-block',
      'padding-inline',
    ]);

    for (const { selector, property, value } of declarations) {
      if (colourProperties.has(property)) {
        assert.ok(
          value.includes('var(--color-') || ['0', 'none', 'transparent', 'inherit'].includes(value),
          `${selector} { ${property}: ${value} } must use a colour token`,
        );
      }
      if (spacingProperties.has(property)) {
        assert.ok(
          value === '0' || value.includes('var(--space-4)'),
          `${selector} { ${property}: ${value} } must use the --space-4 spacing token`,
        );
      }
      if (property === 'border-radius') {
        assert.equal(value, 'var(--radius-md)');
      }
      if (property === 'font-family') {
        assert.equal(value, 'var(--font-sans)');
      }
    }
  });

  it('app.css introduces no raw pixel length', () => {
    const css = stripCssComments(readRepoFile(APP_CSS_FILE));
    const rawPixels = css.match(/(?<![\w-])\d*\.?\d+px\b/g) ?? [];
    assert.deepEqual(
      rawPixels,
      [],
      `app.css must derive lengths from tokens with calc(); found: ${rawPixels.join(', ')}`,
    );
  });
});

/* ------------------------------------------------------------------ */
/* AC1 — the empty state is readable and usable                        */
/* ------------------------------------------------------------------ */

describe('T-1 accessibility and responsive checks (AC1)', () => {
  it('token colour pairs meet WCAG AA 4.5:1', () => {
    const pairs: ReadonlyArray<readonly [string, string, string]> = [
      ['--color-text-primary', '--color-bg-surface', 'empty state value on panel'],
      ['--color-text-secondary', '--color-bg-surface', 'supporting copy on panel'],
      ['--color-text-primary', '--color-bg-canvas', 'empty state value on tint'],
      ['--color-text-secondary', '--color-bg-canvas', 'empty state copy on tint'],
      ['--color-brand', '--color-bg-surface', 'secondary button label'],
      ['--color-bg-surface', '--color-brand', 'primary button label'],
    ];

    for (const [foregroundToken, backgroundToken, label] of pairs) {
      const foreground = DESIGN_SYSTEM_V1_TOKENS[foregroundToken];
      const background = DESIGN_SYSTEM_V1_TOKENS[backgroundToken];
      const ratio = contrastRatio(foreground ?? '', background ?? '');
      assert.ok(
        ratio >= 4.5,
        `${label}: ${foregroundToken} on ${backgroundToken} is ${ratio.toFixed(2)}:1, below 4.5:1`,
      );
    }
  });

  it('every input has a label and every button an accessible name', () => {
    const markup = toMarkup(renderSignIn());

    const inputIds = [...markup.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
    const labelTargets = [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    assert.equal(inputIds.length, 2, 'the sign-in form has an email and a password input');
    for (const id of inputIds) {
      assert.ok(labelTargets.includes(id), `input #${id} has no associated <label for>`);
    }

    const buttons = [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.ok(buttons.length >= 2, 'empty-state action and submit button are rendered');
    for (const button of buttons) {
      const attributes = button[1] ?? '';
      const label = toText(button[2] ?? '');
      const ariaLabel = /aria-label="([^"]+)"/.exec(attributes)?.[1] ?? '';
      assert.ok(
        label.length > 0 || ariaLabel.length > 0,
        `a button has no accessible name: <button${attributes}>`,
      );
    }
  });

  it('interactive elements get a visible, token-based focus ring', () => {
    const css = readRepoFile(APP_CSS_FILE);
    const focusRules = [...stripCssComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((rule) =>
      /:focus-visible/.test(rule[1] ?? ''),
    );

    assert.ok(focusRules.length > 0, 'app.css must declare a :focus-visible ring');
    for (const rule of focusRules) {
      const body = rule[2] ?? '';
      assert.match(body, /outline:\s*[^;]*var\(--color-brand\)/, 'focus ring must use the brand token');
      assert.match(body, /outline-offset:/, 'focus ring needs an offset so it is not clipped');
    }
  });

  it('stays usable at 375px with no horizontal scroll', () => {
    const css = readRepoFile(APP_CSS_FILE);

    for (const selector of ['.signin', '.signin__panel', '.signin__input', '.empty-state']) {
      assert.match(
        ruleBody(css, selector),
        /box-sizing:\s*border-box/,
        `${selector} must be border-box so padding cannot overflow 375px`,
      );
    }
    assert.match(ruleBody(css, '.signin__panel'), /width:\s*100%/, 'panel must be fluid');
    assert.match(ruleBody(css, '.empty-state__value'), /overflow-wrap:\s*(anywhere|break-word)/);
    assert.equal(
      /white-space:\s*nowrap/.test(stripCssComments(css)),
      false,
      'nowrap on credentials would force horizontal scroll at 375px',
    );
  });
});
