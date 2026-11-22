import test from 'node:test';
import assert from 'node:assert/strict';

import { SignIn } from './SignIn.ts';
import { attr, byId, elementsOf, parsePage, type PageElement } from '../../test/support/page.ts';

/* ------------------------------------------------------------------ *
 * Rendering integrity of the sign-in surface.
 *
 * The behaviour tests read the page through its accessibility semantics, which
 * only works while the markup is coherent: ids stay unique and every
 * `aria-labelledby` / `aria-describedby` points at an element that is really on
 * the page. Both properties are checked on the load state (empty state rendered)
 * and on the in-use state (empty state suppressed, so nothing may still point
 * at the hint it used to render).
 * ------------------------------------------------------------------ */

function idsOnPage(tree: PageElement): string[] {
  return elementsOf(tree)
    .map((element) => attr(element, 'id'))
    .filter((id): id is string => id !== undefined);
}

function ariaReferences(tree: PageElement): Array<{ id: string; source: string }> {
  const references: Array<{ id: string; source: string }> = [];
  for (const element of elementsOf(tree)) {
    for (const name of ['aria-labelledby', 'aria-describedby']) {
      const value = attr(element, name);
      if (!value) {
        continue;
      }
      for (const id of value.split(/\s+/).filter(Boolean)) {
        references.push({ id, source: `<${element.tag} ${name}="${id}">` });
      }
    }
  }
  return references;
}

function TestSignInMarkupHasUniqueIdsAndResolvableReferences() {
  const states: Array<[string, Parameters<typeof SignIn>[0]]> = [
    ['on load', {}],
    [
      'with a value in the form',
      { values: { email: 'someone@example.com', password: 'hunter2hunter2' } },
    ],
    ['after the form was touched', { touched: true }],
    ['with an error', { error: 'That account was not found.' }],
  ];

  for (const [state, input] of states) {
    const tree = parsePage(SignIn(input));

    const ids = idsOnPage(tree);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `the page renders unique ids ${state} (duplicates make a label ambiguous)`,
    );

    for (const reference of ariaReferences(tree)) {
      assert.ok(
        byId(tree, reference.id) !== undefined,
        `${reference.source} resolves to an element on the page ${state}`,
      );
    }
  }

  // The hint the fields are described by is gone once the form is in use, so the
  // fields must not keep pointing at it.
  const suppressed = parsePage(SignIn({ touched: true }));
  assert.deepEqual(ariaReferences(suppressed), [], 'no description survives the hint');
}

test(
  'TestSignInMarkupHasUniqueIdsAndResolvableReferences',
  TestSignInMarkupHasUniqueIdsAndResolvableReferences,
);
