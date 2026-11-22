import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { SignIn } from './SignIn.ts';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.ts';

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

/** Parses the `:root` block of a token stylesheet into a name -> value map. */
function parseTokens(css: string): Map<string, string> {
  const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
  assert.ok(rootBlock, 'the token stylesheet declares a :root block');
  const tokens = new Map<string, string>();
  for (const match of rootBlock[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

function cssRules(css: string): Array<{ selectors: string[]; body: string }> {
  // Comments are stripped first so a rule's selector list is never polluted by
  // the documentation comment above it.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Array<{ selectors: string[]; body: string }> = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean);
    rules.push({ selectors, body: match[2] });
  }
  return rules;
}

function declarations(body: string): Array<{ property: string; value: string }> {
  const found: Array<{ property: string; value: string }> = [];
  for (const match of body.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/gi)) {
    found.push({ property: match[1].trim().toLowerCase(), value: match[2].trim() });
  }
  return found;
}

/** The declarations a single rule (looked up by its exact selector) sets. */
function ruleDeclarations(selector: string): Array<{ property: string; value: string }> {
  const rules = cssRules(readSource('src/styles/app.css'));
  const rule = rules.find((candidate) => candidate.selectors.includes(selector));
  assert.ok(rule, `${selector} is styled in src/styles/app.css`);
  return declarations(rule.body);
}

function spacingValue(selector: string, property: string): string {
  const value = ruleDeclarations(selector).find(
    (declaration) => declaration.property === property,
  )?.value;
  assert.ok(value, `${selector} sets ${property}`);
  return value;
}

const COLOR_PROPERTIES = new Set([
  'color',
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'outline',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'text-decoration-color',
  'fill',
  'stroke',
]);

const SPACING_PROPERTIES = new Set([
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
]);

const RAW_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:red|blue|green|black|white|gray|grey|silver|yellow|orange|purple|navy|teal)\b/i;

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '').trim();
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const channels = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
  const linear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(channels[0]) + 0.7152 * linear(channels[1]) + 0.0722 * linear(channels[2]);
}

function contrastRatio(foreground: string, background: string): number {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

/** Every file under src/ except the token sheet (the one place raw values live). */
function nonTokenSources(dir = join(repoRoot, 'src')): Array<{ path: string; content: string }> {
  const sources: Array<{ path: string; content: string }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      sources.push(...nonTokenSources(full));
      continue;
    }
    const path = relative(repoRoot, full);
    if (path === join('src', 'styles', 'tokens.css') || path.endsWith('.test.ts')) {
      continue;
    }
    sources.push({ path, content: readFileSync(full, 'utf8') });
  }
  return sources;
}

function emptyStateMarkup(html: string): string | null {
  const start = html.indexOf('<section class="empty-state">');
  if (start === -1) {
    return null;
  }
  const end = html.indexOf('</section>', start);
  return end === -1 ? null : html.slice(start, end + '</section>'.length);
}

