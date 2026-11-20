"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseBrowser } from "@/lib/db/supabase-browser";

/** Maps Supabase Auth error codes to clear, honest messages. */
function signInErrorMessage(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : "";
  const msg = err instanceof Error ? err.message : "";
  switch (code) {
    case "over_email_send_rate_limit":
      return "We've hit our hourly limit for sign-in emails. Please try again later, or use a sign-in link you already received.";
    case "over_request_rate_limit":
      return "Too many attempts from this device. Wait a minute and try again.";
    case "email_address_not_authorized":
      return "We can't send email to this address yet. Contact support and we'll add you.";
    case "email_address_invalid":
      return "That email address doesn't look right. Check it and try again.";
    case "signup_disabled":
    case "email_provider_disabled":
    case "otp_disabled":
      return "Email sign-in is switched off right now. Contact support.";
  }
  if (/for security purposes|after \d+ seconds/i.test(msg)) {
    return "Please wait a minute before asking for another link.";
  }
  return "Couldn't send the link. Please try again.";
}

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Enter the code from the sign-in email. Works whichever browser or app opened the email. */
function CodeForm({ email: initialEmail, next, editableEmail }: { email: string; next: string; editableEmail: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\s/g, "");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter the email address the code was sent to.");
    if (!/^\d{6,10}$/.test(token)) return setError("Enter the code from the email (numbers only).");
    setBusy(true);
    setError("");
    const { error: err } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (err) {
      setBusy(false);
      setError(
        /expired|invalid/i.test(err.message)
          ? "That code is wrong or has expired. Check the latest email, or send a new one."
          : "Couldn't sign you in. Please try again.",
      );
      return;
    }
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/app");
    router.refresh();
  }

  return (
    <form onSubmit={verify} className="space-y-3" noValidate>
      {editableEmail && (
        <>
          <label htmlFor="code-email" className="text-sm font-medium">
            Email the code was sent to
          </label>
          <input
            id="code-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-2 sm:text-sm"
          />
        </>
      )}
      <label htmlFor="code" className="text-sm font-medium">
        Code from the email
      </label>
      <input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        maxLength={12}
        className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus-visible:ring-2"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in with code"}
      </Button>
    </form>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const linkError = params.get("error") === "link";
  const next = params.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [haveCode, setHaveCode] = useState(false);
  const [state, setState] = useState<State>(
    linkError
      ? {
          kind: "error",
          message:
            "That sign-in link didn't work in this browser. Use the code from the same email below, or send a new email.",
        }
      : { kind: "idle" },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setState({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const redirect = new URL("/auth/callback", window.location.origin);
      if (next.startsWith("/") && !next.startsWith("//")) redirect.searchParams.set("next", next);
      const { error } = await supabaseBrowser().auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
      });
      if (error) throw error;
      setState({ kind: "sent", email: value });
    } catch (err) {
      setState({ kind: "error", message: signInErrorMessage(err) });
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in to Drifty</CardTitle>
        <CardDescription>
          We&apos;ll email you a sign-in link and code. New here? The same email creates your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.kind === "sent" ? (
          <div className="space-y-4" role="status">
            <p className="text-sm">
              We emailed <span className="font-medium">{state.email}</span>. Tap the link in the email, or type the code
              from it here:
            </p>
            <CodeForm email={state.email} next={next} editableEmail={false} />
            <Button variant="ghost" className="w-full" onClick={() => setState({ kind: "idle" })}>
              Use a different email
            </Button>
          </div>
        ) : haveCode ? (
          <div className="space-y-3">
            <CodeForm email={email} next={next} editableEmail />
            <Button variant="ghost" className="w-full" onClick={() => setHaveCode(false)}>
              Back
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <label htmlFor="email" className="text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-2 sm:text-sm"
            />
            {state.kind === "error" && (
              <p className="text-sm text-red-600" role="alert">
                {state.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={state.kind === "sending"}>
              {state.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
            </Button>
            <button
              type="button"
              onClick={() => setHaveCode(true)}
              className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline"
            >
              Already have a code from an email? Enter it
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
