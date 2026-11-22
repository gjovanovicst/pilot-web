import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SignIn } from "./SignIn";

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

describe("SignIn", () => {
  it("renders the email and password fields", () => {
    const host = render(<SignIn />);
    expect(host.querySelector("#email")).not.toBeNull();
    expect(host.querySelector("#password")).not.toBeNull();
  });
});
