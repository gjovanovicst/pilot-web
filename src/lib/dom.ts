/**
 * A dependency-free HTML parser and accessibility-first query layer.
 *
 * The sign-in surface is rendered as markup, so the behaviour tests have to read
 * it back. Matching tag shapes with regular expressions ties a test to the exact
 * markup a component happens to emit: adding a class, an attribute or a wrapper
 * breaks the test although nothing observable changed. This module parses the
 * markup into a tree once and answers questions phrased the way a user or an
 * assistive technology experiences the page — a landmark, a heading, the control
 * a label names, the value a definition list pairs with its term, what a field is
 * described by. Those queries keep working when the markup is reformatted,
 * decorated or wrapped, and they fail when the behaviour itself disappears.
 */

export type DomText = {
  kind: 'text';
  text: string;
};

export type DomElement = {
  kind: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: DomNode[];
};

export type DomNode = DomText | DomElement;

/** Elements that never have children, so an open tag closes itself. */
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

/** Turns the escapes a renderer emits back into the characters it stood for. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

type OpenTag = {
  tag: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  /** How many characters of the markup the open tag consumed. */
  length: number;
};

/** Reads `<tag attr="value" bare>` starting at `start`; null if it is not one. */
function readOpenTag(markup: string, start: number): OpenTag | null {
  const nameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(markup.slice(start));
  if (!nameMatch) {
    return null;
  }

  const tag = nameMatch[1].toLowerCase();
  const attrs: Record<string, string> = {};
  let cursor = start + nameMatch[0].length;

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
    const name = attributeName[0].toLowerCase();
    cursor += attributeName[0].length;

    while (cursor < markup.length && /\s/.test(markup[cursor])) {
      cursor += 1;
    }

    if (markup[cursor] !== '=') {
      // A bare attribute such as `required` carries no value.
      attrs[name] = '';
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
      attrs[name] = decodeEntities(raw);
      cursor = end === -1 ? markup.length : end + 1;
      continue;
    }

    const unquoted = /^[^\s>]*/.exec(markup.slice(cursor));
    attrs[name] = decodeEntities(unquoted ? unquoted[0] : '');
    cursor += unquoted ? unquoted[0].length : 0;
  }

  return { tag, attrs, selfClosing: false, length: cursor - start };
}

/**
 * Parses a markup fragment into a tree rooted at a `#document` element. The
 * parser is deliberately forgiving: comments and doctypes are skipped and a
 * stray `<` stays text, so a malformed page never throws inside a test.
 */
