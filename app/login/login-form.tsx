"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
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

export function LoginForm() {
  const params = useSearchParams();
  const linkError = params.get("error") === "link";
  const next = params.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>(
    linkError
      ? {
          kind: "error",
          message:
            "That sign-in link didn't work. It may have expired, been used already, or been opened in a different browser. Send a new one and open it in this browser.",
        }
      : { kind: "idle" },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
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
          We&apos;ll email you a sign-in link. New here? The same link creates your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.kind === "sent" ? (
          <div className="space-y-3" role="status">
            <p className="text-sm">
              Check <span className="font-medium">{state.email}</span> for your sign-in link. Open it on this device.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setState({ kind: "idle" })}>
              Use a different email
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
          </form>
        )}
      </CardContent>
    </Card>
  );
}
