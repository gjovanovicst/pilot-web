import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { DEMO_EMAIL, SignIn } from "./SignIn";

// React 19 warns unless the environment declares itself act-aware.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Renders a component into a detached DOM node. */
function render(ui: ReactNode): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(ui);
  });
  return host;
}

/** Types into a controlled input the way a browser does, so React sees the change. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The empty state block rendered by the sign-in page, if any. */
function emptyState(host: HTMLElement): Element | null {
  return host.querySelector("#signin-empty-state-heading")?.closest("section") ?? null;
}

describe("SignIn", () => {
  it("renders the email and password fields", () => {
    const host = render(<SignIn />);
    expect(host.querySelector("#email")).not.toBeNull();
    expect(host.querySelector("#password")).not.toBeNull();
  });

  it("shows the demo credentials in the empty state", () => {
    const host = render(<SignIn />);

    const state = emptyState(host);
    expect(state).not.toBeNull();

    // The empty state is a labelled section, so assistive tech announces it.
    const labelledBy = state!.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(host.querySelector(`#${labelledBy}`)?.textContent).toBeTruthy();

    // The account to use is named: the demo email comes from the exported constant.
    expect(DEMO_EMAIL).toBe("demo@pilot.example");
    expect(state!.textContent).toContain(DEMO_EMAIL);
    expect(host.textContent).toContain(DEMO_EMAIL);

    // No password is invented for the demo account: only the email is checked.
    expect(state!.textContent).toMatch(/any password/i);
  });

  it("drops the empty state once the form is touched", () => {
    const host = render(<SignIn />);
    expect(emptyState(host)).not.toBeNull();

    typeInto(host.querySelector("#email") as HTMLInputElement, "someone@example.com");

    expect(emptyState(host)).toBeNull();
  });
});
