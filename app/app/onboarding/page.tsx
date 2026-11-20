import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getCaller } from "@/lib/access";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your workspace · Drifty" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const caller = await getCaller();
  if (caller.kind !== "member") redirect("/login");
  if (caller.membership) redirect("/app");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <OnboardingForm email={caller.email ?? ""} />
    </main>
  );
}
