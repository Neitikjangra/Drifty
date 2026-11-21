"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseBrowser } from "@/lib/db/supabase-browser";

const MIN = 8;

export function ResetForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    const { error: err } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      setError(
        /session/i.test(err.message)
          ? "This reset link has expired. Go back to sign in and request a new one."
          : err.code === "same_password"
            ? "Choose a password you haven't used before."
            : err.code === "weak_password"
              ? "Choose a stronger password."
              : "Couldn't save your new password. Please try again.",
      );
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  const cls =
    "border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-2 sm:text-sm";
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>You&apos;ll stay signed in after saving it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="pw" className="text-sm font-medium">
              New password
            </label>
            <input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={cls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pw2" className="text-sm font-medium">
              Repeat new password
            </label>
            <input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={cls} />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </Button>
          <a href="/login" className="text-muted-foreground block text-center text-sm hover:underline">
            Back to sign in
          </a>
        </form>
      </CardContent>
    </Card>
  );
}
