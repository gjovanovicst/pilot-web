/**
 * Test-only reader for the rendered page.
 *
 * The components in this repository return markup strings, so a behaviour test
 * has to read the rendered page back. The supported way to do that is jsdom plus
 * `@testing-library/dom`, but this sandbox has no package registry access
 * (`npm install` fails with EAI_AGAIN), so neither package can be installed and
 * a dependency-free stopgap has to stand in for them.
 *
 * The stopgap is deliberately small and deliberately test-only:
 *
 *   - it parses a rendered page into a tree (`parsePage`), and
 *   - it answers the few questions the page tests actually ask: which named
 *     landmark a page exposes, what names and describes an element, which
 *     control a label names, and which `dt`/`dd` pairs a definition list states.
 *
 * It is not a general DOM or ARIA implementation and must not grow into one: a
 * hand-maintained parser and a partial role map drift from the specifications,
 * and a semantic bug in here would show up as a silent test bug. When the
 * registry is reachable, delete this module together with `page.test.ts` and
 * read the page with `getByRole` / `getByLabelText` from
 * `@testing-library/dom` instead. Nothing under `src/` may import it, and it is
 * not part of the shipped app.
 */

export type PageText = {
  kind: 'text';
  text: string;
};

export type PageElement = {
  kind: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: PageNode[];
};

export type PageNode = PageText | PageElement;

/** Elements that never have children, so their start tag closes them. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

const MAX_CODE_POINT = 0x10ffff;
const FIRST_SURROGATE = 0xd800;
const LAST_SURROGATE = 0xdfff;

/**
 * Turns the escapes a renderer emits back into the characters they stood for.
 *
 * A numeric reference that is not a character — beyond the Unicode range, such
 * as `&#x110000;`, or a lone surrogate half — keeps its source text instead of
 * being converted: `String.fromCodePoint` throws on both, and a malformed page
 * must never throw inside a test.
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hexadecimal = body[1] === 'x' || body[1] === 'X';
      const digits = hexadecimal ? body.slice(2) : body.slice(1);
      const code = Number.parseInt(digits, hexadecimal ? 16 : 10);
      const isCharacter =
        Number.isFinite(code) &&
        code >= 0 &&
        code <= MAX_CODE_POINT &&
        !(code >= FIRST_SURROGATE && code <= LAST_SURROGATE);
      return isCharacter ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

type StartTag = {
  tag: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  /** How many characters of the markup the start tag consumed. */
  length: number;
};

/** Reads `<tag attr="value" bare>` starting at `start`; null if it is not one. */
function readStartTag(markup: string, start: number): StartTag | null {
  const name = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(markup.slice(start));
  if (!name) {
    return null;
  }

  const tag = name[1].toLowerCase();
  const attrs: Record<string, string> = {};
  let cursor = start + name[0].length;

  while (cursor < markup.length) {
    while (cursor < markup.length && /\s/.test(markup[cursor])) {
      cursor += 1;
    }
    if (markup[cursor] === '>') {
      return { tag, attrs, selfClosing: false, length: cursor + 1 - start };
    }
    if (markup.startsWith('/>', cursor)) {
      return { tag, attrs, selfClosing: true, length: cursor + 2 - start };
    }

    const attributeName = /^[^\s=/>]+/.exec(markup.slice(cursor));
    if (!attributeName) {
      cursor += 1;
      continue;
    }
    const attribute = attributeName[0].toLowerCase();
    cursor += attributeName[0].length;

    while (cursor < markup.length && /\s/.test(markup[cursor])) {
      cursor += 1;
    }

    if (markup[cursor] !== '=') {
      // A bare attribute such as `required` carries no value.
      attrs[attribute] = '';
      continue;
    }

    cursor += 1;
    while (cursor < markup.length && /\s/.test(markup[cursor])) {
      cursor += 1;
    }

    const quote = markup[cursor];
    if (quote === '"' || quote === "'") {
      const end = markup.indexOf(quote, cursor + 1);
      const raw = end === -1 ? markup.slice(cursor + 1) : markup.slice(cursor + 1, end);
      attrs[attribute] = decodeEntities(raw);
      cursor = end === -1 ? markup.length : end + 1;
      continue;
    }

    const unquoted = /^[^\s>]*/.exec(markup.slice(cursor));
    attrs[attribute] = decodeEntities(unquoted ? unquoted[0] : '');
    cursor += unquoted ? unquoted[0].length : 0;
  }

  return { tag, attrs, selfClosing: false, length: cursor - start };
}

