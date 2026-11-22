"use client";

import { useState } from "react";

export const DEMO_EMAIL = "demo@pilot.example";

/** The sign-in form. It renders the last result as a plain text line. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");

  return (
    <main className="page">
      <h1>Sign in</h1>
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
