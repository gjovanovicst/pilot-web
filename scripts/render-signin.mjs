/**
 * Renders the sign-in page to a self-contained HTML file for a manual look at
 * the empty state (the repository ships no bundler, so there is no dev server).
 *
 *   npm run render:signin > signin.html
 *
 * The design tokens and component styles are inlined so the output can be
 * opened straight from disk.
 */
import { readFileSync } from 'node:fs';

import { toMarkup } from '../src/ui/html.ts';
import { renderSignIn } from '../src/pages/SignIn.ts';

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const appStyles = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in — Pilot Web</title>
    <style>
${tokens}
${appStyles}
    </style>
  </head>
  <body>
${toMarkup(renderSignIn())}
  </body>
</html>
`;

process.stdout.write(page);
