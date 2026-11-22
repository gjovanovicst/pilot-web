/**
 * Dev utility (not part of the test suite): prints the rendered sign-in page so
 * the empty state can be eyeballed without a browser.
 *
 *   node --experimental-strip-types probe.mjs
 *   node --experimental-strip-types probe.mjs --touched
 */
import { SignIn } from './src/pages/SignIn.ts';

const touched = process.argv.includes('--touched');
console.log(SignIn({ touched }));
