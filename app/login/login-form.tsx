"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseBrowser } from "@/lib/db/supabase-browser";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

const inputCls =
  "border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-2 sm:text-sm";

type Mode = "signin" | "signup" | "code" | "forgot";

function errCode(err: unknown) {
  return typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : "";
}
function errStatus(err: unknown) {
  return typeof err === "object" && err && "status" in err ? Number((err as { status?: unknown }).status) : 0;
}

/** Maps Supabase Auth errors to clear, honest messages. */
export function authErrorMessage(err: unknown, context: "signin" | "signup" | "email"): string {
  const code = errCode(err);
  const msg = err instanceof Error ? err.message : "";
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match. Try again, or use “Forgot password?”.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with this email. Sign in instead, or use “Forgot password?”.";
    case "weak_password":
      return `Choose a stronger password (at least ${MIN_PASSWORD} characters, mixing letters and numbers).`;
    case "email_not_confirmed":
      return "This email isn't confirmed yet. Use “Email me a code instead”.";
    case "over_email_send_rate_limit":
      return "We've sent too many emails recently. Please try again later.";
    case "over_request_rate_limit":
      return "Too many attempts from this device. Wait a minute and try again.";
    case "email_address_invalid":
      return "That email address doesn't look right. Check it and try again.";
    case "signup_disabled":
      return "New sign-ups are switched off right now. Contact support.";
  }
  if (/already registered/i.test(msg)) return "There's already an account with this email. Sign in instead.";
  if (/error sending/i.test(msg) || errStatus(err) >= 500) {
    return context === "email"
      ? "Our email service couldn't send the message right now. Please try again in a few minutes."
      : "Something went wrong on our side. Please try again.";
  }
  if (/for security purposes|after \d+ seconds/i.test(msg)) return "Please wait a minute before trying again.";
  return context === "signup" ? "Couldn't create your account. Please try again." : "Couldn't sign you in. Please try again.";
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export function LoginForm({ emailEnabled, supportEmail }: { emailEnabled: boolean; supportEmail: string | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get("error") === "link" ? "That link didn't work. Sign in with your password, or request a new email." : "",
  );
  const [notice, setNotice] = useState("");

  function switchTo(m: Mode) {
    setMode(m);
    setError("");
    setNotice("");
  }

  function go() {
    router.replace(next);
    router.refresh();
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setError("Enter a valid email address.");
    if (password.length < (mode === "signup" ? MIN_PASSWORD : 1)) {
      return setError(mode === "signup" ? `Use at least ${MIN_PASSWORD} characters for your password.` : "Enter your password.");
    }
    setBusy(true);
    setError("");
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({ email: value, password });
        if (err) throw err;
        // Supabase returns a user without identities when the email is already registered.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          throw Object.assign(new Error("already registered"), { code: "user_already_exists" });
        }
        if (!data.session) {
          // Only happens if email confirmation is switched back on in Supabase.
          setNotice("Account created. Check your email to confirm it, then sign in.");
          setBusy(false);
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: value, password });
        if (err) throw err;
      }
      go();
    } catch (err) {
      setError(authErrorMessage(err, mode === "signup" ? "signup" : "signin"));
      setBusy(false);
    }
  }

  const title = { signin: "Sign in to Drifty", signup: "Create your Drifty account", code: "Sign in with a code", forgot: "Reset your password" }[mode];
  const desc = {
    signin: "Welcome back. Sign in with your email and password.",
    signup: "Free for 2 active clients. You'll be signed in straight away.",
    code: "We'll email you a one-time code. Handy if you signed up with a code before.",
    forgot: emailEnabled ? "We'll email you a link to choose a new password." : "We'll help you get back in.",
  }[mode];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(mode === "signin" || mode === "signup") && (
          <>
            <div className="bg-muted grid grid-cols-2 rounded-md p-1 text-sm" role="tablist">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchTo(m)}
                  className={`rounded px-3 py-1.5 font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <form onSubmit={submitPassword} className="space-y-3" noValidate>
              <div className="space-y-1.5">
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
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => switchTo("forgot")} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "signup" ? MIN_PASSWORD : undefined}
                  className={inputCls}
                />
                {mode === "signup" && <p className="text-muted-foreground text-xs">At least {MIN_PASSWORD} characters.</p>}
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-sm" role="status">
                  {notice}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
            {emailEnabled && (
            <button
              type="button"
              onClick={() => switchTo("code")}
              className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline"
            >
              Email me a code instead
            </button>
            )}
          </>
        )}

        {mode === "code" && emailEnabled && <CodeFlow email={email} setEmail={setEmail} next={next} onBack={() => switchTo("signin")} />}
        {mode === "forgot" &&
          (emailEnabled ? (
            <ForgotFlow email={email} setEmail={setEmail} onBack={() => switchTo("signin")} />
          ) : (
            <ContactSupport supportEmail={supportEmail} onBack={() => switchTo("signin")} />
          ))}
      </CardContent>
    </Card>
  );
}

/** Secondary: one-time code by email (works whichever browser opens the email). */
function CodeFlow({ email, setEmail, next, onBack }: { email: string; setEmail: (v: string) => void; next: string; onBack: () => void }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    setError("");
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error: err } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
    });
    setBusy(false);
    if (err) return setError(authErrorMessage(err, "email"));
    setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return setError("Enter the code from the email (numbers only).");
    setBusy(true);
    setError("");
    const { error: err } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (err) {
      setBusy(false);
      return setError(
        /expired|invalid/i.test(err.message) ? "That code is wrong or has expired. Check the latest email, or send a new one." : "Couldn't sign you in. Please try again.",
      );
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={sent ? verify : send} className="space-y-3" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="code-email" className="text-sm font-medium">
            Work email
          </label>
          <input id="code-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" className={inputCls} disabled={sent} />
        </div>
        {sent && (
          <div className="space-y-1.5">
            <p className="text-sm" role="status">
              We emailed a code to <span className="font-medium">{email.trim()}</span>.
            </p>
            <label htmlFor="code" className="text-sm font-medium">
              Code from the email
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345678"
              maxLength={12}
              className={`${inputCls} h-11 text-center font-mono text-lg tracking-[0.3em]`}
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (sent ? "Signing in…" : "Sending…") : sent ? "Sign in with code" : "Email me a code"}
        </Button>
      </form>
      {!sent && (
        <button type="button" onClick={() => setSent(true)} className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline-offset-4 hover:underline">
          I already have a code
        </button>
      )}
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Back to password sign-in
      </Button>
    </div>
  );
}

function ForgotFlow({ email, setEmail, onBack }: { email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    setError("");
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", "/auth/reset");
    const { error: err } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect.toString() });
    setBusy(false);
    if (err) return setError(authErrorMessage(err, "email"));
    setSent(true);
  }

  return (
    <div className="space-y-3">
      {sent ? (
        <p className="text-sm" role="status">
          If <span className="font-medium">{email.trim()}</span> has an account, we&apos;ve emailed a link to reset the password. Open
          it in this browser.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="text-sm font-medium">
              Work email
            </label>
            <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" className={inputCls} />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Email me a reset link"}
          </Button>
        </form>
      )}
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  );
}

/** Shown instead of the emailed reset while EMAIL_ENABLED is off. */
function ContactSupport({ supportEmail, onBack }: { supportEmail: string | null; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm" role="status">
        {supportEmail ? (
          <>
            Contact{" "}
            <a className="font-medium underline underline-offset-4" href={`mailto:${supportEmail}?subject=Reset%20my%20Drifty%20password`}>
              {supportEmail}
            </a>{" "}
            to reset your password. Send it from the email address you sign in with.
          </>
        ) : (
          "Contact Drifty support to reset your password, from the email address you sign in with."
        )}
      </p>
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  );
}
