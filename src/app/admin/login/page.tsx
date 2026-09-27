import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { isAdmin, isAdminConfigured } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const configured = await isAdminConfigured();
  return (
    <main id="main" className="container-page grid min-h-dvh place-items-center py-12">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="ExamReady home">
          <Logo />
        </Link>
        <div className="sheet mt-6 p-6 sm:p-8">
          <h1 className="text-[1.8rem]">Admin sign-in</h1>
          <p className="mt-2 text-pencil">For editors who manage questions and sources. Students don&apos;t need an account.</p>
          {configured ? (
            <LoginForm />
          ) : (
            <p role="alert" className="mt-5 rounded-md border-2 border-margin/60 bg-margin-soft p-4 text-[0.95rem]">
              Admin sign-in isn&apos;t configured. Set <code>ADMIN_PASSWORD</code> (at least 8 characters) and <code>SESSION_SECRET</code> (at least 32
              characters). Locally, run <code>npm run dev</code> once to create <code>.dev.vars</code>; in production, use <code>wrangler secret put</code>.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
