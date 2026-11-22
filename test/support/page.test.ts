import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accessibleDescription,
  accessibleName,
  attr,
  byId,
  controlsLabelled,
  decodeEntities,
  definitionPairs,
  elementsOf,
  headings,
  landmarks,
  pageText,
  parsePage,
} from './page.ts';
import { DEMO_CREDENTIALS } from '../../src/constants/demoCredentials.ts';
import { escapeHtml } from '../../src/lib/html.ts';

/* ------------------------------------------------------------------ *
 * The page tests read a rendered page through this reader, so it has to be
 * trustworthy on its own terms: the queries must answer by semantics rather
 * than by markup shape (a renamed class, an added attribute, an extra wrapper
 * or a reflowed tag must change nothing), and the parser must survive markup a
 * bug could produce. Each property the page tests rely on is pinned below.
 *
 * The demo credentials come from DEMO_CREDENTIALS: a fixture that hard-codes
 * them would drift from the single source of truth the empty state renders.
 * ------------------------------------------------------------------ */

/** The same sign-in hint, decorated and wrapped the way a refactor might. */
const DECORATED = [
  '<main class="page" data-surface="sign-in">',
  '  <section',
  '    class="empty-state empty-state--quiet"',
  '    data-testid="hint"',
  '    aria-labelledby="hint-title"',
  '    aria-describedby="hint-description"',
  '  >',
  '    <div class="empty-state__body">',
  '      <h2 id="hint-title">Sign in with the demo account</h2>',
  '      <div class="empty-state__copy">',
  '        <p id="hint-description">The form starts empty.</p>',
  '      </div>',
  '      <div class="empty-state__extra">',
  '        <dl class="credentials">',
  '          <div class="credentials__pair">',
  '            <dt>Email</dt>',
  `            <dd>${escapeHtml(DEMO_CREDENTIALS.email)}</dd>`,
  '          </div>',
  '          <div class="credentials__pair">',
  '            <dt>Password</dt>',
  `            <dd>${escapeHtml(DEMO_CREDENTIALS.password)}</dd>`,
  '          </div>',
  '        </dl>',
  '      </div>',
  '    </div>',
  '  </section>',
  '  <form class="sign-in__form" aria-describedby="credentials">',
  '    <div class="field">',
  '      <label class="field__label" for="email-field">Email</label>',
  '      <input class="field__input" id="email-field" type="email" value="a&quot;b">',
  '    </div>',
  '  </form>',
  '</main>',
].join('\n');

function TestQueriesSurviveDecoratedMarkup() {
  const page = parsePage(DECORATED);

  const [region] = landmarks(page).filter(
    (element) => accessibleName(page, element) === 'Sign in with the demo account',
  );
  assert.ok(region, 'a decorated, wrapped landmark is still found as a landmark');
  assert.equal(
    accessibleName(page, region),
    'Sign in with the demo account',
    'the region is named by its title, not by a class name',
  );
  assert.equal(
    accessibleDescription(page, region),
    'The form starts empty.',
    'the description is read through aria-describedby wherever it sits',
  );

  assert.deepEqual(
    definitionPairs(region),
    [
      { term: 'Email', value: DEMO_CREDENTIALS.email },
      { term: 'Password', value: DEMO_CREDENTIALS.password },
    ],
    'term/value pairs are paired by dt/dd semantics, not by sibling position',
  );

  const [email] = controlsLabelled(page, 'Email');
  assert.ok(email, 'the field is found through its label');
  assert.equal(attr(email, 'id'), 'email-field');
  assert.equal(
    attr(email, 'value'),
    'a"b',
    'an escaped attribute value is read back as the string it stood for',
  );
  assert.equal(pageText(email), '', 'an input has no text content of its own');
}

/** A page without a named section has no landmark, so "empty" stays detectable. */
function TestAnUnnamedSectionIsNotALandmark() {
  const page = parsePage('<div><section><p>Nothing here yet</p></section></div>');
  assert.deepEqual(landmarks(page), [], 'an unnamed section is not a landmark');
  assert.equal(
    byId(page, 'sign-in-empty-state'),
    undefined,
    'nothing anchors an id the page does not render',
  );
}