/**
 * Parses a rendered fragment into a tree rooted at a `#document` element. The
 * parser is deliberately forgiving — comments and doctypes are skipped and a
 * stray `<` stays text — so a malformed page never throws inside a test.
 */
export function parsePage(markup: string): PageElement {
  const root: PageElement = { kind: 'element', tag: '#document', attrs: {}, children: [] };
  const stack: PageElement[] = [root];
  let cursor = 0;

  const appendText = (text: string): void => {
    if (text === '') {
      return;
    }
    stack[stack.length - 1].children.push({ kind: 'text', text: decodeEntities(text) });
  };

  while (cursor < markup.length) {
    const next = markup.indexOf('<', cursor);
    if (next === -1) {
      appendText(markup.slice(cursor));
      break;
    }
    appendText(markup.slice(cursor, next));
    cursor = next;

    if (markup.startsWith('<!--', cursor)) {
      const end = markup.indexOf('-->', cursor);
      cursor = end === -1 ? markup.length : end + 3;
      continue;
    }

    if (markup.startsWith('<!', cursor)) {
      const end = markup.indexOf('>', cursor);
      cursor = end === -1 ? markup.length : end + 1;
      continue;
    }

    const closing = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/.exec(markup.slice(cursor));
    if (closing) {
      const tag = closing[1].toLowerCase();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].tag === tag) {
          stack.length = depth;
          break;
        }
      }
      cursor += closing[0].length;
      continue;
    }

    const opening = readStartTag(markup, cursor);
    if (!opening) {
      appendText('<');
      cursor += 1;
      continue;
    }

    const element: PageElement = {
      kind: 'element',
      tag: opening.tag,
      attrs: opening.attrs,
      children: [],
    };
    stack[stack.length - 1].children.push(element);
    cursor += opening.length;
    if (!opening.selfClosing && !VOID_ELEMENTS.has(opening.tag)) {
      stack.push(element);
    }
  }

  return root;
}

/* ------------------------------------------------------------------ *
 * tree queries
 * ------------------------------------------------------------------ */

export function isElement(node: PageNode): node is PageElement {
  return node.kind === 'element';
}

/** Every element below `node`, in document order, optionally of one tag only. */
export function elementsOf(node: PageNode, tag?: string): PageElement[] {
  const found: PageElement[] = [];
  const visit = (children: PageNode[]): void => {
    for (const child of children) {
      if (!isElement(child)) {
        continue;
      }
      if (tag === undefined || child.tag === tag) {
        found.push(child);
      }
      visit(child.children);
    }
  };
  visit(isElement(node) ? node.children : []);
  return found;
}

/** `node` itself when it is an element, followed by everything below it. */
function withSelf(node: PageNode): PageElement[] {
  return isElement(node) ? [node, ...elementsOf(node)] : [];
}

/** The readable text of a subtree, with the entities resolved. */
export function pageText(node: PageNode): string {
  if (!isElement(node)) {
    return node.text;
  }
  return node.children.map(pageText).join('');
}

/** An attribute value; a bare attribute reads as `''`, an absent one as undefined. */
export function attr(element: PageElement, name: string): string | undefined {
  return Object.hasOwn(element.attrs, name) ? element.attrs[name] : undefined;
}

export function byId(root: PageNode, id: string): PageElement | undefined {
  return withSelf(root).find((element) => attr(element, 'id') === id);
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function explicitRole(element: PageElement): string | undefined {
  const role = attr(element, 'role');
  if (!role) {
    return undefined;
  }
  const first = role.trim().split(/\s+/)[0];
  return first === '' ? undefined : first;
}

/**
 * The name an element carries on itself: `aria-labelledby` resolving to text,
 * then `aria-label`. Nothing else — in particular not the element's own content,
 * which is a name for a link or a button but never for a landmark.
 */
function ariaLabelledName(root: PageNode, element: PageElement): string {
  const labelledBy = attr(element, 'aria-labelledby');
  if (labelledBy) {
    const referenced = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => byId(root, id))
      .filter((target): target is PageElement => target !== undefined)
      .map((target) => normalise(pageText(target)))
      .filter((text) => text !== '');
    if (referenced.length > 0) {
      return referenced.join(' ');
    }
  }

  const label = attr(element, 'aria-label');
  if (label && normalise(label) !== '') {
    return normalise(label);
  }

  return '';
}

