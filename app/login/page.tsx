import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClientLinkBox } from "./client-link-box";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Drifty" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    </main>
  );
}

async function Login() {
  await connection(); // read flags at request time, so changing them in Vercel needs no code change
  // EMAIL_ENABLED=true turns on "Email me a code instead" and the emailed password reset.
  const emailEnabled = process.env.EMAIL_ENABLED?.trim().toLowerCase() === "true";
  const supportEmail = process.env.SUPPORT_EMAIL?.trim().replace(/^"(.*)"$/, "$1") || null;
  return (
    <div className="w-full max-w-sm space-y-8">
      <LoginForm emailEnabled={emailEnabled} supportEmail={supportEmail} />
      <ClientLinkBox />
    </div>
  );
}
