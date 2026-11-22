import { connection } from "next/server";
import { Suspense } from "react";

async function Email({ fallback, subject }: { fallback: string; subject?: string }) {
  await connection(); // read at request time: set SUPPORT_EMAIL in Vercel, no rebuild needed
  const email = process.env.SUPPORT_EMAIL?.trim().replace(/^"(.*)"$/, "$1");
  if (!email) return <>{fallback}</>;
  const href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a className="underline" href={href}>
      {email}
    </a>
  );
}

/** The support address as a mailto link (or the fallback text while it isn't set). */
export function SupportEmail({ fallback = "our support team", subject }: { fallback?: string; subject?: string }) {
  return (
    <Suspense fallback={<span>{fallback}</span>}>
      <Email fallback={fallback} subject={subject} />
    </Suspense>
  );
}