/** The text of the `<label>` that names `element`, whether `for` or wrapping. */
function labelTextFor(root: PageNode, element: PageElement): string {
  const id = attr(element, 'id');
  if (id) {
    const labelling = elementsOf(root, 'label').filter((label) => attr(label, 'for') === id);
    const text = normalise(labelling.map((label) => pageText(label)).join(' '));
    if (text !== '') {
      return text;
    }
  }

  for (const label of elementsOf(root, 'label')) {
    if (elementsOf(label).includes(element)) {
      return normalise(pageText(label));
    }
  }

  return '';
}

/**
 * The accessible name: `aria-labelledby`, then `aria-label`, then the label that
 * names the control, then the element's own text (as for a link or a button).
 */
export function accessibleName(root: PageNode, element: PageElement): string {
  return (
    ariaLabelledName(root, element) ||
    labelTextFor(root, element) ||
    normalise(pageText(element))
  );
}

/**
 * The landmarks a page exposes, in document order: `main`, `nav` and `aside`,
 * plus the `section` and `form` elements that assistive technology only treats
 * as a landmark once they carry an accessible name — which is exactly the
 * property the empty state relies on. An explicit `role` wins over the tag.
 */
const ALWAYS_LANDMARK = new Set(['main', 'nav', 'aside']);
const LANDMARK_ONCE_NAMED = new Set(['section', 'form']);
const EXPLICIT_LANDMARKS = new Set([
  'region',
  'form',
  'main',
  'navigation',
  'complementary',
  'search',
]);

export function landmarks(root: PageNode): PageElement[] {
  return withSelf(root).filter((element) => {
    const role = explicitRole(element);
    if (role) {
      return EXPLICIT_LANDMARKS.has(role);
    }
    if (ALWAYS_LANDMARK.has(element.tag)) {
      return true;
    }
    if (LANDMARK_ONCE_NAMED.has(element.tag)) {
      return ariaLabelledName(root, element) !== '';
    }
    return false;
  });
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

export function headings(root: PageNode): PageElement[] {
  return withSelf(root).filter(
    (element) => HEADING_TAGS.has(element.tag) || explicitRole(element) === 'heading',
  );
}

/** The accessible description: the text of everything `aria-describedby` names. */
export function accessibleDescription(root: PageNode, element: PageElement): string {
  const describedBy = attr(element, 'aria-describedby');
  if (!describedBy) {
    return '';
  }
  return describedBy
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => byId(root, id))
    .filter((target): target is PageElement => target !== undefined)
    .map((target) => normalise(pageText(target)))
    .filter((text) => text !== '')
    .join(' ');
}

const LABELABLE = new Set(['input', 'select', 'textarea']);

/** Every control the page names with the label `text`, via `for` or by wrapping. */
export function controlsLabelled(root: PageNode, text: string): PageElement[] {
  const wanted = normalise(text);
  const controls: PageElement[] = [];

  for (const label of elementsOf(root, 'label')) {
    if (normalise(pageText(label)) !== wanted) {
      continue;
    }
    const forId = attr(label, 'for');
    const control = forId
      ? byId(root, forId)
      : elementsOf(label).find((child) => LABELABLE.has(child.tag));
    if (control && !controls.includes(control)) {
      controls.push(control);
    }
  }

  return controls;
}

/**
 * The term/value pairs the definition lists on the page state.
 *
 * Each `dl` is paired on its own: a `dt` is only ever paired with a `dd` that
 * belongs to the same list, so two adjacent — or nested — lists never pair
 * across each other. A `dt`/`dd` that sits outside any `dl` states nothing, as
 * in a browser. Within one list the pairs come back in document order, and
 * wrapping a pair in a group element changes nothing.
 */
export function definitionPairs(root: PageNode): Array<{ term: string; value: string }> {
  const lists = elementsOf(root, 'dl');
  if (isElement(root) && root.tag === 'dl') {
    lists.unshift(root);
  }
  return lists.flatMap((list) => pairsIn(list));
}

function pairsIn(list: PageElement): Array<{ term: string; value: string }> {
  const pairs: Array<{ term: string; value: string }> = [];
  let term: string | null = null;

  const visit = (node: PageNode): void => {
    if (!isElement(node)) {
      return;
    }
    if (node.tag === 'dl') {
      // A nested list owns its own terms and values.
      return;
    }
    if (node.tag === 'dt') {
      term = normalise(pageText(node));
      return;
    }
    if (node.tag === 'dd') {
      if (term !== null) {
        pairs.push({ term, value: normalise(pageText(node)) });
        term = null;
      }
      return;
    }
    node.children.forEach(visit);
  };

  list.children.forEach(visit);
  return pairs;
}
