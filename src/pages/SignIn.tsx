"use client";

import { useState } from "react";

export const DEMO_EMAIL = "demo@pilot.example";

/**
 * The sign-in form. It renders the last result as a plain text line and shows an
 * empty state naming the demo account until the form is touched.
 */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");

  // The form is untouched until the user types or submits, so the empty state
  // only describes the demo account while there is nothing else to go on.
  const isUntouched = email === "" && password === "" && result === "";

  return (
    <main className="page">
      <h1>Sign in</h1>
      {isUntouched ? (
        <section className="signin-empty-state" aria-labelledby="signin-empty-state-heading">
          <h2 id="signin-empty-state-heading">No account details yet</h2>
          <p>
            Demo account: <strong>{DEMO_EMAIL}</strong>
          </p>
          <p>
            The demo sign-in only checks the email address, so any password will do.
          </p>
        </section>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setResult(email === DEMO_EMAIL ? "Signed in as " + email : "Unknown account");
        }}
      >
        <label htmlFor="email">Email</label>
        <input id="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button type="submit">Sign in</button>
      </form>
      {result ? <p role="status">{result}</p> : null}
    </main>
  );
}

export default SignIn;