const DESIGN_SYSTEM_V1: Record<string, string> = {
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

/* ------------------------------------------------------------------ *
 * T-1 — sign in with an empty state
 * ------------------------------------------------------------------ */

/** AC1: on load the empty state names the demo credentials. */
function TestSignInShowsTheEmptyState() {
  const html = SignIn(); // the page as it renders on load, before any interaction
  const emptyState = emptyStateMarkup(html);

  assert.ok(emptyState, 'the sign-in page renders an empty state on load');

  assert.match(emptyState, /class="empty-state__title"/, 'the empty state has a title');
  assert.match(
    emptyState,
    /class="empty-state__description"/,
    'the empty state explains why it is empty',
  );

  assert.ok(
    emptyState.includes(DEMO_CREDENTIALS.email),
    `the empty state names the demo email (${DEMO_CREDENTIALS.email})`,
  );
  assert.ok(
    emptyState.includes(DEMO_CREDENTIALS.password),
    'the empty state names the demo password',
  );
  assert.match(emptyState, /<dt class="credentials__term">Email<\/dt>/, 'email is named');
  assert.match(emptyState, /<dt class="credentials__term">Password<\/dt>/, 'password is named');

  // The credentials are also the single source of truth used by the form.
  assert.equal(DEMO_CREDENTIALS.email, 'demo@pilot.example');
}

/** AC1: the colours of the empty state come from design tokens, never raw values. */
function TestSignInEmptyStateUsesDesignTokens() {
  const tokens = parseTokens(readSource('src/styles/tokens.css'));
  const rules = cssRules(readSource('src/styles/app.css'));

  const emptyStateRules = rules.filter((rule) =>
    rule.selectors.some((selector) => /^\.(empty-state|credentials)/.test(selector)),
  );
  assert.ok(
    emptyStateRules.length >= 3,
    'the empty state is styled from the shared stylesheet',
  );

  let colourDeclarations = 0;
  for (const rule of rules) {
    for (const { property, value } of declarations(rule.body)) {
      if (!COLOR_PROPERTIES.has(property)) {
        continue;
      }
      colourDeclarations += 1;
      assert.ok(
        !RAW_COLOR.test(value.replace(/var\([^)]*\)/g, '')),
        `${rule.selectors.join(', ')} { ${property}: ${value} } uses a raw colour value`,
      );
      const references = [...value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]);
      assert.ok(
        references.length > 0,
        `${rule.selectors.join(', ')} { ${property} } must use a design token`,
      );
      for (const reference of references) {
        assert.ok(tokens.has(reference), `${reference} is a declared design-system v1 token`);
      }
    }
  }
  assert.ok(colourDeclarations >= 5, 'the surface actually declares its colours from tokens');

  // No raw colour values anywhere in the sources, the token sheet excepted.
  for (const source of nonTokenSources()) {
    assert.ok(
      !RAW_COLOR.test(source.content),
      `${source.path} must not contain raw colour values (use var(--color-*))`,
    );
  }

  // The empty state carries no inline colours either.
  const emptyState = emptyStateMarkup(SignIn());
  assert.ok(emptyState);
  assert.ok(!/\sstyle="/.test(emptyState), 'the empty state does not use inline styles');
  assert.ok(
    !RAW_COLOR.test(emptyState.replace(/var\([^)]*\)/g, '')),
    'the rendered empty state contains no raw colours',
  );
}

function TestDesignTokensMatchDesignSystemV1() {
  const tokens = parseTokens(readSource('src/styles/tokens.css'));
  const declared = [...tokens.entries()].sort(([a], [b]) => a.localeCompare(b));
  const expected = Object.entries(DESIGN_SYSTEM_V1).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(declared, expected, 'tokens.css declares exactly the design-system v1 tokens');
}

function TestSignInColoursMeetWcagAaContrast() {
  const tokens = parseTokens(readSource('src/styles/tokens.css'));
  const colour = (name: string) => {
    const value = tokens.get(name);
    assert.ok(value, `${name} is declared`);
    return value;
  };

  const pairs: Array<[string, string, string]> = [
    ['--color-text-primary', '--color-bg-surface', 'body text on the surface'],
    ['--color-text-secondary', '--color-bg-surface', 'supporting text on the surface'],
    ['--color-text-primary', '--color-bg-canvas', 'body text on the canvas'],
    ['--color-text-secondary', '--color-bg-canvas', 'supporting text on the canvas'],
    ['--color-bg-surface', '--color-brand', 'primary button label'],
    ['--color-danger', '--color-bg-surface', 'error text on the surface'],
  ];

  for (const [foreground, background, description] of pairs) {
    const ratio = contrastRatio(colour(foreground), colour(background));
    assert.ok(ratio >= 4.5, `${description} is ${ratio.toFixed(2)}:1 (needs at least 4.5:1)`);
  }
}

function TestSignInHidesTheEmptyStateOnceTheFormIsInUse() {
  assert.ok(emptyStateMarkup(SignIn({ touched: true })) === null, 'no empty state once touched');
  assert.ok(
    emptyStateMarkup(SignIn({ values: { email: 'someone@example.com' } })) === null,
    'no empty state once the form holds a value',
  );
  assert.ok(emptyStateMarkup(SignIn({ values: { email: ' ', password: ' ' } })) !== null, 'blank values keep the empty state');
}

