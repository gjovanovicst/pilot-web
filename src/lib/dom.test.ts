import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accessibleDescription,
  accessibleName,
  attribute,
  descriptionEntries,
  getAllByLabelText,
  parseHtml,
  queryByRole,
  textContent,
} from './dom.ts';

/* ------------------------------------------------------------------ *
 * The queries behind the behaviour tests read semantics, not markup shapes:
 * a renamed class, an added attribute, an extra wrapper or a reflowed tag must
 * not change the answer. This suite pins that property, so a page test failure
 * always means the behaviour changed.
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
  '            <dd>demo@pilot.example</dd>',
  '          </div>',
  '          <div class="credentials__pair">',
  '            <dt>Password</dt>',
  '            <dd>pilot-demo-2024</dd>',
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
  const tree = parseHtml(DECORATED);

  const region = queryByRole(tree, 'region');
  assert.ok(region, 'a decorated, wrapped landmark is still found by its role');
  assert.equal(
    accessibleName(tree, region),
    'Sign in with the demo account',
    'the region is named by its title, not by a class name',
  );
  assert.equal(
    accessibleDescription(tree, region),
    'The form starts empty.',
    'the description is read through aria-describedby wherever it sits',
  );

  assert.deepEqual(
    descriptionEntries(region),
    [
      { term: 'Email', value: 'demo@pilot.example' },
      { term: 'Password', value: 'pilot-demo-2024' },
    ],
    'term/value pairs are paired by dt/dd semantics, not by sibling position',
  );

  const [email] = getAllByLabelText(tree, 'Email');
  assert.ok(email, 'the field is found through its label');
  assert.equal(attribute(email, 'id'), 'email-field');
  assert.equal(
    attribute(email, 'value'),
    'a"b',
    'an escaped attribute value is read back as the string it stood for',
  );
  assert.equal(textContent(email), '', 'an input has no text content of its own');
}

/** A page without a named section has no region, so "empty" stays detectable. */
function TestAnUnnamedSectionIsNotARegion() {
  const tree = parseHtml('<div><section><p>Nothing here yet</p></section></div>');
  assert.equal(queryByRole(tree, 'region'), null);
}

test('TestQueriesSurviveDecoratedMarkup', TestQueriesSurviveDecoratedMarkup);
test('TestAnUnnamedSectionIsNotARegion', TestAnUnnamedSectionIsNotARegion);
