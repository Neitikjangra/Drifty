import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        This page doesn&apos;t exist, or you don&apos;t have access to it. If a client link brought you here, ask your agency for a new one.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Go to Drifty
      </Link>
    </main>
  );
}