function TestSignInFormControlsAreLabelledAndFocusable() {
  const html = SignIn({ touched: true });

  const inputIds = [...html.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(inputIds.length >= 2, 'the form has email and password inputs');
  for (const id of inputIds) {
    assert.ok(
      html.includes(`<label class="field__label" for="${id}">`),
      `input "${id}" has an associated label`,
    );
  }
  assert.match(html, /<input[^>]*id="sign-in-email"[^>]*type="email"/);
  assert.match(html, /<input[^>]*id="sign-in-password"[^>]*type="password"/);
  assert.match(html, /autocomplete="username"/);
  assert.match(html, /autocomplete="current-password"/);

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const accessibleName = match[2].replace(/<[^>]*>/g, '').trim();
    assert.ok(
      accessibleName.length > 0 || /aria-label="[^"]+"/.test(match[1]),
      'every button has an accessible name (text or aria-label)',
    );
  }

  const focusRules = cssRules(readSource('src/styles/app.css')).filter((rule) =>
    rule.selectors.some((selector) => selector.includes(':focus-visible')),
  );
  assert.ok(focusRules.length > 0, 'the stylesheet declares a :focus-visible focus ring');
  for (const rule of focusRules) {
    assert.match(
      rule.body,
      /outline:\s*[^;]*var\(--color-brand\)/,
      `${rule.selectors.join(', ')} draws its focus ring with var(--color-brand)`,
    );
  }

  // The focus ring must cover exactly the interactive elements the page
  // renders: every rendered control gets a ring, and no rule targets an element
  // that never renders (the sign-in page has no links, so an `a:focus-visible`
  // rule would be dead CSS).
  const renderedTags = new Set(
    [...html.matchAll(/<([a-z][a-z0-9]*)\b/g)].map((match) => match[1].toLowerCase()),
  );
  const focusSelectors = focusRules.flatMap((rule) => rule.selectors).join(', ');
  for (const control of ['a', 'button', 'input', 'select', 'textarea']) {
    const renders = renderedTags.has(control);
    const ringDeclared = new RegExp(`(?:^|[\\s,>+~])${control}(?![a-z0-9-])`).test(focusSelectors);
    assert.equal(
      ringDeclared,
      renders,
      renders
        ? `${control} elements render, so they get the visible focus ring`
        : `${control} elements never render, so the stylesheet must not declare a dead focus rule for them`,
    );
  }
}

function TestSignInSpacingUsesDesignTokens() {
  for (const rule of cssRules(readSource('src/styles/app.css'))) {
    for (const { property, value } of declarations(rule.body)) {
      if (!SPACING_PROPERTIES.has(property)) {
        continue;
      }
      const allowed =
        value === '0' ||
        value === 'auto' ||
        /^var\(--space-[a-z0-9-]+\)(\s+(0|auto|var\(--space-[a-z0-9-]+\)))*$/.test(value);
      assert.ok(
        allowed,
        `${rule.selectors.join(', ')} { ${property}: ${value} } is off the design-system spacing scale`,
      );
    }
  }
}

/**
 * Review fix: one spacing token for every margin and padding read as a flat
 * rhythm. Related content is now tight (0) inside a group, and only separate
 * groups use the spacing step.
 */
function TestSignInGroupsRelatedContentWithAVerticalRhythm() {
  const tight: Array<[string, string]> = [
    ['.sign-in__heading', 'the heading owns no separation of its own'],
    ['.empty-state__title', 'the empty-state title and its description are one group'],
    ['.empty-state__description', 'the description sits tight under its title'],
    ['.field', 'a field only separates itself from the previous field'],
    ['.field__label', 'the label sits tight above its input'],
    ['.field__input', 'the input sits tight under its label'],
    ['.credentials__term', 'a term sits tight above its value'],
    ['.credentials__value', 'a value sits tight under its term'],
  ];
  for (const [selector, why] of tight) {
    assert.equal(spacingValue(selector, 'margin'), '0', `${why} (${selector} { margin })`);
  }

  const separated: Array<[string, string]> = [
    ['.empty-state', 'the empty state is separated from the heading'],
    ['.empty-state__extra', 'the credentials are separated from the description'],
    ['.credentials__value + .credentials__term', 'the two credential pairs are separated'],
    ['.sign-in__form', 'the form is separated from the empty state'],
    ['.field + .field', 'the two fields are separated'],
    ['.button--primary', 'the form action is separated from the last field'],
  ];
  for (const [selector, why] of separated) {
    assert.match(
      spacingValue(selector, 'margin'),
      /^var\(--space-[a-z0-9-]+\)(\s+0){1,3}$/,
      `${why}: ${selector} { margin: var(--space-4) ... }`,
    );
  }

  // Both levels have to be present: a flat sheet of one value fails here.
  const spacingValues = cssRules(readSource('src/styles/app.css')).flatMap((rule) =>
    declarations(rule.body)
      .filter((declaration) => SPACING_PROPERTIES.has(declaration.property))
      .map((declaration) => declaration.value),
  );
  const tightCount = spacingValues.filter((value) => value === '0').length;
  const separatedCount = spacingValues.filter((value) => value.startsWith('var(--space-')).length;
  assert.ok(tightCount >= 5, `groups sit tight together (${tightCount} zero-spacing declarations)`);
  assert.ok(
    separatedCount >= 5,
    `groups are separated with the design-system step (${separatedCount} token-spacing declarations)`,
  );
}

