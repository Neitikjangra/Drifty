import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password · Drifty" };

/** Reached from the "Forgot password" email (via /auth/callback, which signs the user in). */
export default function ResetPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <ResetForm />
    </main>
  );
}
