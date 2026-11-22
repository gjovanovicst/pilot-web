// Minimal stand-in for the `vitest` module, used by .verify/run.mjs to execute the
// real test file when the sandbox cannot start vitest itself (missing Rollup musl
// native binding). Not used by `pnpm test`.
const registry = (globalThis.__VERIFY_TESTS__ ??= []);

let suiteName = "";

export function describe(name, body) {
  const previous = suiteName;
  suiteName = previous ? `${previous} > ${name}` : name;
  try {
    body();
  } finally {
    suiteName = previous;
  }
}

export function it(name, fn) {
  registry.push({ name: suiteName ? `${suiteName} > ${name}` : name, fn });
}

const show = (value) => (typeof value === "string" ? JSON.stringify(value) : String(value));

function fail(message) {
  throw new Error(message);
}

function matchers(actual) {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) fail(`expected ${show(actual)} to be ${show(expected)}`);
    },
    toBeNull() {
      if (actual !== null) fail(`expected ${show(actual)} to be null`);
    },
    toBeTruthy() {
      if (!actual) fail(`expected ${show(actual)} to be truthy`);
    },
    toContain(expected) {
      if (typeof actual?.includes !== "function") fail(`expected a string or array, got ${show(actual)}`);
      if (!actual.includes(expected)) fail(`expected ${show(actual)} to contain ${show(expected)}`);
    },
    toMatch(expected) {
      if (typeof actual !== "string" || !expected.test(actual)) {
        fail(`expected ${show(actual)} to match ${expected}`);
      }
    },
  };
}

export function expect(actual) {
  const positives = matchers(actual);
  const negated = {};
  for (const [key, matcher] of Object.entries(positives)) {
    negated[key] = (...args) => {
      let threw = false;
      try {
        matcher(...args);
      } catch {
        threw = true;
      }
      if (!threw) fail(`expected ${show(actual)} not to ${key} ${args.map(show).join(", ")}`);
    };
  }
  return { ...positives, not: negated };
}