/**
 * Review fix: `.page` used `min-height: 100vh`, which overflows under mobile
 * browser chrome. The visible viewport unit (100dvh) wins; 100vh may only
 * survive as a fallback that a dvh declaration overrides.
 */
function TestSignInPageTracksTheMobileViewport() {
  const rules = cssRules(readSource('src/styles/app.css'));

  const pageHeights = ruleDeclarations('.page')
    .filter((declaration) => declaration.property === 'min-height' || declaration.property === 'height')
    .map((declaration) => declaration.value);
  assert.ok(pageHeights.length > 0, '.page sets a height');
  assert.equal(
    pageHeights.at(-1),
    '100dvh',
    '.page tracks the visible viewport with 100dvh',
  );

  for (const rule of rules) {
    const heights = declarations(rule.body).filter(
      (declaration) => declaration.property === 'min-height' || declaration.property === 'height',
    );
    for (const [index, declaration] of heights.entries()) {
      if (!/\d(?:d|s|l)?vh$/.test(declaration.value)) {
        continue;
      }
      const overridden = heights
        .slice(index + 1)
        .some((later) => later.value === '100dvh');
      assert.ok(
        declaration.value === '100dvh' || overridden,
        `${rule.selectors.join(', ')} { ${declaration.property}: ${declaration.value} } needs a 100dvh override: 100vh overflows under mobile browser chrome`,
      );
    }
  }
}

function TestSignInLayoutStaysMobileFirst() {
  const css = readSource('src/styles/app.css');
  assert.ok(!/width:\s*\d+(\.\d+)?px/.test(css), 'no fixed pixel widths: the layout stays fluid');
  assert.match(css, /\.sign-in\s*\{[^}]*width:\s*100%/, 'the card fills the viewport width');
  assert.match(css, /\.field__input\s*\{[^}]*width:\s*100%/, 'inputs fill the available width');
  assert.match(
    css,
    /\.credentials__value\s*\{[^}]*overflow-wrap:\s*anywhere/,
    'credential values wrap instead of forcing horizontal scroll',
  );
  assert.ok(!/\d+vw|\d+px\s*\+\s*\d+px/.test(css), 'no viewport-width arithmetic');
}

function TestSignInEmptyStateEscapesItsContent() {
  const html = SignIn({ values: { email: '"><script>alert(1)</script>' } });
  assert.ok(!html.includes('<script>'), 'user input never reaches the page as markup');
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;'), 'the input value is escaped');

  const withError = SignIn({ error: '<img src=x onerror=alert(1)>' });
  assert.ok(!withError.includes('<img'), 'error messages are escaped');
}

/* ------------------------------------------------------------------ *
 * registration
 * ------------------------------------------------------------------ */

test('TestSignInShowsTheEmptyState', TestSignInShowsTheEmptyState);
test('TestSignInEmptyStateUsesDesignTokens', TestSignInEmptyStateUsesDesignTokens);
test('TestDesignTokensMatchDesignSystemV1', TestDesignTokensMatchDesignSystemV1);
test('TestSignInColoursMeetWcagAaContrast', TestSignInColoursMeetWcagAaContrast);
test('TestSignInHidesTheEmptyStateOnceTheFormIsInUse', TestSignInHidesTheEmptyStateOnceTheFormIsInUse);
test(
  'TestSignInFormControlsAreLabelledAndFocusable',
  TestSignInFormControlsAreLabelledAndFocusable,
);
test('TestSignInSpacingUsesDesignTokens', TestSignInSpacingUsesDesignTokens);
test(
  'TestSignInGroupsRelatedContentWithAVerticalRhythm',
  TestSignInGroupsRelatedContentWithAVerticalRhythm,
);
test('TestSignInPageTracksTheMobileViewport', TestSignInPageTracksTheMobileViewport);
test('TestSignInLayoutStaysMobileFirst', TestSignInLayoutStaysMobileFirst);
test('TestSignInEmptyStateEscapesItsContent', TestSignInEmptyStateEscapesItsContent);