/** Void elements close themselves, so the content after one is not nested in it. */
function TestVoidElementsCloseThemselves() {
  const page = parsePage(
    '<form><input name="email"><br><img src="a.png"><button type="submit">Sign in</button></form>',
  );

  const form = elementsOf(page, 'form')[0];
  assert.ok(form, 'the form is parsed');
  assert.deepEqual(
    elementsOf(form).map((element) => element.tag),
    ['input', 'br', 'img', 'button'],
    'a void element does not swallow the elements that follow it',
  );
  assert.equal(pageText(form), 'Sign in', 'only the button contributes text');
  assert.equal(elementsOf(page, 'input')[0].attrs['name'], 'email', 'the name survives');
  assert.equal(
    elementsOf(page, 'input')[0].children.length,
    0,
    'a void element has no children of its own',
  );
}

/** Comments and doctypes are skipped instead of being read as elements or text. */
function TestCommentsAndDoctypesAreSkipped() {
  const page = parsePage(
    '<!DOCTYPE html><!-- a <section> in a comment --><main><p>Visible</p></main><!-- trailing -->',
  );

  assert.deepEqual(
    elementsOf(page).map((element) => element.tag),
    ['main', 'p'],
    'neither the doctype nor the commented-out section becomes an element',
  );
  assert.equal(pageText(page), 'Visible', 'comment text never reaches the page text');
}

/** Bare and unquoted attributes read the way a browser reads them. */
function TestBareAndUnquotedAttributes() {
  const page = parsePage("<input required value=a&b type='email' data-flag>");

  const [input] = elementsOf(page, 'input');
  assert.ok(input);
  assert.equal(attr(input, 'required'), '', 'a bare attribute reads as an empty string');
  assert.equal(attr(input, 'data-flag'), '', 'any bare attribute reads as an empty string');
  assert.equal(attr(input, 'value'), 'a&b', 'an unquoted value is read as written');
  assert.equal(attr(input, 'type'), 'email', 'a single-quoted value is read');
  assert.equal(attr(input, 'missing'), undefined, 'an absent attribute reads as undefined');
}

/** A wrapping label names its control exactly like `label[for]` does. */
function TestWrappingLabelsResolveTheirControl() {
  const page = parsePage(
    '<div><label>Email <input id="a" type="email"></label>' +
      '<label for="b">Password</label><input id="b" type="password"></div>',
  );

  const [wrapped] = controlsLabelled(page, 'Email');
  assert.ok(wrapped, 'a wrapping label names its control');
  assert.equal(attr(wrapped, 'id'), 'a');

  const [linked] = controlsLabelled(page, 'Password');
  assert.ok(linked, 'a label[for] names its control');
  assert.equal(attr(linked, 'id'), 'b');

  assert.deepEqual(controlsLabelled(page, 'Nickname'), [], 'a label that is absent names nothing');
}

/** The landmark and heading queries cover the elements the pages render. */
function TestLandmarkAndHeadingQueries() {
  const page = parsePage(
    [
      '<div>',
      '  <main>',
      '    <h1>Sign in</h1>',
      '    <form aria-label="Sign in"><button type="submit">Sign in</button></form>',
      '    <form><input type="email"></form>',
      '    <nav>Links</nav>',
      '    <section role="region"><h3>Not named by a heading</h3></section>',
      '    <div role="heading" aria-level="2">A styled heading</div>',
      '    <p>Body copy</p>',
      '  </main>',
      '</div>',
    ].join('\n'),
  );

  assert.deepEqual(
    landmarks(page).map((element) => element.tag),
    ['main', 'form', 'nav', 'section'],
    'main, nav and a named form and section are landmarks; an unnamed form is not',
  );
  assert.equal(
    accessibleName(page, landmarks(page)[1]),
    'Sign in',
    'the form landmark is named by its aria-label',
  );
  assert.deepEqual(
    headings(page).map((element) => accessibleName(page, element)),
    ['Sign in', 'Not named by a heading', 'A styled heading'],
    'headings are found by tag or by an explicit heading role',
  );
  assert.equal(
    accessibleName(page, headings(page)[0]),
    'Sign in',
    'a heading is named by its own text',
  );
}

