import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('..', import.meta.url));
const tokensPath = join(srcDir, 'styles', 'tokens.css');
const tokensCss = readFileSync(tokensPath, 'utf8');

/** The v1 design system, verbatim. No token may be added, renamed or re-valued. */
const V1_TOKENS: Readonly<Record<string, string>> = {
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
  const declarations = new Map<string, string>();
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(match[1], match[2].trim().replace(/\s+/g, ' '));
  }
  return declarations;
}

/**
 * Application source only: test files are excluded because they necessarily
 * spell out the expected token values (that is what they assert against).
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    if (/\.test\.ts$/.test(entry.name)) {
      return [];
    }
    return /\.(?:ts|css|html)$/.test(entry.name) ? [entryPath] : [];
  });
}

function relative(filePath: string): string {
  return filePath.slice(srcDir.length);
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

test('tokensCssDeclaresExactlyTheV1DesignTokens', () => {
  const declared = declaredTokens(tokensCss);

  assert.deepEqual(
    [...declared.keys()].sort(),
    Object.keys(V1_TOKENS).sort(),
    'tokens.css declares the nine v1 tokens and nothing else',
  );

  for (const [token, expected] of Object.entries(V1_TOKENS)) {
    assert.equal(declared.get(token), expected, `${token} keeps its v1 value`);
  }
});

test('noRawColoursOutsideTokensCss', () => {
  const offenders: string[] = [];

  for (const filePath of sourceFiles(srcDir)) {
    if (filePath === tokensPath) {
      continue;
    }
    const contents = readFileSync(filePath, 'utf8');
    if (/#[0-9a-fA-F]{3,8}\b/.test(contents) || /\b(?:rgb|rgba|hsl|hsla)\(/.test(contents)) {
      offenders.push(relative(filePath));
    }
  }

  assert.deepEqual(offenders, [], 'only tokens.css may hold raw colour values');
});

test('signInStylesTakeSpacingRadiusAndTypeFromTokens', () => {
  const signInCss = readFileSync(join(srcDir, 'pages', 'SignIn.css'), 'utf8');
  const violations: string[] = [];

  for (const match of signInCss.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const property = match[1];
    const value = match[2].trim();

    if (/^(?:padding|margin|gap|row-gap|column-gap)(?:-|$)/.test(property)) {
      if (!['var(--space-4)', '0', 'auto'].includes(value)) {
        violations.push(`${property}: ${value}`);
      }
    }

    if (property === 'border-radius' && !['var(--radius-md)', '0'].includes(value)) {
      violations.push(`${property}: ${value}`);
    }

    if (property === 'font-family' && value !== 'var(--font-sans)') {
      violations.push(`${property}: ${value}`);
    }
  }

  assert.deepEqual(violations, [], 'sign-in spacing, radius and type come from tokens only');
});

test('everyColourLiteralInSignInStylesIsAToken', () => {
  const signInCss = readFileSync(join(srcDir, 'pages', 'SignIn.css'), 'utf8');

  for (const match of signInCss.matchAll(
    /(?:^|\s)(?:color|background|background-color|border-color|outline-color)\s*:\s*([^;]+);/g,
  )) {
    const value = match[1].trim();
    assert.match(value, /var\(--(?:color-[a-z-]+|font-sans)\)/, `"${value}" must be a token`);
  }
});

test('tokenColoursMeetWcagAaContrastForBodyText', () => {
  const surface = V1_TOKENS['--color-bg-surface'];
  const canvas = V1_TOKENS['--color-bg-canvas'];

  // Body copy on both surfaces.
  assert.ok(contrastRatio(V1_TOKENS['--color-text-primary'], surface) >= 4.5, 'primary on surface');
  assert.ok(contrastRatio(V1_TOKENS['--color-text-primary'], canvas) >= 4.5, 'primary on canvas');
  assert.ok(
    contrastRatio(V1_TOKENS['--color-text-secondary'], surface) >= 4.5,
    'secondary on surface',
  );
  assert.ok(contrastRatio(V1_TOKENS['--color-text-secondary'], canvas) >= 4.5, 'secondary on canvas');

  // Submit button: surface-coloured text on the brand fill; danger text if used.
  assert.ok(contrastRatio(surface, V1_TOKENS['--color-brand']) >= 4.5, 'button text on brand');
  assert.ok(contrastRatio(V1_TOKENS['--color-danger'], surface) >= 4.5, 'danger text on surface');
});