export function parseHtml(markup: string): DomElement {
  const root: DomElement = { kind: 'element', tag: '#document', attrs: {}, children: [] };
  const stack: DomElement[] = [root];
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

    const opening = readOpenTag(markup, cursor);
    if (!opening) {
      appendText('<');
      cursor += 1;
      continue;
    }

    const element: DomElement = {
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

export function isElement(node: DomNode): node is DomElement {
  return node.kind === 'element';
}

/** Every element below `node`, in document order. `node` itself is excluded. */
export function walk(node: DomNode): DomElement[] {
  const found: DomElement[] = [];
  const visit = (children: DomNode[]): void => {
    for (const child of children) {
      if (!isElement(child)) {
        continue;
      }
      found.push(child);
      visit(child.children);
    }
  };
  visit(isElement(node) ? node.children : []);
  return found;
}

export function findAll(
  node: DomNode,
  predicate: (element: DomElement) => boolean,
): DomElement[] {
  return walk(node).filter(predicate);
}

export function find(
  node: DomNode,
  predicate: (element: DomElement) => boolean,
): DomElement | undefined {
  return walk(node).find(predicate);
}

/** The readable text of a subtree, with the entities resolved. */
export function textContent(node: DomNode): string {
  if (!isElement(node)) {
    return node.text;
  }
  return node.children.map(textContent).join('');
}

export function hasAttribute(element: DomElement, name: string): boolean {
  return Object.hasOwn(element.attrs, name);
}

/** An attribute value; a bare attribute reads as `''`, an absent one as undefined. */
export function attribute(element: DomElement, name: string): string | undefined {
  return hasAttribute(element, name) ? element.attrs[name] : undefined;
}

export function findById(root: DomNode, id: string): DomElement | undefined {
  return find(root, (element) => attribute(element, 'id') === id);
}

/* ------------------------------------------------------------------ *
 * accessibility queries
 * ------------------------------------------------------------------ */

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

function inputRole(element: DomElement): string | null {
  switch (attribute(element, 'type') ?? 'text') {
    case 'email':
    case 'tel':
    case 'text':
    case 'url':
    case 'search':
      return 'textbox';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'submit':
    case 'button':
    case 'reset':
      return 'button';
    default:
      // A password field exposes no role of its own: it is reached by its label.
      return null;
  }
}

function isNamed(element: DomElement): boolean {
  return hasAttribute(element, 'aria-label') || hasAttribute(element, 'aria-labelledby');
}

/**
 * The role an element exposes: its explicit `role`, else the implicit one for
 * the elements this repository renders. Elements whose accessible name makes them
 * a landmark (`section`, `form`) only expose that role once they are named.
 */
export function roleOf(element: DomElement): string | null {
  const explicit = attribute(element, 'role');
  if (explicit && explicit.trim() !== '') {
    return explicit.trim().split(/\s+/)[0];
  }

  if (HEADINGS.has(element.tag)) {
    return 'heading';
  }

  switch (element.tag) {
    case 'section':
      return isNamed(element) ? 'region' : null;
    case 'form':
      return isNamed(element) ? 'form' : null;
    case 'a':
      return hasAttribute(element, 'href') ? 'link' : null;
    case 'button':
      return 'button';
    case 'fieldset':
      return 'group';
    case 'main':
      return 'main';
    case 'nav':
      return 'navigation';
    case 'ul':
    case 'ol':
      return 'list';
    case 'li':
      return 'listitem';
    case 'input':
      return inputRole(element);
    default:
      return null;
  }
}

export function getAllByRole(root: DomNode, role: string): DomElement[] {
  return walk(root).filter((element) => roleOf(element) === role);
}

export function queryByRole(root: DomNode, role: string): DomElement | null {
  return getAllByRole(root, role)[0] ?? null;
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The text of the `<label>` that names `element`, whether `for` or wrapping. */
function labelFor(root: DomNode, element: DomElement): string {
  const id = attribute(element, 'id');
  if (id) {
    const labelling = walk(root).filter(
      (candidate) => candidate.tag === 'label' && attribute(candidate, 'for') === id,
    );
    const text = normalise(labelling.map((label) => textContent(label)).join(' '));
    if (text !== '') {
      return text;
    }
  }

  for (const label of walk(root)) {
    if (label.tag === 'label' && find(label, (child) => child === element)) {
      return normalise(textContent(label));
    }
  }

  return '';
}

/** The accessible name: `aria-labelledby`, then `aria-label`, then label, then text. */
export function accessibleName(root: DomNode, element: DomElement): string {
  const labelledBy = attribute(element, 'aria-labelledby');
  if (labelledBy) {
    const referenced = labelledBy
      .split(/\s+/)
      .map((id) => findById(root, id))
      .filter((target): target is DomElement => target !== undefined)
      .map((target) => normalise(textContent(target)))
      .filter((text) => text !== '');
    if (referenced.length > 0) {
      return referenced.join(' ');
    }
  }

  const label = attribute(element, 'aria-label');
  if (label && normalise(label) !== '') {
    return normalise(label);
  }

  return labelFor(root, element) || normalise(textContent(element));
}

/** The accessible description: the text of everything `aria-describedby` names. */
export function accessibleDescription(root: DomNode, element: DomElement): string {
  const describedBy = attribute(element, 'aria-describedby');
  if (!describedBy) {
    return '';
  }
  return describedBy
    .split(/\s+/)
    .map((id) => findById(root, id))
    .filter((target): target is DomElement => target !== undefined)
    .map((target) => normalise(textContent(target)))
    .filter((text) => text !== '')
    .join(' ');
}

/** Every control the page names with the label `text`, via `for` or by wrapping. */
export function getAllByLabelText(root: DomNode, text: string): DomElement[] {
  const wanted = normalise(text);
  const controls: DomElement[] = [];

  for (const label of walk(root)) {
    if (label.tag !== 'label' || normalise(textContent(label)) !== wanted) {
      continue;
    }
    const forId = attribute(label, 'for');
    const control = forId
      ? findById(root, forId)
      : find(label, (child) => ['input', 'select', 'textarea'].includes(child.tag));
    if (control && !controls.includes(control)) {
      controls.push(control);
    }
  }

  return controls;
}

/**
 * The term/value pairs a definition list states, in document order. Pairing by
 * the `dt`/`dd` semantics rather than by sibling position keeps the pairs
 * readable when each one is wrapped in a group element.
 */
export function descriptionEntries(root: DomNode): Array<{ term: string; value: string }> {
  const entries: Array<{ term: string; value: string }> = [];
  let term: string | null = null;

  for (const element of walk(root)) {
    if (element.tag === 'dt') {
      term = normalise(textContent(element));
      continue;
    }
    if (element.tag === 'dd' && term !== null) {
      entries.push({ term, value: normalise(textContent(element)) });
      term = null;
    }
  }

  return entries;
}