/**
 * Definition lists are paired per list: a `dt` never reaches across into a
 * neighbouring — or nested — list for its `dd`.
 */
function TestDefinitionPairsStayInsideTheirList() {
  const page = parsePage(
    [
      '<div>',
      '  <dl id="first"><dt>Email</dt></dl>',
      '  <dl id="second"><dt>Password</dt><dd>secret</dd></dl>',
      '  <dl id="third">',
      '    <dt>Email</dt>',
      '    <dd>demo@pilot.example</dd>',
      '    <dl id="nested">',
      '      <dt>Nested term</dt>',
      '      <dd>Nested value</dd>',
      '    </dl>',
      '  </dl>',
      '  <p>Terms outside a list <dt>Loose</dt><dd>value</dd></p>',
      '</div>',
    ].join('\n'),
  );

  assert.deepEqual(
    definitionPairs(page),
    [
      { term: 'Password', value: 'secret' },
      { term: 'Email', value: 'demo@pilot.example' },
      { term: 'Nested term', value: 'Nested value' },
    ],
    'a term is only paired with a value of its own list, in document order',
  );

  const [second] = elementsOf(page, 'dl').filter(
    (element) => attr(element, 'id') === 'second',
  );
  assert.deepEqual(
    definitionPairs(second),
    [{ term: 'Password', value: 'secret' }],
    'a list can be read on its own',
  );

  assert.deepEqual(
    definitionPairs(parsePage('<dt>Loose</dt><dd>value</dd>')),
    [],
    'a pair outside any list states nothing, as in a browser',
  );
}

/** A numeric reference outside the Unicode range must not throw. */
function TestOutOfRangeEntitiesAreLeftAlone() {
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;', 'beyond the last code point');
  assert.equal(decodeEntities('&#1114112;'), '&#1114112;', 'the same in decimal');
  assert.equal(decodeEntities('&#xD800;'), '&#xD800;', 'a lone high surrogate half');
  assert.equal(decodeEntities('&#xDFFF;'), '&#xDFFF;', 'a lone low surrogate half');
  assert.equal(decodeEntities('&#x10FFFF;'), '\u{10ffff}', 'the last valid code point is decoded');
  assert.equal(decodeEntities('&amp;&lt;&#65;'), '&<A', 'named and in-range numeric references decode');

  assert.doesNotThrow(
    () => parsePage('<p title="&#x110000;">a &#x110000; b</p>'),
    'a malformed page never throws inside a test',
  );
  assert.equal(
    attr(elementsOf(parsePage('<p title="&#x110000;">x</p>'), 'p')[0], 'title'),
    '&#x110000;',
    'the malformed reference survives in the attribute it appeared in',
  );
}

test('TestQueriesSurviveDecoratedMarkup', TestQueriesSurviveDecoratedMarkup);
test('TestAnUnnamedSectionIsNotALandmark', TestAnUnnamedSectionIsNotALandmark);
test('TestVoidElementsCloseThemselves', TestVoidElementsCloseThemselves);
test('TestCommentsAndDoctypesAreSkipped', TestCommentsAndDoctypesAreSkipped);
test('TestBareAndUnquotedAttributes', TestBareAndUnquotedAttributes);
test('TestWrappingLabelsResolveTheirControl', TestWrappingLabelsResolveTheirControl);
test('TestLandmarkAndHeadingQueries', TestLandmarkAndHeadingQueries);
test('TestDefinitionPairsStayInsideTheirList', TestDefinitionPairsStayInsideTheirList);
test('TestOutOfRangeEntitiesAreLeftAlone', TestOutOfRangeEntitiesAreLeftAlone);
